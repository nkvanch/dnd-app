// src/components/sheet/TabExploration.tsx
// Exploration view — the non-combat half of the character sheet's first tab.
// Surfaces everything a player reaches for OUT of combat, with quick edit
// controls (HP, conditions, senses, notes) so the DM doesn't have to flip back
// to the combat view mid-scene.
//
// Honest scope notes:
//  • "Utility" abilities/spells are NOT auto-detected — the content has no such
//    tag. Instead the player can manually STAR a feature as exploration-relevant
//    (persisted as an explorationTag on the feature); a filter toggle then shows
//    starred-only. Spells show all known, with level + tap-for-description.
//  • Fly/swim/climb come from derived.movement (grant_movement effects). Empty
//    until a race/item/spell grants them.
import { useState, memo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal, TextInput } from 'react-native';
import {
  Entity, Ability, SkillName, CampaignRules, SenseType, Sense, ItemInstance, Spell, DurationTracker,
} from '../../engine/types';
import { modifier, collectAllEffects, applyStatModifiers, recomputeDerived } from '../../engine/pipeline';
import { AsiFeatPicker } from '../AsiFeatPicker';
import { HpModal } from './HpModal';
import { ConcentrationModal } from './ConcentrationModal';
import { useCharacterStore } from '../../store/characterStore';
import { useDiceLogStore } from '../../store/diceLogStore';
import { spellRepo } from '../../content/spellRepo';
import { itemRepo } from '../../content/itemRepo';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const SKILLS: { name: SkillName; label: string; ability: Ability }[] = [
  { name: 'athletics', label: 'Athletics', ability: 'str' },
  { name: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
  { name: 'sleight_of_hand', label: 'Sleight of Hand', ability: 'dex' },
  { name: 'stealth', label: 'Stealth', ability: 'dex' },
  { name: 'arcana', label: 'Arcana', ability: 'int' },
  { name: 'history', label: 'History', ability: 'int' },
  { name: 'investigation', label: 'Investigation', ability: 'int' },
  { name: 'nature', label: 'Nature', ability: 'int' },
  { name: 'religion', label: 'Religion', ability: 'int' },
  { name: 'animal_handling', label: 'Animal Handling', ability: 'wis' },
  { name: 'insight', label: 'Insight', ability: 'wis' },
  { name: 'medicine', label: 'Medicine', ability: 'wis' },
  { name: 'perception', label: 'Perception', ability: 'wis' },
  { name: 'survival', label: 'Survival', ability: 'wis' },
  { name: 'deception', label: 'Deception', ability: 'cha' },
  { name: 'intimidation', label: 'Intimidation', ability: 'cha' },
  { name: 'performance', label: 'Performance', ability: 'cha' },
  { name: 'persuasion', label: 'Persuasion', ability: 'cha' },
];

const SENSE_LABELS: Record<string, string> = {
  darkvision: 'Darkvision', blindsight: 'Blindsight',
  tremorsense: 'Tremorsense', truesight: 'Truesight',
};
const SENSE_TYPE_OPTIONS: SenseType[] = ['darkvision', 'blindsight', 'tremorsense', 'truesight'];
const MANUAL_SENSES_FEATURE_ID = 'manual_senses';

type MoveType = 'fly' | 'swim' | 'climb' | 'burrow';
const MOVE_TYPE_LABELS: Record<MoveType, string> = { fly: 'Fly', swim: 'Swim', climb: 'Climb', burrow: 'Burrow' };
const MOVE_TYPE_OPTIONS: MoveType[] = ['climb', 'swim', 'fly', 'burrow'];
const MANUAL_MOVEMENT_FEATURE_ID = 'manual_movement';

const COMMON_CONDITIONS = [
  'blinded','charmed','deafened','frightened','grappled','invisible',
  'paralyzed','poisoned','prone','restrained','stunned','unconscious',
];

// Structured notes are serialized as pure JSON into entity.explorationNotes
// — its own field, not shared with the Notes tab's entity.notes (see that
// field's own doc comment for why: NOTES-CORRUPT-1). NOTES_MARKER is kept
// only for the one-time backward-compatible read path below, extracting
// exploration data out of entity.notes for a character saved before this
// field existed — never written back there again.
const NOTES_MARKER = '\n<<<GRIMOIRE_NOTES>>>\n';
type NoteCategory = 'objectives' | 'npcs' | 'clues' | 'locations';
type StructuredNotes = { scratch: string; objectives: string[]; npcs: string[]; clues: string[]; locations: string[] };

function structuredFromJson(json: string, scratchFallback: string): StructuredNotes {
  try {
    const parsed = JSON.parse(json);
    return {
      scratch: parsed.scratch ?? scratchFallback,
      objectives: parsed.objectives ?? [],
      npcs: parsed.npcs ?? [],
      clues: parsed.clues ?? [],
      locations: parsed.locations ?? [],
    };
  } catch {
    return { scratch: scratchFallback, objectives: [], npcs: [], clues: [], locations: [] };
  }
}

export function parseNotes(explorationNotes: string | undefined, legacyEntityNotes: string): StructuredNotes {
  if (explorationNotes) return structuredFromJson(explorationNotes, explorationNotes);
  // Backward compatibility only: a character saved before explorationNotes
  // existed may still have exploration data embedded inside entity.notes
  // behind the legacy marker.
  if (legacyEntityNotes?.includes(NOTES_MARKER)) {
    const [scratch, json] = legacyEntityNotes.split(NOTES_MARKER);
    return structuredFromJson(json, scratch ?? '');
  }
  return { scratch: '', objectives: [], npcs: [], clues: [], locations: [] };
}
export function serializeNotes(n: StructuredNotes): string {
  return JSON.stringify(n);
}

interface Props {
  entity: Entity;
  rules: CampaignRules;
  onEntityUpdate: (updated: Entity) => void;
  onDamage: (amount: number, damageType?: string) => void;
  onHeal: (amount: number) => void;
  onAddCondition: (condId: string, duration: DurationTracker | null) => void;
  onRemoveCondition: (condId: string) => void;
  onSaveExplorationNotes: (notes: string) => void;
}

// ── Manual senses helpers ────────────────────────────────────────────────────
function readManualSenses(entity: Entity): Sense[] {
  const f = entity.features.find(ft => ft.id === MANUAL_SENSES_FEATURE_ID);
  if (!f) return [];
  return (f.effects ?? [])
    .filter(e => e.type === 'grant_sense' && e.senseType)
    .map(e => ({ type: e.senseType!, range: e.senseRange ?? 0, note: e.senseNote }));
}
function writeManualSenses(entity: Entity, senses: Sense[], rules: CampaignRules): Entity {
  const effects = senses.map(s => ({
    type: 'grant_sense' as const, target: 'senses', operation: 'add' as const,
    value: null, condition: null,
    senseType: s.type, senseRange: s.range, senseNote: s.note,
  }));
  const others = entity.features.filter(ft => ft.id !== MANUAL_SENSES_FEATURE_ID);
  const features = effects.length === 0 ? others : [...others, {
    id: MANUAL_SENSES_FEATURE_ID, name: 'Senses', description: 'Player-set senses.',
    source: { kind: 'campaign' as const, refId: MANUAL_SENSES_FEATURE_ID },
    level: null, effects, actions: [], choices: [], passive: true, isActive: true,
  }];
  return recomputeDerived({ ...entity, features }, rules);
}

// ── Manual movement helpers ──────────────────────────────────────────────────
// Same shape as manual senses above — a dedicated campaign-sourced feature
// the player edits directly, for a mid-session grant (gained a climbing
// speed from an in-game event, not a race/feat/item the content pipeline
// already knows about).
type ManualMove = { type: MoveType; range: number };
function readManualMovement(entity: Entity): ManualMove[] {
  const f = entity.features.find(ft => ft.id === MANUAL_MOVEMENT_FEATURE_ID);
  if (!f) return [];
  return (f.effects ?? [])
    .filter(e => e.type === 'grant_movement' && e.movementType)
    .map(e => ({ type: e.movementType as MoveType, range: e.movementRange ?? 0 }));
}
function writeManualMovement(entity: Entity, moves: ManualMove[], rules: CampaignRules): Entity {
  const effects = moves.map(m => ({
    type: 'grant_movement' as const, target: 'movement', operation: 'add' as const,
    value: null, condition: null,
    movementType: m.type, movementRange: m.range,
  }));
  const others = entity.features.filter(ft => ft.id !== MANUAL_MOVEMENT_FEATURE_ID);
  const features = effects.length === 0 ? others : [...others, {
    id: MANUAL_MOVEMENT_FEATURE_ID, name: 'Movement', description: 'Player-set movement speeds.',
    source: { kind: 'campaign' as const, refId: MANUAL_MOVEMENT_FEATURE_ID },
    level: null, effects, actions: [], choices: [], passive: true, isActive: true,
  }];
  return recomputeDerived({ ...entity, features }, rules);
}

// Toggle a manual "exploration" star on a feature (persisted via explorationTag).
function toggleExplorationTag(entity: Entity, featureId: string, rules: CampaignRules): Entity {
  const features = entity.features.map(f =>
    f.id === featureId ? { ...f, explorationTag: !f.explorationTag } : f
  );
  return recomputeDerived({ ...entity, features }, rules);
}

function makeAdHocFeatChoice(): import('../../engine/types').ChoiceState {
  const id = `adhoc_feat_${Date.now().toString(36)}`;
  return {
    id, grantedAt: 0, resolved: false, selections: [],
    definition: { id, prompt: 'Take a feat', kind: 'asi', count: 1, pool: 'all', grants: [], required: false, resolved: false },
  };
}

function TabExplorationInner({
  entity, rules, onEntityUpdate, onDamage, onHeal, onAddCondition, onRemoveCondition, onSaveExplorationNotes,
}: Props) {
  const [sensesOpen, setSensesOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [addFeatOpen, setAddFeatOpen] = useState(false);
  const [hpOpen, setHpOpen] = useState(false);
  // Concentration-check trigger on damage — TabCharacter.tsx has always had
  // this via its own local handleDamage wrapper; TabExploration's HpModal
  // called the raw onDamage prop directly with no such wrapper, so damage
  // taken while this tab was open never prompted a concentration save
  // (audit finding CONCENTRATION-EXPLORE-1). Same "read fresh state after
  // onDamage, since Zustand updates synchronously" pattern as TabCharacter.
  const [concOpen, setConcOpen] = useState(false);
  const [concDamage, setConcDamage] = useState(0);
  function handleDamage(amount: number, damageType?: string) {
    onDamage(amount, damageType);
    const fresh = useCharacterStore.getState().characters.find(c => c.id === entity.id);
    if (fresh?.spellcasting?.concentrating) {
      setConcDamage(amount);
      setConcOpen(true);
    }
  }
  const [condOpen, setCondOpen] = useState(false);
  const [customCond, setCustomCond] = useState('');
  const [spellDetail, setSpellDetail] = useState<Spell | null>(null);
  // Favorites (starred via explorationTag) are always visible above the fold,
  // with their own collapse toggle; the full feature list is a dropdown,
  // collapsed by default so this section doesn't dominate the scroll.
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const rollAndLog = useDiceLogStore(s => s.rollAndLog);

  const { resources, derived, skills, proficiencies, inventory, conditions, conditionMonitor, features } = entity;
  const effectiveStats = applyStatModifiers(entity.stats, collectAllEffects(entity));

  function skillBonus(name: SkillName, ability: Ability): number {
    const entry = skills.skills[name];
    const profMult = entry?.expertise ? 2 : entry?.trained ? 1 : 0;
    return modifier(effectiveStats[ability]) + derived.proficiencyBonus * profMult + (entry?.bonus ?? 0);
  }
  function rollSkill(name: SkillName, label: string, ability: Ability) {
    const b = skillBonus(name, ability);
    rollAndLog(`1d20${b >= 0 ? '+' : ''}${b}`, `${label} check`);
  }

  function itemName(inst: ItemInstance): string {
    return itemRepo.getItemSync(inst.itemId)?.name ?? inst.itemId;
  }
  const allInv = [...inventory.equipped, ...inventory.carried];
  const languages = proficiencies.languages ?? [];
  const tools = proficiencies.tools ?? [];

  // Notes
  const notes = parseNotes(entity.explorationNotes, entity.notes);
  function updateNotes(next: StructuredNotes) { onSaveExplorationNotes(serializeNotes(next)); }

  // Features list — favorites (starred) shown separately from the full list
  const allFeatures = features.filter(f => f.id !== MANUAL_SENSES_FEATURE_ID && f.id !== MANUAL_MOVEMENT_FEATURE_ID);
  const favoriteFeatures = allFeatures.filter(f => f.explorationTag === true);

  // Movement rows
  const move = derived.movement;
  const moveRows = [
    { label: 'Walking', value: derived.speed },
    { label: 'Fly',     value: move.fly },
    { label: 'Swim',    value: move.swim },
    { label: 'Climb',   value: move.climb },
    ...(move.burrow ? [{ label: 'Burrow', value: move.burrow }] : []),
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Vitals — HP tappable to edit */}
      <View style={styles.vitalsRow}>
        <Pressable style={styles.vitalBox} onPress={() => setHpOpen(true)}>
          <Text style={styles.vitalValue}>{resources.hp.current}/{resources.hp.maximum}</Text>
          <Text style={styles.vitalLabel}>HP  ✎</Text>
        </Pressable>
        <View style={styles.vitalBox}>
          <Text style={styles.vitalValue}>{derived.ac}</Text>
          <Text style={styles.vitalLabel}>AC</Text>
        </View>
        <View style={styles.vitalBox}>
          <Text style={styles.vitalValue}>{derived.speed} ft</Text>
          <Text style={styles.vitalLabel}>Speed</Text>
        </View>
      </View>

      {/* Travel */}
      <Section title="TRAVEL" action={{ label: '✎ Edit', onPress: () => setMovementOpen(true) }}>
        {moveRows.map(r => (
          <View key={r.label} style={styles.travelRow}>
            <Text style={styles.travelLabel}>{r.label}</Text>
            <Text style={[styles.travelVal, !r.value && styles.travelNone]}>
              {r.value ? `${r.value} ft` : '—'}
            </Text>
          </View>
        ))}
      </Section>

      {/* Passives */}
      <Section title="PASSIVE SCORES">
        <View style={styles.passiveRow}>
          <Passive label="Perception" value={derived.passivePerception} />
          <Passive label="Investigation" value={derived.passiveInvestigation} />
          <Passive label="Insight" value={derived.passiveInsight} />
        </View>
      </Section>

      {/* Vision & senses */}
      <Section title="VISION & SENSES" action={{ label: '✎ Edit', onPress: () => setSensesOpen(true) }}>
        {derived.senses.length === 0
          ? <Text style={styles.emptyNote}>Normal vision only</Text>
          : <View style={styles.chipWrap}>
              {derived.senses.map(s => (
                <View key={s.type} style={styles.senseChip}>
                  <Text style={styles.senseChipTxt}>{SENSE_LABELS[s.type]} {s.range} ft{s.note ? ` · ${s.note}` : ''}</Text>
                </View>
              ))}
            </View>}
      </Section>

      {/* Skills — tap to roll */}
      <Section title="SKILLS  ·  tap to roll">
        {SKILLS.map(({ name, label, ability }) => {
          const b = skillBonus(name, ability);
          const entry = skills.skills[name];
          return (
            <Pressable key={name} style={styles.skillRow} onPress={() => rollSkill(name, label, ability)}>
              <View style={[styles.profDot, entry?.trained && styles.profDotActive, entry?.expertise && styles.profDotExpertise]} />
              <Text style={styles.skillLabel}>{label}</Text>
              <Text style={styles.skillAbility}>{ability.toUpperCase()}</Text>
              <Text style={styles.skillVal}>{b >= 0 ? `+${b}` : b}</Text>
            </Pressable>
          );
        })}
      </Section>

      {/* Languages */}
      <Section title="LANGUAGES">
        {languages.length === 0 ? <Text style={styles.emptyNote}>None</Text>
          : <View style={styles.chipWrap}>{languages.map(l => <Tag key={l} text={l} />)}</View>}
      </Section>

      {/* Tools */}
      <Section title="TOOLS">
        {tools.length === 0 ? <Text style={styles.emptyNote}>None</Text>
          : <View style={styles.chipWrap}>{tools.map(t => <Tag key={t} text={t} />)}</View>}
      </Section>

      {/* Conditions — add/remove */}
      <Section title="CONDITIONS" action={{ label: '+ Add', onPress: () => setCondOpen(true) }}>
        {conditions.length === 0 && conditionMonitor.exhaustion === 0
          ? <Text style={styles.emptyNote}>None</Text>
          : <View style={styles.chipWrap}>
              {conditions.map(c => (
                <Pressable key={c.id} style={styles.condChip} onPress={() => onRemoveCondition(c.id)}>
                  <Text style={styles.condChipTxt}>{c.id}  ✕</Text>
                </Pressable>
              ))}
              {conditionMonitor.exhaustion > 0 && (
                <View style={styles.condChip}><Text style={styles.condChipTxt}>Exhaustion {conditionMonitor.exhaustion}</Text></View>
              )}
            </View>}
      </Section>

      {/* Features & abilities — favorites always visible (collapsible),
          full list tucked behind a dropdown so this section stays compact. */}
      <Section
        title="FEATURES & ABILITIES"
        action={{ label: '+ Feat', onPress: () => setAddFeatOpen(true) }}
      >
        <Pressable style={styles.subHeader} onPress={() => setFavoritesCollapsed(v => !v)}>
          <Text style={styles.subHeaderTxt}>★ FAVORITES ({favoriteFeatures.length})</Text>
          <Text style={styles.chevron}>{favoritesCollapsed ? '▸' : '▾'}</Text>
        </Pressable>
        {!favoritesCollapsed && (
          favoriteFeatures.length === 0
            ? <Text style={styles.emptyNote}>No favorites yet — tap a star below to pin a feature here.</Text>
            : favoriteFeatures.map(f => (
                <FeatureRow key={f.id} feature={f}
                  onToggleStar={() => onEntityUpdate(toggleExplorationTag(entity, f.id, rules))} />
              ))
        )}

        <Pressable style={styles.subHeader} onPress={() => setFeaturesExpanded(v => !v)}>
          <Text style={styles.subHeaderTxt}>ALL FEATURES ({allFeatures.length})</Text>
          <Text style={styles.chevron}>{featuresExpanded ? '▾' : '▸'}</Text>
        </Pressable>
        {featuresExpanded && (
          allFeatures.length === 0
            ? <Text style={styles.emptyNote}>None</Text>
            : allFeatures.map(f => (
                <FeatureRow key={f.id} feature={f}
                  onToggleStar={() => onEntityUpdate(toggleExplorationTag(entity, f.id, rules))} />
              ))
        )}
      </Section>

      {/* Spells — grouped by level, tap for description */}
      {entity.spellcasting && (
        <Section title="SPELLS">
          {/* Slots */}
          <View style={styles.slotsWrap}>
            {Object.entries(entity.spellcasting.slots)
              .filter(([, slot]) => slot.total > 0)
              .map(([tier, slot]) => (
                <View key={tier} style={styles.slotChip}>
                  <Text style={styles.slotChipTxt}>L{tier}: {slot.total - slot.used}/{slot.total}</Text>
                </View>
              ))}
          </View>
          <SpellList
            ids={[...entity.spellcasting.cantrips, ...entity.spellcasting.known]}
            onTap={setSpellDetail}
          />
        </Section>
      )}

      {/* Inventory quick view */}
      <Section title="INVENTORY">
        {allInv.length === 0 ? <Text style={styles.emptyNote}>Empty</Text>
          : allInv.map((inst, idx) => (
              <View key={`${inst.itemId}_${idx}`} style={styles.invRow}>
                <Text style={styles.invName}>{itemName(inst)}</Text>
                {inst.quantity > 1 && <Text style={styles.invQty}>×{inst.quantity}</Text>}
              </View>
            ))}
      </Section>

      {/* Notes & clues */}
      <NotesSection notes={notes} onChange={updateNotes} />

      {/* ── Modals ── */}
      <HpModal
        visible={hpOpen}
        currentHp={resources.hp.current}
        maxHp={resources.hp.maximum}
        onDamage={handleDamage}
        onHeal={(n) => { onHeal(n); }}
        onClose={() => setHpOpen(false)}
      />

      <ConcentrationModal
        visible={concOpen}
        damageTaken={concDamage}
        entity={useCharacterStore.getState().characters.find(c => c.id === entity.id) ?? entity}
        rules={rules}
        onResolve={updated => { onEntityUpdate(updated); setConcOpen(false); }}
        onClose={() => setConcOpen(false)}
      />

      <SensesModal visible={sensesOpen} entity={entity} rules={rules}
        onClose={() => setSensesOpen(false)} onUpdate={onEntityUpdate} />

      <MovementModal visible={movementOpen} entity={entity} rules={rules}
        onClose={() => setMovementOpen(false)} onUpdate={onEntityUpdate} />

      {/* Condition picker */}
      <Modal visible={condOpen} transparent animationType="slide" onRequestClose={() => setCondOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCondOpen(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Add Condition</Text>
            <View style={styles.chipWrap}>
              {COMMON_CONDITIONS.map(c => (
                <Pressable key={c} style={styles.typeChip} onPress={() => { onAddCondition(c, null); setCondOpen(false); }}>
                  <Text style={styles.typeChipTxt}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.emptyNote}>
              Or track a spell effect / status that isn't a standard condition
              (Silence, magical Darkness, a curse, etc.) — reminder only, no
              mechanical enforcement, same as the 12 above beyond what's listed.
            </Text>
            <View style={styles.senseInputRow}>
              <TextInput style={[styles.input, { flex: 1 }]} value={customCond} onChangeText={setCustomCond}
                placeholder="e.g. Silenced (spell)" placeholderTextColor={Colors.textDim} />
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  const name = customCond.trim();
                  if (!name) return;
                  onAddCondition(name, null);
                  setCustomCond('');
                  setCondOpen(false);
                }}
              >
                <Text style={styles.primaryBtnTxt}>Add</Text>
              </Pressable>
            </View>
            <Pressable style={styles.secondaryBtn} onPress={() => setCondOpen(false)}>
              <Text style={styles.secondaryBtnTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Spell detail */}
      <Modal visible={!!spellDetail} transparent animationType="slide" onRequestClose={() => setSpellDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSpellDetail(null)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {spellDetail && (
              <ScrollView>
                <Text style={styles.spellDetailName}>{spellDetail.name}</Text>
                <Text style={styles.spellDetailMeta}>
                  {spellDetail.level === 0 ? 'Cantrip' : `Level ${spellDetail.level}`} · {spellDetail.school}
                  {spellDetail.concentration ? ' · Concentration' : ''}{spellDetail.ritual ? ' · Ritual' : ''}
                </Text>
                <Text style={styles.spellDetailMeta}>
                  {spellDetail.castingTime} · {spellDetail.range} · {spellDetail.duration}
                </Text>
                <Text style={styles.spellDetailBody}>{spellDetail.description}</Text>
                {spellDetail.upcast && (
                  <Text style={styles.spellDetailUpcast}>At Higher Levels: {spellDetail.upcast}</Text>
                )}
              </ScrollView>
            )}
            <Pressable style={styles.secondaryBtn} onPress={() => setSpellDetail(null)}>
              <Text style={styles.secondaryBtnTxt}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add feat */}
      <Modal visible={addFeatOpen} animationType="slide" onRequestClose={() => setAddFeatOpen(false)}>
        <View style={styles.modalRoot}>
          <AsiFeatPicker entity={entity} choice={makeAdHocFeatChoice()} rules={rules} featOnly
            onClose={() => setAddFeatOpen(false)}
            onResolved={(updated) => { onEntityUpdate(updated); setAddFeatOpen(false); }}
            browseStateKey="feat:live" />
        </View>
      </Modal>

    </ScrollView>
  );
}

// EDIT-PERF-1: see TabCharacter.tsx's identical comment.
export const TabExploration = memo(TabExplorationInner);

// ── Feature row (favorite star + name/description) ──────────────────────────
function FeatureRow({ feature, onToggleStar }: {
  feature: Entity['features'][number]; onToggleStar: () => void;
}) {
  const tagged = feature.explorationTag === true;
  return (
    <View style={styles.featRow}>
      <Pressable hitSlop={8} onPress={onToggleStar}>
        <Text style={[styles.star, tagged && styles.starActive]}>{tagged ? '★' : '☆'}</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.featName}>{feature.name}</Text>
        {!!feature.description && <Text style={styles.featDesc} numberOfLines={2}>{feature.description}</Text>}
      </View>
    </View>
  );
}

// ── Spell list grouped by level ──────────────────────────────────────────────
function SpellList({ ids, onTap }: { ids: string[]; onTap: (s: Spell) => void }) {
  const resolved = ids
    .map(id => spellRepo.getSpellSync(id))
    .filter((s): s is Spell => !!s)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const unknown = ids.filter(id => !spellRepo.getSpellSync(id));

  if (resolved.length === 0 && unknown.length === 0) {
    return <Text style={styles.emptyNote}>None known</Text>;
  }
  return (
    <View style={{ gap: 4 }}>
      {resolved.map(s => (
        <Pressable key={s.id} style={styles.spellRow} onPress={() => onTap(s)}>
          <View style={styles.spellLevelBadge}>
            <Text style={styles.spellLevelTxt}>{s.level === 0 ? 'C' : s.level}</Text>
          </View>
          <Text style={styles.spellName}>{s.name}</Text>
          {s.concentration && <Text style={styles.spellConc}>C</Text>}
        </Pressable>
      ))}
      {unknown.map(id => (
        <View key={id} style={styles.spellRow}>
          <View style={styles.spellLevelBadge}><Text style={styles.spellLevelTxt}>?</Text></View>
          <Text style={styles.spellName}>{id}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Notes & clues ────────────────────────────────────────────────────────────
const NOTE_CATEGORIES: { key: NoteCategory; label: string }[] = [
  { key: 'objectives', label: 'Objectives' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'clues', label: 'Clues' },
  { key: 'locations', label: 'Locations' },
];

function NotesSection({ notes, onChange }: { notes: StructuredNotes; onChange: (n: StructuredNotes) => void }) {
  const [drafts, setDrafts] = useState<Record<NoteCategory, string>>({ objectives: '', npcs: '', clues: '', locations: '' });
  const [scratch, setScratch] = useState(notes.scratch);

  function addItem(cat: NoteCategory) {
    const v = drafts[cat].trim();
    if (!v) return;
    onChange({ ...notes, [cat]: [...notes[cat], v] });
    setDrafts(d => ({ ...d, [cat]: '' }));
  }
  function removeItem(cat: NoteCategory, idx: number) {
    onChange({ ...notes, [cat]: notes[cat].filter((_, i) => i !== idx) });
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>NOTES & CLUES</Text>
      {NOTE_CATEGORIES.map(({ key, label }) => (
        <View key={key} style={styles.noteCat}>
          <Text style={styles.noteCatLabel}>{label}</Text>
          {notes[key].map((item, idx) => (
            <View key={idx} style={styles.noteItem}>
              <Text style={styles.noteItemTxt}>• {item}</Text>
              <Pressable hitSlop={8} onPress={() => removeItem(key, idx)}>
                <Text style={styles.noteX}>✕</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.noteInputRow}>
            <TextInput
              style={styles.noteInput}
              value={drafts[key]}
              onChangeText={t => setDrafts(d => ({ ...d, [key]: t }))}
              placeholder={`Add ${label.toLowerCase()}…`}
              placeholderTextColor={Colors.textDim}
              onSubmitEditing={() => addItem(key)}
            />
            <Pressable style={styles.noteAddBtn} onPress={() => addItem(key)}>
              <Text style={styles.noteAddTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {/* Free-text scratch */}
      <Text style={styles.noteCatLabel}>Scratch</Text>
      <TextInput
        style={[styles.noteInput, styles.scratchInput]}
        value={scratch}
        onChangeText={setScratch}
        onBlur={() => onChange({ ...notes, scratch })}
        placeholder="Anything else…"
        placeholderTextColor={Colors.textDim}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────
function Passive({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.passiveBox}>
      <Text style={styles.passiveValue}>{value}</Text>
      <Text style={styles.passiveLabel}>{label}</Text>
    </View>
  );
}
function Tag({ text }: { text: string }) {
  return <View style={styles.tag}><Text style={styles.tagTxt}>{text}</Text></View>;
}
function Section({ title, action, children }: {
  title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && (
          <Pressable style={styles.sectionAction} onPress={action.onPress}>
            <Text style={styles.sectionActionTxt}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

// ── Senses editor modal ──────────────────────────────────────────────────────
function SensesModal({ visible, entity, rules, onUpdate, onClose }: {
  visible: boolean; entity: Entity; rules: CampaignRules; onUpdate: (u: Entity) => void; onClose: () => void;
}) {
  const manual = readManualSenses(entity);
  const [type, setType] = useState<SenseType>('darkvision');
  const [range, setRange] = useState('60');
  const [note, setNote] = useState('');

  function addSense() {
    const r = parseInt(range, 10);
    if (isNaN(r) || r <= 0) return;
    onUpdate(writeManualSenses(entity, [...manual.filter(s => s.type !== type), { type, range: r, note: note.trim() || undefined }], rules));
    setNote('');
  }
  function removeSense(t: string) {
    onUpdate(writeManualSenses(entity, manual.filter(s => s.type !== t), rules));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Senses</Text>
          {manual.length > 0 && (
            <View style={styles.chipWrap}>
              {manual.map(s => (
                <View key={s.type} style={styles.senseChip}>
                  <Text style={styles.senseChipTxt}>{SENSE_LABELS[s.type]} {s.range}ft{s.note ? ` · ${s.note}` : ''}</Text>
                  <Pressable onPress={() => removeSense(s.type)} hitSlop={8}><Text style={styles.senseX}>✕</Text></Pressable>
                </View>
              ))}
            </View>
          )}
          <View style={styles.chipWrap}>
            {SENSE_TYPE_OPTIONS.map(t => (
              <Pressable key={t} style={[styles.typeChip, type === t && styles.typeChipActive]} onPress={() => setType(t)}>
                <Text style={[styles.typeChipTxt, type === t && styles.typeChipTxtActive]}>{SENSE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.senseInputRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={range} onChangeText={setRange}
              keyboardType="number-pad" placeholder="Range" placeholderTextColor={Colors.textDim} />
            <TextInput style={[styles.input, { flex: 2 }]} value={note} onChangeText={setNote}
              placeholder="Note (e.g. in color)" placeholderTextColor={Colors.textDim} />
          </View>
          <Pressable style={styles.primaryBtn} onPress={addSense}><Text style={styles.primaryBtnTxt}>Add / Update Sense</Text></Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onClose}><Text style={styles.secondaryBtnTxt}>Done</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Movement editor modal ────────────────────────────────────────────────────
// Same pattern as SensesModal — for a speed gained mid-session (a climbing
// speed from a magic pool, a temporary fly speed, etc.) that isn't coming
// from a race/feat/item the content pipeline already grants.
function MovementModal({ visible, entity, rules, onUpdate, onClose }: {
  visible: boolean; entity: Entity; rules: CampaignRules; onUpdate: (u: Entity) => void; onClose: () => void;
}) {
  const manual = readManualMovement(entity);
  const [type, setType] = useState<MoveType>('climb');
  const [range, setRange] = useState('30');

  function addMove() {
    const r = parseInt(range, 10);
    if (isNaN(r) || r <= 0) return;
    onUpdate(writeManualMovement(entity, [...manual.filter(m => m.type !== type), { type, range: r }], rules));
  }
  function removeMove(t: MoveType) {
    onUpdate(writeManualMovement(entity, manual.filter(m => m.type !== t), rules));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Movement</Text>
          <Text style={styles.emptyNote}>
            Walking speed comes from your race/class — this is for extra movement types
            (climbing, swimming, flying, burrowing) gained mid-campaign.
          </Text>
          {manual.length > 0 && (
            <View style={styles.chipWrap}>
              {manual.map(m => (
                <View key={m.type} style={styles.senseChip}>
                  <Text style={styles.senseChipTxt}>{MOVE_TYPE_LABELS[m.type]} {m.range}ft</Text>
                  <Pressable onPress={() => removeMove(m.type)} hitSlop={8}><Text style={styles.senseX}>✕</Text></Pressable>
                </View>
              ))}
            </View>
          )}
          <View style={styles.chipWrap}>
            {MOVE_TYPE_OPTIONS.map(t => (
              <Pressable key={t} style={[styles.typeChip, type === t && styles.typeChipActive]} onPress={() => setType(t)}>
                <Text style={[styles.typeChipTxt, type === t && styles.typeChipTxtActive]}>{MOVE_TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.senseInputRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={range} onChangeText={setRange}
              keyboardType="number-pad" placeholder="Speed (ft)" placeholderTextColor={Colors.textDim} />
          </View>
          <Pressable style={styles.primaryBtn} onPress={addMove}><Text style={styles.primaryBtnTxt}>Add / Update Speed</Text></Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onClose}><Text style={styles.secondaryBtnTxt}>Done</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  vitalsRow: { flexDirection: 'row', gap: Spacing.sm },
  vitalBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center', gap: 2 },
  vitalValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  vitalLabel: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 1 },

  section: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  sectionAction: { backgroundColor: Colors.gold + '22', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold + '66', paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  sectionActionTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },

  travelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  travelLabel: { fontSize: FontSize.sm, color: Colors.textPrimary },
  travelVal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  travelNone: { color: Colors.textDim, fontWeight: FontWeight.normal },

  passiveRow: { flexDirection: 'row', gap: Spacing.sm },
  passiveBox: { flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, alignItems: 'center', gap: 2 },
  passiveValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  passiveLabel: { fontSize: 9, color: Colors.textSecondary, textAlign: 'center' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tag: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  tagTxt: { fontSize: FontSize.xs, color: Colors.textPrimary },

  senseChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.blue + '22', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.blue + '55', paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  senseChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  senseX: { color: Colors.red, fontSize: FontSize.sm },

  condChip: { backgroundColor: Colors.red + '22', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.red + '55', paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  condChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },

  skillRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  skillLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  skillAbility: { fontSize: FontSize.xs, color: Colors.textDim, width: 28 },
  skillVal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, width: 40, textAlign: 'right' },
  profDot: { width: 10, height: 10, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.textDim },
  profDotActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  profDotExpertise: { backgroundColor: Colors.blue, borderColor: Colors.blue },

  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  subHeaderTxt: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold, letterSpacing: 1 },
  chevron: { fontSize: FontSize.xs, color: Colors.textDim },
  star: { fontSize: FontSize.lg, color: Colors.textDim },
  starActive: { color: Colors.gold },

  invRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  invName: { fontSize: FontSize.sm, color: Colors.textPrimary },
  invQty: { fontSize: FontSize.sm, color: Colors.textDim },

  featRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  featName: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  featDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },

  // Spells
  slotsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  slotChip: { backgroundColor: Colors.purple + '22', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.purple + '55', paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  slotChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  spellRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  spellLevelBadge: { width: 22, height: 22, borderRadius: Radius.full, backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  spellLevelTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gold },
  spellName: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  spellConc: { fontSize: FontSize.xs, color: Colors.blue, fontWeight: FontWeight.bold },
  spellDetailName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  spellDetailMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  spellDetailBody: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20, marginTop: Spacing.sm },
  spellDetailUpcast: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.sm },

  // Notes
  noteCat: { gap: 4 },
  noteCatLabel: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1, marginTop: Spacing.xs },
  noteItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  noteItemTxt: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  noteX: { color: Colors.red, fontSize: FontSize.sm, paddingHorizontal: 6 },
  noteInputRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  noteInput: { flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 6, color: Colors.textPrimary, fontSize: FontSize.sm },
  scratchInput: { minHeight: 60, marginTop: 4 },
  noteAddBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, width: 36, alignItems: 'center', justifyContent: 'center' },
  noteAddTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.lg },

  emptyNote: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic' },

  // Modals
  modalRoot: { flex: 1, backgroundColor: Colors.bg },
  backdrop: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surfaceHigh, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '80%' },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  typeChip: { backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  typeChipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  typeChipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  typeChipTxtActive: { color: Colors.gold },
  senseInputRow: { flexDirection: 'row', gap: Spacing.sm },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  primaryBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  primaryBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  secondaryBtn: { padding: Spacing.sm, alignItems: 'center' },
  secondaryBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.sm },
});
