import { grantEntitlements, grantEntitlement, revokeEntitlementsFromChoice } from '../../src/engine/entitlements';
// app/creation/spells.tsx
// Step 8: Spell selection for spellcasting classes.
// Always renders — never auto-navigates during render.
// Sets spellsVisited flag on Continue so hub knows this step was reached.
//
// Two selection modes:
//   1. ChoiceDefinition-based (kind: 'spell') — if a class ever defines them.
//   2. Content-based — pull cantrips/level-1 spells straight from the content DB
//      and write the picks into entity.spellcasting.cantrips / .known.
import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { applySpellChoiceToEntity } from '../../src/engine/leveling';
import { Entity, Spell } from '../../src/engine/types';
import { spellRepo } from '../../src/content/spellRepo';
import type { SpellIndexEntry } from '../../src/content/spellRepo.types';
import { mergeSpellIndex } from '../../src/content/contentResolution';
import { AddSpellModal } from '../../src/components/sheet/AddSpellModal';
import { actionType, ACTION_TYPES } from '../../src/content/spellFilterUtils';
import { spellSortOptions } from '../../src/content/spells/spellBrowse';
import { sortByOption } from '../../src/content/contentQuery';
import { SortControl } from '../../src/components/SortControl';
import { Alert } from '../../src/utils/alert';
import { NonSrdBadge, isNonSrd } from '../../src/components/NonSrdBadge';
import { FilterChipRow, MultiSelectChipRow, FilterSection, OfficialHomebrewChipRow, ActiveFilterChips } from '../../src/components/FilterChipRow';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { useBrowseStateStore } from '../../src/store/browseStateStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { SPELLS_AT_L1, readCreationPicks, writeCreationPicks, CreationSpellPicks } from '../../src/content/creationProgress';

const SCREEN_KEY = 'spell_picker';

/** Marks spellsVisited in notes JSON. */
function markVisited(entity: Entity): Entity {
  let n: Record<string, unknown> = {};
  try { n = JSON.parse(entity.notes || '{}'); } catch { /* ignore */ }
  return { ...entity, notes: JSON.stringify({ ...n, spellsVisited: true }) };
}

// ── Spell row (select + expandable description) ───────────────────────────────

function SpellRow({
  spell, selected, disabled, isHomebrew, onToggle,
}: {
  spell: SpellIndexEntry; selected: boolean; disabled: boolean; isHomebrew?: boolean; onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Tier 1 doesn't carry description — homebrew spells are already full
  // Spell objects at runtime (structurally satisfy SpellIndexEntry), so
  // their description is read straight off; official spells are fetched
  // on demand the moment the row is expanded.
  const [description, setDescription] = useState<string | null>(
    isHomebrew ? (spell as unknown as Spell).description : null
  );
  useEffect(() => {
    if (!open || description !== null || isHomebrew) return;
    let cancelled = false;
    void spellRepo.ensureLoaded([spell.id]).then(() => {
      if (!cancelled) setDescription(spellRepo.getSpellSync(spell.id)?.description ?? '');
    });
    return () => { cancelled = true; };
  }, [open, spell.id, description, isHomebrew]);

  return (
    <View style={[styles.spellCard, selected && styles.spellCardSelected, disabled && styles.spellCardDisabled]}>
      <View style={styles.spellRowTop}>
        <Pressable style={styles.spellSelect} onPress={onToggle} disabled={disabled}>
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={styles.spellCardLeft}>
            <View style={styles.spellNameRow}>
              <Text style={styles.spellName}>{spell.name}</Text>
              {isHomebrew && (
                <View style={styles.homebrewTag}>
                  <Text style={styles.homebrewTagTxt}>Homebrew</Text>
                </View>
              )}
              {!isHomebrew && isNonSrd(spell.srd) && <NonSrdBadge />}
            </View>
            <Text style={styles.spellMeta}>
              {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}  ·  {spell.school}  ·  {spell.castingTime}
              {spell.concentration ? '  ·  Concentration' : ''}
            </Text>
          </View>
        </Pressable>
        <Pressable style={styles.infoBtn} onPress={() => setOpen(o => !o)} hitSlop={8}>
          <Text style={styles.infoBtnTxt}>{open ? '▲' : 'ⓘ'}</Text>
        </Pressable>
      </View>
      {open && (
        <Text style={styles.spellDesc}>{description ?? 'Loading…'}</Text>
      )}
    </View>
  );
}

export default function SpellsScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);
  const homebrewSpells = useHomebrewStore(s => s.spells);

  // ── ALL hooks first — before any conditional return ──
  // Redirect to name if no draft — must be in useEffect, not render
  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft?.id]);

  // CREATION-REVISIT-1: was filtered to only !resolved. For a class using
  // this ChoiceDefinition-based path (e.g. Wizard's cantrip/spellbook
  // choice), once resolved this screen fell through to the content-based
  // branch below — and Wizard is deliberately excluded from SPELLS_AT_L1
  // (see that table's own comment), so the player landed on "nothing to
  // pick" with no way back to their original choice. Same fix shape as
  // skills.tsx's startEditingSkills / equipment.tsx's startEditingEquipment.
  const allSpellChoicesForKind = draft ? draft.choices.filter(c => c.definition.kind === 'spell') : [];
  const spellChoices        = allSpellChoicesForKind.filter(c => !c.resolved);
  const resolvedSpellChoices = allSpellChoicesForKind.filter(c =>  c.resolved);

  // ChoiceDefinition-based selections (legacy path)
  const [selections, setSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(spellChoices.map(c => [c.id, []]))
  );

  // Content-based selections. pickedCantrips/pickedSpells track ONLY what's
  // picked on THIS screen, seeded from the persisted creationSpellPicks (see
  // readCreationPicks) rather than draft.spellcasting directly — that can
  // already be non-empty before the player ever gets here (e.g. every
  // Cleric Divine Domain grants 2 "always prepared" domain spells via a
  // known_spells Grant — see src/content/subclasses/cleric.ts — the moment
  // a domain is picked) or hold picks from a PREVIOUS visit to this exact
  // screen, and there's no marker distinguishing the two once merged into
  // one array. Seeding picked state straight from spellcasting.known used
  // to permanently break confirmation for prepared casters (Cleric/Druid,
  // targets.spells === 0): pickedSpells.length would never again equal 0
  // since there's no UI here that can ever clear it, so Confirm stayed
  // disabled forever regardless of cantrips. alreadyGrantedCantrips/Spells
  // is everything currently in spellcasting that ISN'T one of the player's
  // own tracked picks — i.e. purely external grants — computed once via a
  // lazy initializer so a re-render mid-screen doesn't re-read a
  // since-changed draft.
  const [initialPicks] = useState<CreationSpellPicks>(() => readCreationPicks(draft));
  const [alreadyGrantedCantrips] = useState<string[]>(() => {
    const own = new Set(initialPicks.cantrips);
    return (draft?.spellcasting?.cantrips ?? []).filter(id => !own.has(id));
  });
  const [alreadyGrantedSpells] = useState<string[]>(() => {
    const own = new Set(initialPicks.spells);
    return (draft?.spellcasting?.known ?? []).filter(id => !own.has(id));
  });
  const [pickedCantrips, setPickedCantrips] = useState<string[]>(initialPicks.cantrips);
  const [pickedSpells,   setPickedSpells]   = useState<string[]>(initialPicks.spells);
  // SAVE-AND-ADD-1: returning from "+ Create new homebrew spell" (content-
  // based picker only — the ChoiceDefinition-based branch above has no
  // simple "add to selection" slot to inject into). Adds the new spell if
  // it's eligible for THIS class/level/pick-count; otherwise explains why
  // instead of silently forcing or dropping it.
  // SPELL-ROUNDTRIP-1: uses useFocusEffect (not a plain useEffect keyed on
  // homebrewSpells) — same fix shape already proven by equipment.tsx's own
  // nested-builder round trip (STARTING-EQUIPMENT-2). A plain effect keyed
  // on the homebrewStore selector was found to be unreliable on return from
  // a pushed route: the store update and this screen regaining focus don't
  // reliably land in the same commit, so the effect could silently never
  // re-run and the pending selection would sit unconsumed forever. Reads
  // draft/homebrewSpells fresh via .getState() (not the render-time
  // closure) so the callback never acts on stale data; pickedCantrips/
  // pickedSpells.length stay in the dependency array since they're local
  // component state, not reachable via .getState().
  useFocusEffect(
    useCallback(() => {
      const newId = usePendingSelectionStore.getState().consumePending('spell_picker');
      const currentDraft = useCharacterStore.getState().draft;
      if (!newId || !currentDraft) return;
      const spell = mergeSpellIndex(useHomebrewStore.getState().spells).find(s => s.id === newId);
      if (!spell) return;
      const classId = currentDraft.identity.classId;
      const eligibleForClass = !spell.classes || spell.classes.length === 0 || spell.classes.includes(classId);
      const targets = SPELLS_AT_L1[classId] ?? { cantrips: 0, spells: 0 };
      if (!eligibleForClass) {
        Alert.alert('Not added', `"${spell.name}" isn't on ${classId}'s spell list, so it wasn't added to your picks. It's saved and available from "+ Add extra from another class."`);
      } else if (spell.level === 0) {
        if (pickedCantrips.length < targets.cantrips) setPickedCantrips(prev => [...prev, newId]);
        else Alert.alert('Not added', `"${spell.name}" was saved, but your cantrip picks are already full (${targets.cantrips}/${targets.cantrips}). Deselect one first if you want to add it.`);
      } else if (spell.level === 1) {
        if (pickedSpells.length < targets.spells) setPickedSpells(prev => [...prev, newId]);
        else Alert.alert('Not added', `"${spell.name}" was saved, but your spell picks are already full (${targets.spells}/${targets.spells}). Deselect one first if you want to add it.`);
      } else {
        Alert.alert('Saved', `"${spell.name}" was saved. This screen only picks cantrips and 1st-level spells — find it later via "+ Add Spell" on your character sheet.`);
      }
    }, [pickedCantrips.length, pickedSpells.length])
  );

  // "+ Add Additional Spell" flow — closed | menu | library | homebrew.
  // Whole-library browsing (AddSpellModal, unconstrained by class list),
  // lazily mounted (LAZY-MOUNT-1, matching equipment.tsx's own additional-
  // item flow) — only the chosen destination is ever actually mounted.
  type AdditionalSpellFlow = 'closed' | 'menu' | 'library' | 'homebrew';
  const [additionalFlow, setAdditionalFlow] = useState<AdditionalSpellFlow>('closed');
  // ADDITIONAL-SPELL-2: ids added via "+ Add Additional Spell" this visit,
  // tracked separately from alreadyGrantedCantrips/Spells (which is frozen
  // at mount) so section 3's pool-exclusion and handleConfirm's final
  // spellcasting merge both see adds made mid-visit — see both use sites
  // below for why a live add would otherwise get silently dropped at
  // Confirm (handleConfirm rebuilds spellcasting.cantrips/known from
  // alreadyGranted+picked only) or double-offered in the required pool.
  const [additionalCantripIds, setAdditionalCantripIds] = useState<string[]>([]);
  const [additionalSpellIds,   setAdditionalSpellIds]   = useState<string[]>([]);

  // ADDITIONAL-SPELL-1: "+ Add Additional Spell" → "Create New Homebrew
  // Spell" round trip. Keyed separately from 'spell_picker' above (see
  // spell-builder.tsx's doSave) specifically so it can add UNCONDITIONALLY
  // — whole library, no class/level restriction, no eligibility check, and
  // critically no entitlement consumed (never touches creationSpellPicks) —
  // unlike the Required picker's own consumer above, which gates on
  // class/level/pick-count. SPELL-ROUNDTRIP-1: useFocusEffect, not a plain
  // effect — see the sibling consumer above for why.
  useFocusEffect(
    useCallback(() => {
      const newId = usePendingSelectionStore.getState().consumePending('spell_picker_additional');
      const currentDraft = useCharacterStore.getState().draft;
      if (!newId || !currentDraft?.spellcasting) return;
      const spell = mergeSpellIndex(useHomebrewStore.getState().spells).find(s => s.id === newId);
      if (!spell) return;
      const sc = currentDraft.spellcasting;
      if (spell.level === 0) {
        if (sc.cantrips.includes(newId)) return;
        useCharacterStore.getState().setDraft(grantEntitlement(currentDraft, { kind: 'cantrip_access', key: newId, sourceKind: 'manual' }));
        setAdditionalCantripIds(prev => [...prev, newId]);
      } else {
        if (sc.known.includes(newId)) return;
        useCharacterStore.getState().setDraft(grantEntitlement({ ...currentDraft, spellcasting: { ...sc, prepared: [...sc.prepared, newId] } }, { kind: 'spell_access', key: newId, sourceKind: 'manual' }));
        setAdditionalSpellIds(prev => [...prev, newId]);
      }
    }, [])
  );

  const saved = useBrowseStateStore.getState().getBrowseState(SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const savedFilters = saved.filters ?? {};
  const [search,         setSearch]         = useState(saved.search ?? '');
  const [schoolFilter,   setSchoolFilter]   = useState<string | null>((savedFilters.schoolFilter as string) ?? null);
  // CREATION-FILTERS-1: ritual/concentration are real boolean fields on
  // Spell — 'all' is a no-op filter, so 'ritual'/'concentration' each just
  // narrow to spells where that flag is true.
  const [castFilter,     setCastFilter]     = useState<'all' | 'ritual' | 'concentration'>((savedFilters.castFilter as 'all' | 'ritual' | 'concentration') ?? 'all');
  // CREATION-FILTERS-4 (item 8): casting-time/action-type bucket — reuses
  // the same actionType() classification AddSpellModal.tsx's spell browser
  // already uses (now shared via spellFilterUtils.ts), instead of building
  // a second, different one.
  const [actionFilter,   setActionFilter]   = useState<string | null>((savedFilters.actionFilter as string) ?? null);
  // Official/Homebrew — real, derived from homebrewSpellIds membership.
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>((savedFilters.officialFilter as 'all' | 'official' | 'homebrew') ?? 'all');
  // TIER1-EXT-1: Ruleset/Components(V/S/M) — now real, Tier-1 fields
  // (spellRepo's index was extended to carry them; see spellRepo.types.ts).
  // Source/Pack via getContentProvenance() is NOT wired on this specific
  // screen — Spell has no per-item sourcebook field at all (confirmed;
  // only Feat does), so the derived sourceLabel would only ever resolve to
  // "SRD 5.1" or undefined here, a narrower signal than the existing
  // NonSrdBadge already shows per row; not worth a whole filter axis for.
  const [rulesetFilter,  setRulesetFilter]  = useState<string | null>((savedFilters.rulesetFilter as string) ?? null);
  const [componentFilter, setComponentFilter] = useState<Set<string>>(new Set((savedFilters.componentFilter as string[]) ?? []));
  const [spellSort,      setSpellSort]      = useState(saved.sort ?? 'name_asc');
  const [filtersOpen,    setFiltersOpen]    = useState(false);
  const [cantripsOpen,   setCantripsOpen]   = useState(true);
  const [spellsOpen,     setSpellsOpen]     = useState(true);
  // Off by default — the normal pool is restricted to this class's own spell
  // list. Toggling this widens the pool to every class's spells, for the
  // "pick an extra spell from another class" case (a feat, a homebrew rule,
  // etc.) rather than silently letting every class pick from everything.
  const [otherClasses,   setOtherClasses]   = useState(!!savedFilters.otherClasses);
  useEffect(() => {
    setBrowseState(SCREEN_KEY, {
      search, sort: spellSort,
      filters: {
        schoolFilter, castFilter, actionFilter, officialFilter, rulesetFilter,
        componentFilter: Array.from(componentFilter), otherClasses,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, spellSort, schoolFilter, castFilter, actionFilter, officialFilter, rulesetFilter, componentFilter, otherClasses]);

  if (!draft) return null;

  const classId       = draft.identity.classId;
  const isSpellcaster = !!draft.spellcasting || spellChoices.length > 0;
  // CREATION-FILTERS-4 (item 8/9): was a manually inline-duplicated
  // official+homebrew merge — replaced with the already-shared
  // mergeSpellIndex() (src/content/contentResolution.ts), the same
  // function the character sheet's AddSpellModal/SpellChoicePicker use,
  // instead of an independently-reimplemented copy of the same logic.
  const allSpells: SpellIndexEntry[] = mergeSpellIndex(homebrewSpells);
  const homebrewSpellIds = new Set(homebrewSpells.map(s => s.id));

  // Filter by class — only show spells tagged for this class.
  // If a spell has no `classes` tag at all (legacy), include it so nothing disappears.
  // The "add extra from another class" toggle bypasses this restriction entirely.
  const classSpells = otherClasses
    ? allSpells
    : allSpells.filter(s => !s.classes || s.classes.length === 0 || s.classes.includes(classId));

  // "+ Add Additional Spell" — writes directly into spellcasting.cantrips/
  // .known (mirroring the pre-existing "externally granted" spell pattern
  // this screen already relies on for domain-granted spells, e.g.
  // alreadyGrantedCantrips/Spells above), WITHOUT going through
  // writeCreationPicks — so it never consumes cantrip/spell-known
  // allowance, prepared count, or any progression-required-selection
  // counter. Next visit correctly treats it as an external grant (excluded
  // from the pickable pool by alreadyGrantedCantrips/Spells).
  function handleAddAdditionalSpell(spellId: string, isCantrip: boolean) {
    if (!draft!.spellcasting) return;
    const sc = draft!.spellcasting;
    if (isCantrip) {
      if (sc.cantrips.includes(spellId)) return;
      setDraft(grantEntitlement(draft!, { kind: 'cantrip_access', key: spellId, sourceKind: 'manual' }));
      setAdditionalCantripIds(prev => [...prev, spellId]);
    } else {
      if (sc.known.includes(spellId)) return;
      setDraft(grantEntitlement({ ...draft!, spellcasting: { ...sc, prepared: [...sc.prepared, spellId] } }, { kind: 'spell_access', key: spellId, sourceKind: 'manual' }));
      setAdditionalSpellIds(prev => [...prev, spellId]);
    }
  }

  function renderAdditionalSpellSection() {
    if (!draft!.spellcasting) return null;
    return (
      <View style={styles.additionalSpellSection}>
        <Pressable style={styles.addSpellBtn} onPress={() => setAdditionalFlow('menu')}>
          <Text style={styles.addSpellBtnTxt}>+ Add Additional Spell</Text>
        </Pressable>

        {additionalFlow === 'library' && (
          <AddSpellModal
            visible
            entity={draft!}
            initialOfficialFilter="official"
            onAdd={handleAddAdditionalSpell}
            onClose={() => setAdditionalFlow('closed')}
          />
        )}
        {additionalFlow === 'homebrew' && (
          <AddSpellModal
            visible
            entity={draft!}
            initialOfficialFilter="homebrew"
            onAdd={handleAddAdditionalSpell}
            onClose={() => setAdditionalFlow('closed')}
          />
        )}
        {additionalFlow === 'menu' && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setAdditionalFlow('closed')}>
            <Pressable style={styles.backdrop} onPress={() => setAdditionalFlow('closed')}>
              <Pressable style={styles.menuSheet} onPress={e => e.stopPropagation()}>
                <Text style={styles.menuTitle}>Add Additional Spell</Text>
                <Text style={styles.menuSub}>Browses the whole spell library — doesn't use up your class's spell picks.</Text>
                <Pressable style={styles.menuBtn} onPress={() => setAdditionalFlow('library')}>
                  <Text style={styles.menuBtnTxt}>Browse Spell Library</Text>
                </Pressable>
                <Pressable style={styles.menuBtn} onPress={() => setAdditionalFlow('homebrew')}>
                  <Text style={styles.menuBtnTxt}>Browse Homebrew</Text>
                </Pressable>
                <Pressable style={styles.menuBtn} onPress={() => { setAdditionalFlow('closed'); router.push('/homebrew/spell-builder'); }}>
                  <Text style={styles.menuBtnTxt}>Create New Homebrew Spell</Text>
                </Pressable>
                <Pressable style={styles.menuCancel} onPress={() => setAdditionalFlow('closed')}>
                  <Text style={styles.menuCancelTxt}>Cancel</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </View>
    );
  }

  function startEditingSpellChoices() {
    let updated = draft!;
    for (const choice of resolvedSpellChoices) {
      updated = revokeEntitlementsFromChoice(updated, choice.id);
      updated = {
        ...updated,
        choices: updated.choices.map(c => c.id === choice.id ? { ...c, resolved: false, selections: [] } : c),
      };
      setSelections(prev => ({ ...prev, [choice.id]: [] }));
    }
    setDraft(updated);
  }

  // ── 1. Non-spellcaster ──────────────────────────────────────────────────────
  if (!isSpellcaster) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Spells</Text>
        <Text style={styles.sub}>This class does not use spells.</Text>
        <Pressable style={styles.nextBtn} onPress={() => {
          setDraft(markVisited(draft));
          router.push('/creation/hub');
        }}>
          <Text style={styles.nextBtnText}>Continue →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── 1b. ChoiceDefinition-based choices already resolved (re-entering) ──────
  if (spellChoices.length === 0 && resolvedSpellChoices.length > 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Spells</Text>
        <Text style={styles.sub}>Spells already chosen:</Text>
        {resolvedSpellChoices.map(choice => (
          <View key={choice.id}>
            {choice.selections.map(selId => {
              const spell = allSpells.find(s => s.id === selId);
              return <Text key={selId} style={styles.ownedSpell}>✓ {spell?.name ?? selId}</Text>;
            })}
          </View>
        ))}
        <Pressable style={styles.changeBtn} onPress={startEditingSpellChoices}>
          <Text style={styles.changeBtnTxt}>✎ Change Spells</Text>
        </Pressable>
        {renderAdditionalSpellSection()}
        <Pressable style={styles.nextBtn} onPress={() => {
          setDraft(markVisited(draft));
          router.push('/creation/hub');
        }}>
          <Text style={styles.nextBtnText}>Continue →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── 2. ChoiceDefinition-based selection (if a class defines spell choices) ───
  // Every real spellChoice() in class content uses the 'all' pool sentinel
  // (see src/content/classes/index.ts) — it means "any spell from this
  // class's list", not a literal array, so the pool is built dynamically
  // here exactly like SpellChoicePicker.tsx does for the level-up case
  // (same class/cantrip-vs-leveled filtering). resolveChoice() can't apply
  // these either — it silently skips any choice whose pool isn't a literal
  // array — so confirming uses applySpellChoiceToEntity() instead, same as
  // SpellChoicePicker.
  if (spellChoices.length > 0) {
    const isCantripChoice = (id: string) => id.includes('cantrip');
    const maxCastableLevel = (() => {
      const sc = draft.spellcasting;
      if (!sc) return 0;
      const tiers = ['9', '8', '7', '6', '5', '4', '3', '2', '1'] as const;
      for (const t of tiers) { if ((sc.slots[t]?.total ?? 0) > 0) return Number(t); }
      return 0;
    })();
    const alreadyKnown = new Set([
      ...(draft.spellcasting?.cantrips ?? []),
      ...(draft.spellcasting?.known ?? []),
    ]);
    const poolForChoice = (choice: typeof spellChoices[number]): SpellIndexEntry[] => {
      const cantrip = isCantripChoice(choice.id);
      return classSpells
        .filter(s => !alreadyKnown.has(s.id))
        .filter(s => cantrip ? s.level === 0 : (s.level >= 1 && s.level <= maxCastableLevel))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    };
    // SPELL-ACCUMULATION-1: a class content author queues ONE small
    // ChoiceDefinition PER LEVEL that grants a new known spell/cantrip
    // (e.g. Warlock: one count-2 choice at level 1, then one count-1
    // choice at each of levels 2-9,19 — see src/content/classes/index.ts's
    // spellChoice() calls). Directly creating (or leveling straight to) a
    // high-level character queues all of those at once, and rendering
    // one UI block PER underlying choice object produced a stack of
    // separate "Choose 1 more spell" prompts instead of one cumulative
    // "Known Spells: X/Y" counter. Fixed here at the UI/aggregation layer
    // — grouping same-shape (cantrip vs known-spell) choices into ONE
    // combined pool/counter — rather than restructuring the underlying
    // per-level choice-queuing architecture, which many other systems
    // (resolveChoice, TabFeatures' pending-choices list, save/load) already
    // key off unchanged. Selections still fill each underlying choice
    // object in order (first-with-room), so confirming still resolves
    // each ChoiceState exactly the way it always did — see the invariant
    // note on canConfirm below.
    const cantripGroup = spellChoices.filter(c => isCantripChoice(c.id));
    const knownGroup   = spellChoices.filter(c => !isCantripChoice(c.id));

    function groupSelectedIds(group: typeof spellChoices): Set<string> {
      return new Set(group.flatMap(c => selections[c.id] ?? []));
    }
    function groupSelectedCount(group: typeof spellChoices): number {
      return group.reduce((sum, c) => sum + (selections[c.id]?.length ?? 0), 0);
    }
    function groupTotalCount(group: typeof spellChoices): number {
      return group.reduce((sum, c) => sum + c.definition.count, 0);
    }
    function toggleInGroup(group: typeof spellChoices, spellId: string) {
      setSelections(prev => {
        // Removing: find whichever underlying choice currently holds this
        // spell (unambiguous — a spell can only be selected into one slot)
        // and drop it from there.
        for (const choice of group) {
          const cur = prev[choice.id] ?? [];
          if (cur.includes(spellId)) {
            return { ...prev, [choice.id]: cur.filter(id => id !== spellId) };
          }
        }
        // Adding: fill the first underlying choice with room. Because this
        // is the ONLY path that ever adds, no choice's array can ever
        // exceed its own `count` — the invariant canConfirm below relies on.
        for (const choice of group) {
          const cur = prev[choice.id] ?? [];
          if (cur.length < choice.definition.count) {
            return { ...prev, [choice.id]: [...cur, spellId] };
          }
        }
        return prev; // group already full
      });
    }
    const handleConfirmChoices = async () => {
      try {
        const allChosen = Object.values(selections).flat();
        await spellRepo.ensureLoaded(allChosen);
        let updated = draft!;
        for (const choice of spellChoices) {
          const chosen = selections[choice.id] ?? [];
          if (chosen.length === choice.definition.count) {
            updated = applySpellChoiceToEntity(updated, choice.id, chosen, id => allSpells.find(s => s.id === id)?.level, rules);
          }
        }
        updated = markVisited(updated);
        setDraft(updated);
        router.push('/creation/hub');
      } catch (e) {
        console.error('[spells] confirm failed:', e);
        Alert.alert('Couldn\'t confirm spells', e instanceof Error ? e.message : 'Something went wrong loading spell data. Check the console for details.');
      }
    };
    // Invariant: toggleInGroup's add path never lets any single choice's
    // selection array exceed that choice's own `count` — so if the GROUP's
    // total selected equals the GROUP's total count, every individual
    // choice must be exactly at its own count too (sum(x_i) = sum(cap_i)
    // with x_i <= cap_i for all i implies x_i = cap_i for all i). This is
    // what lets handleConfirmChoices' existing per-choice `=== count` check
    // keep working unchanged underneath the new aggregated UI.
    const canConfirm =
      groupSelectedCount(cantripGroup) === groupTotalCount(cantripGroup) &&
      groupSelectedCount(knownGroup) === groupTotalCount(knownGroup);

    const renderGroup = (group: typeof spellChoices, label: string) => {
      if (group.length === 0) return null;
      const pool = poolForChoice(group[0]);
      const selectedIds = groupSelectedIds(group);
      const total = groupTotalCount(group);
      const selectedCount = groupSelectedCount(group);
      const remaining = total - selectedCount;
      return (
        <View style={styles.choiceBlock}>
          <Text style={styles.choicePrompt}>{label}</Text>
          <Text style={styles.choiceCount}>
            Selected {selectedCount} / {total}{remaining > 0 ? ` · Remaining ${remaining}` : ''}
          </Text>
          {pool.length === 0
            ? <Text style={styles.emptyNote}>No available spells for this choice.</Text>
            : pool.map(spell => {
              const selected = selectedIds.has(spell.id);
              const disabled = !selected && selectedCount >= total;
              return (
                <SpellRow
                  key={spell.id}
                  spell={spell}
                  selected={selected}
                  disabled={disabled}
                  isHomebrew={homebrewSpellIds.has(spell.id)}
                  onToggle={() => toggleInGroup(group, spell.id)}
                />
              );
            })}
        </View>
      );
    };

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Spells</Text>
        {renderGroup(cantripGroup, 'Cantrips')}
        {renderGroup(knownGroup, 'Known Spells')}
        {renderAdditionalSpellSection()}
        <Pressable
          style={[styles.nextBtn, !canConfirm && styles.nextBtnDisabled]}
          onPress={() => { void handleConfirmChoices(); }}
          disabled={!canConfirm}
        >
          <Text style={styles.nextBtnText}>Confirm Spells →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── 3. Content-based selection ──────────────────────────────────────────────
  const targets        = SPELLS_AT_L1[classId] ?? { cantrips: 0, spells: 0 };
  const q              = search.trim().toLowerCase();
  const matchesSearch  = (s: SpellIndexEntry) => q === '' || s.name.toLowerCase().includes(q) || s.school.toLowerCase().includes(q);
  const matchesSchool  = (s: SpellIndexEntry) => !schoolFilter || s.school === schoolFilter;
  const matchesCast    = (s: SpellIndexEntry) =>
    castFilter === 'all' || (castFilter === 'ritual' ? s.ritual : s.concentration);
  const matchesAction  = (s: SpellIndexEntry) => !actionFilter || actionType(s) === actionFilter;
  const matchesOfficial = (s: SpellIndexEntry) =>
    officialFilter === 'all' || (officialFilter === 'homebrew') === homebrewSpellIds.has(s.id);
  const matchesRulesetFilter = (s: SpellIndexEntry) => !rulesetFilter || s.rulesetId === rulesetFilter;
  const matchesComponents = (s: SpellIndexEntry) =>
    componentFilter.size === 0 || Array.from(componentFilter).some(c => (s.components ?? []).includes(c));
  const spellSortOpts = spellSortOptions(s => homebrewSpellIds.has(s.id));
  const sortSpells = (list: SpellIndexEntry[]) => sortByOption(list, spellSortOpts, spellSort);
  // Excludes anything already granted before this screen (e.g. a Divine
  // Domain's "always prepared" spells) — nothing to pick here, it's already
  // on the sheet, and letting it show as pickable would let a player select
  // it a second time for no effect while still eating into their pick count.
  const alreadyGrantedCantripSet = new Set([...alreadyGrantedCantrips, ...additionalCantripIds]);
  const alreadyGrantedSpellSet   = new Set([...alreadyGrantedSpells, ...additionalSpellIds]);
  const matchesAll = (s: SpellIndexEntry) =>
    matchesSearch(s) && matchesSchool(s) && matchesCast(s) && matchesAction(s) &&
    matchesOfficial(s) && matchesRulesetFilter(s) && matchesComponents(s);
  const cantripPool    = sortSpells(classSpells.filter(s => s.level === 0 && !alreadyGrantedCantripSet.has(s.id) && matchesAll(s)));
  const spellPool      = sortSpells(classSpells.filter(s => s.level === 1 && !alreadyGrantedSpellSet.has(s.id) && matchesAll(s)));
  const availableRulesets = Array.from(new Set(classSpells.map(s => s.rulesetId).filter((r): r is NonNullable<typeof r> => !!r))).map(String);
  const availableComponents = Array.from(new Set(classSpells.flatMap(s => s.components ?? [])));

  // Distinct schools present in this class's cantrip+level-1 pool, for the chips.
  const availableSchools = Array.from(new Set(
    classSpells.filter(s => s.level <= 1).map(s => s.school)
  )).sort();

  const toggleCantrip = (id: string) => {
    setPickedCantrips(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= targets.cantrips) return prev;
      return [...prev, id];
    });
  };
  const toggleSpell = (id: string) => {
    setPickedSpells(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= targets.spells) return prev;
      return [...prev, id];
    });
  };

  const cantripsDone = pickedCantrips.length === targets.cantrips;
  const spellsDone   = pickedSpells.length === targets.spells;
  const canConfirm   = cantripsDone && spellsDone;

  const handleConfirm = async () => {
    try {
      await spellRepo.ensureLoaded([...pickedCantrips, ...pickedSpells]);
      let updated: Entity = revokeEntitlementsFromChoice(draft!, 'creation-spells');
      updated = grantEntitlements(updated, [
        ...pickedCantrips.map(key => ({ kind: 'cantrip_access' as const, key, sourceKind: 'class' as const, sourceId: classId, choiceId: 'creation-spells' })),
        ...pickedSpells.map(key => ({ kind: 'spell_access' as const, key, sourceKind: 'class' as const, sourceId: classId, choiceId: 'creation-spells' })),
      ]);
      if (updated.spellcasting) {
        // Merge back in whatever was already granted before this screen
        // (e.g. domain spells) plus anything added via "+ Add Additional
        // Spell" mid-visit — pickedCantrips/pickedSpells only ever held
        // what's newly chosen here, so overwriting instead of merging would
        // silently drop the rest.

        const finalSpells   = [...new Set([...alreadyGrantedSpells,   ...additionalSpellIds,   ...pickedSpells])];
        updated = {
          ...updated,
          spellcasting: {
            ...updated.spellcasting,

            // Known casters cast straight from `known`; mirror into prepared so the
            // sheet shows them as castable for prepared-style classes too.
            prepared: finalSpells,
          },
        };
      }
      // Persist what THIS screen picked, separate from spellcasting.known/
      // cantrips, so a later revisit can tell it apart from externally-
      // granted spells (domain grants, etc.) again — see readCreationPicks.
      updated = writeCreationPicks(updated, { cantrips: pickedCantrips, spells: pickedSpells });
      updated = markVisited(updated);
      setDraft(updated);
      router.push('/creation/hub');
    } catch (e) {
      console.error('[spells] confirm failed:', e);
      Alert.alert('Couldn\'t confirm spells', e instanceof Error ? e.message : 'Something went wrong loading spell data. Check the console for details.');
    }
  };

  const nothingToPick = targets.cantrips === 0 && targets.spells === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Spells</Text>

      {nothingToPick ? (
        <Text style={styles.sub}>
          Your spells are prepared from the full class list on the character sheet.
        </Text>
      ) : (
        <>
          <Text style={styles.sub}>Choose your starting cantrips and spells.</Text>

          <View style={styles.searchRow}>
            <TextInput
              style={[styles.search, styles.searchFlex]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search spells…"
              placeholderTextColor={Colors.textDim}
            />
          </View>

          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.filtersToggle, filtersOpen && styles.filtersToggleActive]}
              onPress={() => setFiltersOpen(v => !v)}
            >
              <Text style={[styles.filtersToggleTxt, filtersOpen && styles.filtersToggleTxtActive]}>Filters</Text>
            </Pressable>
            <SortControl options={spellSortOpts} value={spellSort} onChange={setSpellSort} />
          </View>

          {filtersOpen && (
            <View style={styles.filterPanel}>
              {availableSchools.length > 1 && (
                <FilterSection label="School">
                  <FilterChipRow options={availableSchools.map(sc => ({ id: sc, label: sc }))} value={schoolFilter} onChange={setSchoolFilter} scrollable />
                </FilterSection>
              )}
              <FilterSection label="Ritual / Concentration">
                <FilterChipRow
                  options={[
                    { id: 'ritual' as const, label: 'Ritual' },
                    { id: 'concentration' as const, label: 'Concentration' },
                  ]}
                  value={castFilter === 'all' ? null : castFilter}
                  onChange={v => setCastFilter(v ?? 'all')}
                />
              </FilterSection>
              <FilterSection label="Casting Time">
                <FilterChipRow
                  options={ACTION_TYPES.map(a => ({ id: a, label: a }))}
                  value={actionFilter}
                  onChange={setActionFilter}
                />
              </FilterSection>
              <FilterSection label="Official / Homebrew">
                <OfficialHomebrewChipRow value={officialFilter} onChange={setOfficialFilter} />
              </FilterSection>
              {availableRulesets.length > 1 && (
                <FilterSection label="Ruleset">
                  <FilterChipRow
                    options={availableRulesets.map(r => ({ id: r, label: r }))}
                    value={rulesetFilter}
                    onChange={setRulesetFilter}
                  />
                </FilterSection>
              )}
              {availableComponents.length > 1 && (
                <FilterSection label="Components">
                  <MultiSelectChipRow
                    options={availableComponents.map(c => ({ id: c, label: c }))}
                    values={componentFilter}
                    onChange={setComponentFilter}
                  />
                </FilterSection>
              )}
            </View>
          )}
          <ActiveFilterChips
            chips={[
              ...(schoolFilter ? [{ key: 'school', label: schoolFilter, onClear: () => setSchoolFilter(null) }] : []),
              ...(castFilter !== 'all' ? [{ key: 'cast', label: castFilter === 'ritual' ? 'Ritual' : 'Concentration', onClear: () => setCastFilter('all') }] : []),
              ...(actionFilter ? [{ key: 'action', label: actionFilter, onClear: () => setActionFilter(null) }] : []),
              ...(officialFilter !== 'all' ? [{ key: 'official', label: officialFilter === 'official' ? 'Official' : 'Homebrew', onClear: () => setOfficialFilter('all') }] : []),
              ...(rulesetFilter ? [{ key: 'ruleset', label: rulesetFilter, onClear: () => setRulesetFilter(null) }] : []),
              ...Array.from(componentFilter).map(c => ({ key: `comp_${c}`, label: c, onClear: () => setComponentFilter(prev => { const n = new Set(prev); n.delete(c); return n; }) })),
            ]}
            onClearAll={() => { setSchoolFilter(null); setCastFilter('all'); setActionFilter(null); setOfficialFilter('all'); setRulesetFilter(null); setComponentFilter(new Set()); }}
          />

          <View style={styles.spellActionRow}>
            <Pressable
              style={styles.createSpellBtn}
              onPress={() => router.push('/homebrew/spell-builder')}
            >
              <Text style={styles.createSpellTxt}>+ Create new homebrew spell</Text>
            </Pressable>
            <Pressable
              style={[styles.createSpellBtn, otherClasses && styles.createSpellBtnActive]}
              onPress={() => setOtherClasses(v => !v)}
            >
              <Text style={[styles.createSpellTxt, otherClasses && styles.createSpellTxtActive]}>
                {otherClasses ? '✓ Showing every class’s spells' : '+ Add extra from another class'}
              </Text>
            </Pressable>
          </View>

          {targets.cantrips > 0 && (
            <View style={styles.choiceBlock}>
              <Pressable style={styles.levelHeaderRow} onPress={() => setCantripsOpen(o => !o)}>
                <Text style={styles.levelHeader}>CANTRIPS</Text>
                <View style={styles.levelHeaderLine} />
                <Text style={[styles.levelHeaderCount, cantripsDone && styles.choiceCountDone]}>
                  {pickedCantrips.length}/{targets.cantrips}
                </Text>
                <Text style={styles.levelHeaderChevron}>{cantripsOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {cantripsOpen && (cantripPool.length === 0
                ? <Text style={styles.emptyNote}>No matching cantrips.</Text>
                : cantripPool.map(s => (
                  <SpellRow
                    key={s.id}
                    spell={s}
                    selected={pickedCantrips.includes(s.id)}
                    disabled={!pickedCantrips.includes(s.id) && pickedCantrips.length >= targets.cantrips}
                    isHomebrew={homebrewSpellIds.has(s.id)}
                    onToggle={() => toggleCantrip(s.id)}
                  />
                )))}
            </View>
          )}

          {targets.spells > 0 && (
            <View style={styles.choiceBlock}>
              <Pressable style={styles.levelHeaderRow} onPress={() => setSpellsOpen(o => !o)}>
                <Text style={styles.levelHeader}>1ST-LEVEL SPELLS</Text>
                <View style={styles.levelHeaderLine} />
                <Text style={[styles.levelHeaderCount, spellsDone && styles.choiceCountDone]}>
                  {pickedSpells.length}/{targets.spells}
                </Text>
                <Text style={styles.levelHeaderChevron}>{spellsOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {spellsOpen && (spellPool.length === 0
                ? <Text style={styles.emptyNote}>No matching spells.</Text>
                : spellPool.map(s => (
                  <SpellRow
                    key={s.id}
                    spell={s}
                    selected={pickedSpells.includes(s.id)}
                    disabled={!pickedSpells.includes(s.id) && pickedSpells.length >= targets.spells}
                    isHomebrew={homebrewSpellIds.has(s.id)}
                    onToggle={() => toggleSpell(s.id)}
                  />
                )))}
            </View>
          )}
        </>
      )}

      {renderAdditionalSpellSection()}

      <Pressable
        style={[styles.nextBtn, !nothingToPick && !canConfirm && styles.nextBtnDisabled]}
        onPress={() => { void handleConfirm(); }}
        disabled={!nothingToPick && !canConfirm}
      >
        <Text style={styles.nextBtnText}>{nothingToPick ? 'Continue →' : 'Confirm Spells →'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  search: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  searchFlex: { flex: 1, marginBottom: 0 },
  filtersToggle: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filtersToggleActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filtersToggleTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filtersToggleTxtActive: { color: Colors.bg },
  filterPanel: { marginBottom: Spacing.xs },
  choiceBlock:  { marginBottom: Spacing.xl },
  levelHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.md, marginTop: Spacing.sm,
  },
  levelHeader: {
    fontSize: FontSize.xl, fontWeight: FontWeight.black,
    color: Colors.gold, letterSpacing: 2,
  },
  levelHeaderLine: {
    flex: 1, height: 2, backgroundColor: Colors.gold + '44', borderRadius: 1,
  },
  levelHeaderCount: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary,
  },
  choicePrompt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  choiceCount:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  choiceCountDone: { color: Colors.green, fontWeight: FontWeight.bold },
  spellCard: {
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  spellCardSelected: { borderColor: Colors.blue, backgroundColor: Colors.blueDim },
  spellCardDisabled: { opacity: 0.4 },
  spellRowTop:  { flexDirection: 'row', alignItems: 'center' },
  spellSelect:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  checkmark:        { fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold },
  spellCardLeft:    { flex: 1 },
  spellNameRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  spellName:        { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  homebrewTag: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 1,
  },
  homebrewTagTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  spellMeta:        { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  infoBtn:          { paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  infoBtnTxt:       { fontSize: FontSize.md, color: Colors.blue },
  spellDesc:        { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 20 },
  emptyNote:        { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
  nextBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
  },
  nextBtnDisabled: { backgroundColor: Colors.goldDim },
  nextBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
  ownedSpell: { fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },
  changeBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold,
    paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  changeBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  spellActionRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end',
    gap: Spacing.xs, marginBottom: Spacing.md,
  },
  createSpellBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  createSpellBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  createSpellTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  createSpellTxtActive: { color: Colors.bg },
  levelHeaderChevron: { fontSize: FontSize.sm, color: Colors.textDim },
  additionalSpellSection: {
    marginTop: Spacing.md, marginBottom: Spacing.lg, paddingTop: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  addSpellBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  addSpellBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: Colors.surfaceHigh, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm,
  },
  menuTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  menuSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  menuBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, alignItems: 'center',
  },
  menuBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  menuCancel: { alignItems: 'center', padding: Spacing.sm, marginTop: Spacing.xs },
  menuCancelTxt: { fontSize: FontSize.md, color: Colors.textSecondary },
});
