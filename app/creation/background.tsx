// app/creation/background.tsx
// Background list + detail page with personality trait selectors.
import { View, Text, FlatList, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { globalContentDB } from '../../src/content/classes/library';
import { Background, SkillName, Ability, Feature, BACKGROUND_CHOICE_PREFIX } from '../../src/engine/types';
import { applyGrant, queueChoice } from '../../src/engine/leveling';
import { revokeResourceSource } from '../../src/engine/entitlements';
import { applyStatModifiers, collectAllEffects } from '../../src/engine/pipeline';
import { backgroundSkillGrants, backgroundSortOptions } from '../../src/content/backgrounds/backgroundBrowse';
import { sortByOption } from '../../src/content/contentQuery';
import { SortControl } from '../../src/components/SortControl';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { NonSrdBadge, isNonSrd } from '../../src/components/NonSrdBadge';
import {
  FilterChipRow, MultiSelectChipRow, FilterSection, OfficialHomebrewChipRow,
  ActiveFilterChips, ZeroResultsState,
} from '../../src/components/FilterChipRow';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { useBrowseStateStore } from '../../src/store/browseStateStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';

const SCREEN_KEY = 'background_picker';

// ── BG_DETAIL — flavor-only data for the 13 PHB backgrounds ────────────────
// FILTER-METADATA-2: this table used to ALSO carry skillProficiencies/
// toolProficiencies — those were retired from here. Skill proficiencies
// are already real, structured data on each Background's own Feature
// effects (see backgroundSkillGrants(), imported above); tool
// proficiencies are now a real field, Background.toolProficiencies (see
// src/content/backgrounds/index.ts). What's left here — the class-feature
// name and the personality trait/ideal/bond/flaw picker options — is
// genuinely UI-only flavor text with no mechanical meaning, so it stays a
// screen-local table; nothing here is treated as authoritative content
// metadata anymore.
const BG_DETAIL: Record<string, {
  feature: string;
  traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
}> = {
  acolyte: {
    feature: 'Shelter of the Faithful',
    traits: ['I idolize a particular hero of my faith and constantly refer to their deeds.', 'I see omens in every event and action.'],
    ideals: ['Tradition', 'Charity', 'Change', 'Power'],
    bonds: ['I owe my life to the priest who took me in when my parents died.'],
    flaws: ['I am inflexible in my thinking.'],
  },
  charlatan: {
    feature: 'False Identity',
    traits: ['I fall in and out of love easily and am always pursuing someone.', 'I have a joke for every occasion.'],
    ideals: ['Independence', 'Fairness', 'Charity', 'Creativity'],
    bonds: ['I fleeced the wrong person and must work to repay my debt.'],
    flaws: ["I can't resist a pretty face."],
  },
  criminal: {
    feature: 'Criminal Contact',
    traits: ['I always have a plan for when things go wrong.', 'I am always calm, no matter what the situation.'],
    ideals: ['Honor', 'Freedom', 'Charity', 'Redemption'],
    bonds: ["I'm trying to pay off an old debt I owe to a generous benefactor."],
    flaws: ['When I see something valuable, I can\'t think of anything but how to steal it.'],
  },
  entertainer: {
    feature: 'By Popular Demand',
    traits: ['I know a story relevant to almost every situation.', 'I love a good insult, even one directed at me.'],
    ideals: ['Beauty', 'Tradition', 'Creativity', 'Greed'],
    bonds: ['I want to be famous, whatever it takes.'],
    flaws: ["I'm a sucker for a pretty face."],
  },
  folk_hero: {
    feature: 'Rustic Hospitality',
    traits: ['I judge people by their actions, not their words.', "I'm confident in my own abilities and do what I can to instill confidence in others."],
    ideals: ['Respect', 'Fairness', 'Freedom', 'Might'],
    bonds: ['I protect those who cannot protect themselves.'],
    flaws: ['The tyrant who rules my land will stop at nothing to see me captured or dead.'],
  },
  guild_artisan: {
    feature: 'Guild Membership',
    traits: ['I believe that anything worth doing is worth doing right.', "I'm rude to people who slack off at their work."],
    ideals: ['Community', 'Generosity', 'Freedom', 'Aspiration'],
    bonds: ['The workshop where I learned my trade is the most important place in the world to me.'],
    flaws: ["I'll do anything to get my hands on something rare or priceless."],
  },
  hermit: {
    feature: 'Discovery',
    traits: ["I've been isolated for so long that I rarely speak, preferring gestures and the occasional grunt.", 'I am utterly serene, even in the face of disaster.'],
    ideals: ['Greater Good', 'Logic', 'Free Thinking', 'Self-Knowledge'],
    bonds: ['I entered seclusion to hide from those who might still be hunting me.'],
    flaws: ['I like keeping secrets and won\'t share them with anyone.'],
  },
  noble: {
    feature: 'Position of Privilege',
    traits: ['My eloquent flattery makes everyone I talk to feel like the most wonderful and important person in the world.', 'The common folk love me for my kindness and generosity.'],
    ideals: ['Respect', 'Responsibility', 'Independence', 'Power'],
    bonds: ['I will face any challenge to win the approval of my family.'],
    flaws: ['I secretly believe that everyone is beneath me.'],
  },
  outlander: {
    feature: 'Wanderer',
    traits: ["I'm driven by a wanderlust that led me away from home.", 'I watch over my friends as if they were a litter of newborn pups.'],
    ideals: ['Change', 'Greater Good', 'Independence', 'Might'],
    bonds: ['My family, clan, or tribe is the most important thing in my life.'],
    flaws: ['I am slow to trust members of other races, tribes, and societies.'],
  },
  sage: {
    feature: 'Researcher',
    traits: ['I use polysyllabic words that convey the impression of great erudition.', "I've read every book in the world's greatest libraries — or I like to boast that I have."],
    ideals: ['Knowledge', 'Beauty', 'Logic', 'Power'],
    bonds: ['I have an ancient text that holds terrible secrets that must not fall into the wrong hands.'],
    flaws: ['I am easily distracted by the promise of information.'],
  },
  sailor: {
    feature: "Ship's Passage",
    traits: ['My friends know they can rely on me, no matter what.', 'I work hard so that I can play hard when the work is done.'],
    ideals: ['Respect', 'Fairness', 'Freedom', 'Mastery'],
    bonds: ["I'm loyal to my captain first, everything else second."],
    flaws: ['I follow orders, even if I think they\'re wrong.'],
  },
  soldier: {
    feature: 'Military Rank',
    traits: [
      'I am always polite and respectful.',
      'I face problems head-on.',
      'I have a crude sense of humor.',
      'I enjoy being strong and like breaking things.',
    ],
    ideals: ['Greater Good', 'Responsibility', 'Independence', 'Might'],
    bonds: ['I would still lay down my life for the people I served with.', 'Someone saved my life. I owe them.'],
    flaws: ['I made a terrible mistake in battle that haunts me.', 'I obey the law even if the law causes misery.'],
  },
  urchin: {
    feature: 'City Secrets',
    traits: ['I hide scraps of food and trinkets away in my pockets.', 'I ask a lot of questions.'],
    ideals: ['Respect', 'Community', 'Change', 'Aspiration'],
    bonds: ['I escaped my life of poverty by robbing an important person.'],
    flaws: ["If I'm outnumbered, I will run away from a fight."],
  },
};

// ── List screen ───────────────────────────────────────────────────────────────

export default function BackgroundScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { detail } = useLocalSearchParams<{ detail?: string }>();
  const homebrewBackgrounds = useHomebrewStore(s => s.backgrounds);
  // SAVE-AND-ADD-1: returning from "+ Create new homebrew background" —
  // go straight to that background's own detail view, the same place
  // tapping it in the list would take the player. useFocusEffect (not a
  // plain useEffect on homebrewBackgrounds) — see race.tsx's identical
  // comment for why: a plain effect races against the builder's own
  // goBack() and usually loses, since this screen's homebrewStore
  // subscription updates the instant the builder saves, while still
  // unfocused/backgrounded behind it.
  useFocusEffect(
    useCallback(() => {
      const newId = usePendingSelectionStore.getState().consumePending('background_picker');
      if (newId) router.replace(`/creation/background?detail=${newId}`);
    }, [router])
  );
  const saved = useBrowseStateStore.getState().getBrowseState(SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const savedFilters = saved.filters ?? {};
  const [search, setSearch] = useState(saved.search ?? '');
  // Ruleset — real field, sparsely populated (only the paused 5.5e proof
  // slice's Acolyte variant sets it today) — FilterChipRow auto-hides at
  // <=1 option. Equipment/granted-feat filters are NOT offered: Background
  // carries no structured fields for either (classic PHB backgrounds grant
  // neither; only a 2024-style background would, via a mechanism that
  // doesn't exist yet).
  const [rulesetFilter, setRulesetFilter] = useState<string | null>((savedFilters.rulesetFilter as string) ?? null);
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>((savedFilters.officialFilter as 'all' | 'official' | 'homebrew') ?? 'all');
  // FILTER-METADATA-2: real, derived from each background's own Feature
  // effects (official) or an equivalent homebrew grant — see
  // backgroundSkillGrants(). Tool Proficiency is real too, now a direct
  // field (Background.toolProficiencies) rather than trapped in BG_DETAIL.
  const [skillFilter, setSkillFilter] = useState<Set<SkillName>>(new Set((savedFilters.skillFilter as SkillName[]) ?? []));
  const [toolFilter, setToolFilter] = useState<Set<string>>(new Set((savedFilters.toolFilter as string[]) ?? []));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState(saved.sort ?? 'name_asc');
  const sortOptions = backgroundSortOptions(b => homebrewBackgrounds.some(hb => hb.id === b.id));
  useEffect(() => {
    setBrowseState(SCREEN_KEY, {
      search, sort,
      filters: { rulesetFilter, officialFilter, skillFilter: Array.from(skillFilter), toolFilter: Array.from(toolFilter) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, rulesetFilter, officialFilter, skillFilter, toolFilter]);

  // If ?detail=id is in the URL, show the detail view inline. This branch comes
  // AFTER all hooks above so hook order stays identical across renders.
  if (detail) return <BackgroundDetail id={detail} />;

  const availableRulesets = Array.from(new Set(globalContentDB.backgrounds.map(b => b.rulesetId).filter((r): r is NonNullable<typeof r> => !!r)))
    .map(String).sort().map(r => ({ id: r, label: r }));
  const availableSkills = (Array.from(new Set(globalContentDB.backgrounds.flatMap(backgroundSkillGrants))) as SkillName[])
    .sort().map(s => ({ id: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
  const availableTools = Array.from(new Set(globalContentDB.backgrounds.flatMap(b => b.toolProficiencies ?? [])))
    .sort().map(t => ({ id: t, label: t }));

  const backgrounds = officialFilter === 'homebrew' ? [] : sortByOption(globalContentDB.backgrounds.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) &&
    (!rulesetFilter || b.rulesetId === rulesetFilter) &&
    (skillFilter.size === 0 || Array.from(skillFilter).some(s => backgroundSkillGrants(b).includes(s))) &&
    (toolFilter.size === 0 || Array.from(toolFilter).some(t => (b.toolProficiencies ?? []).includes(t)))
  ), sortOptions, sort);
  const filteredHomebrewBackgrounds = officialFilter === 'official' ? [] : sortByOption(homebrewBackgrounds.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) &&
    (skillFilter.size === 0 || Array.from(skillFilter).some(s => backgroundSkillGrants(b).includes(s))) &&
    (toolFilter.size === 0 || Array.from(toolFilter).some(t => (b.toolProficiencies ?? []).includes(t)))
  ), sortOptions, sort);
  const activeFilterChips = [
    ...(rulesetFilter ? [{ key: 'ruleset', label: rulesetFilter, onClear: () => setRulesetFilter(null) }] : []),
    ...(officialFilter !== 'all' ? [{ key: 'official', label: officialFilter === 'official' ? 'Official' : 'Homebrew', onClear: () => setOfficialFilter('all') }] : []),
    ...Array.from(skillFilter).map(s => ({ key: `skill_${s}`, label: s, onClear: () => setSkillFilter(prev => { const n = new Set(prev); n.delete(s); return n; }) })),
    ...Array.from(toolFilter).map(t => ({ key: `tool_${t}`, label: t, onClear: () => setToolFilter(prev => { const n = new Set(prev); n.delete(t); return n; }) })),
  ];
  function clearAllFilters() {
    setRulesetFilter(null); setOfficialFilter('all'); setSkillFilter(new Set()); setToolFilter(new Set());
  }
  const noResults = backgrounds.length === 0 && filteredHomebrewBackgrounds.length === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Select Background</Text>
      <View style={styles.divider} />

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.search, styles.searchFlex]}
          placeholder="Search"
          placeholderTextColor={Colors.textDim}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.filtersToggle, filtersOpen && styles.filtersToggleActive]}
          onPress={() => setFiltersOpen(v => !v)}
        >
          <Text style={[styles.filtersToggleTxt, filtersOpen && styles.filtersToggleTxtActive]}>Filters</Text>
        </Pressable>
        <SortControl options={sortOptions} value={sort} onChange={setSort} />
      </View>

      {filtersOpen && (
        <View style={styles.filterPanel}>
          <FilterSection label="Ruleset">
            <FilterChipRow options={availableRulesets} value={rulesetFilter} onChange={setRulesetFilter} />
          </FilterSection>
          <FilterSection label="Skill Proficiency">
            <MultiSelectChipRow options={availableSkills} values={skillFilter} onChange={setSkillFilter} scrollable />
          </FilterSection>
          <FilterSection label="Tool Proficiency">
            <MultiSelectChipRow options={availableTools} values={toolFilter} onChange={setToolFilter} scrollable />
          </FilterSection>
          <FilterSection label="Official / Homebrew">
            <OfficialHomebrewChipRow value={officialFilter} onChange={setOfficialFilter} />
          </FilterSection>
        </View>
      )}
      <ActiveFilterChips chips={activeFilterChips} onClearAll={clearAllFilters} />

      {noResults ? (
        <ZeroResultsState
          hasActiveFilters={activeFilterChips.length > 0}
          emptyMessage="No backgrounds match your search."
          onClearFilters={clearAllFilters}
        />
      ) : (
        <FlatList
          data={backgrounds}
          keyExtractor={b => b.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xxl }]}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/creation/background?detail=${item.id}`)}
            >
              <Text style={styles.rowName}>{item.name}</Text>
              {/* Distinguishes same-named ruleset variants (e.g. the paused
                  5.5e proof-slice's "Acolyte" alongside the classic one) —
                  audit finding RULESET-DUP-1. */}
              {item.rulesetId && (
                <View style={styles.rulesetTag}>
                  <Text style={styles.rulesetTagTxt}>{item.rulesetId}</Text>
                </View>
              )}
              {isNonSrd(item.srd) && <NonSrdBadge />}
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          )}
          ListFooterComponent={
            <View style={styles.homebrewSection}>
              <View style={styles.homebrewHeader}>
                <Text style={styles.homebrewHeading}>HOMEBREW BACKGROUNDS</Text>
                <Pressable
                  style={styles.createNewBtn}
                  onPress={() => router.push('/homebrew/background-builder')}
                >
                  <Text style={styles.createNewTxt}>+ Create new</Text>
                </Pressable>
              </View>
              {filteredHomebrewBackgrounds.length === 0 ? (
                <Text style={styles.homebrewEmptyText}>No homebrew backgrounds yet.</Text>
              ) : (
                filteredHomebrewBackgrounds.map(item => (
                  <Pressable
                    key={item.id}
                    style={styles.row}
                    onPress={() => router.push(`/creation/background?detail=${item.id}`)}
                  >
                    <Text style={styles.rowName}>{item.name}</Text>
                    <View style={styles.homebrewTag}>
                      <Text style={styles.homebrewTagTxt}>Homebrew</Text>
                    </View>
                    <Text style={styles.rowArrow}>›</Text>
                  </Pressable>
                ))
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

function BackgroundDetail({ id }: { id: string }) {
  const router   = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const homebrewBackgroundIds = useHomebrewStore(s => s.backgrounds).map(b => b.id);

  // getMergedContentDB() (not a raw official-first concat) so a homebrew
  // background sharing an official id correctly wins — same
  // homebrew-wins-on-collision precedent used everywhere else content
  // merges happen (e.g. race-detail.tsx).
  const bg     = getMergedContentDB().backgrounds.find(b => b.id === id);
  const detail = BG_DETAIL[id];
  // FIXED (disclosed pre-existing bug): the "Homebrew" tag used to be
  // driven by `!detail` (no BG_DETAIL entry) — an official-but-undetailed
  // background (e.g. a future official 2024 background with no personality
  // table yet) would incorrectly show "Homebrew". Real membership check.
  const isHomebrew = !!bg && homebrewBackgroundIds.includes(bg.id);
  // FILTER-METADATA-2: skill proficiencies read straight from the
  // background's own Feature effects — real for both official AND
  // homebrew backgrounds, not just the 13 with a BG_DETAIL entry.
  const skillProficiencies = bg ? backgroundSkillGrants(bg) : [];
  const toolProficiencies  = bg?.toolProficiencies ?? [];

  const [trait, setTrait] = useState('');
  const [ideal, setIdeal] = useState('');
  const [bond,  setBond]  = useState('');
  const [flaw,  setFlaw]  = useState('');

  // Flexible ability score choice — the 2024 background-grants-ASI mechanic
  // (species lost the flat ASI in that revision). Same pattern as
  // race-detail.tsx's flexAsi, minus subrace/ancestry (backgrounds have
  // neither) — see Background.flexibleAsi's doc comment.
  const flexAsi = bg?.flexibleAsi ?? null;
  const [flexSubMode, setFlexSubMode] = useState<'2_1' | '3x1'>('2_1');
  const [flexPicks, setFlexPicks] = useState<Ability[]>([]);
  const flexRequiredCount = !flexAsi ? 0
    : flexAsi.mode.kind === 'two_distinct_plus_one' ? 2
    : flexSubMode === '2_1' ? 2 : 3;
  const flexComplete = !flexAsi || flexPicks.length === flexRequiredCount;
  const flexAbilityOptions: Ability[] = flexAsi?.mode.kind === 'two_one_or_three_one' && flexAsi.mode.restrictTo
    ? flexAsi.mode.restrictTo
    : ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  function toggleFlexPick(ab: Ability) {
    setFlexPicks(prev => {
      if (prev.includes(ab)) return prev.filter(a => a !== ab);
      if (prev.length >= flexRequiredCount) return prev;
      return [...prev, ab];
    });
  }
  function flexAmountFor(idx: number): number {
    if (!flexAsi) return 0;
    if (flexAsi.mode.kind === 'two_distinct_plus_one') return 1;
    return flexSubMode === '3x1' ? 1 : (idx === 0 ? 2 : 1);
  }

  // Fix: navigate in useEffect, never during render
  useEffect(() => {
    if (!bg || !draft) safeGoBack();
  }, []);

  if (!bg || !draft) return null;

  function selectBackground() {
    // Strip old background's skill proficiencies before applying the new
    // one's, so changing background doesn't stack skills from both.
    // FILTER-METADATA-2: previously a hardcoded, background-id-keyed
    // BG_SKILL_MAP duplicating BG_DETAIL's own skillProficiencies (and only
    // covering the 13 official backgrounds). Replaced with the same
    // effect-derivation the grant side already used — one source of truth,
    // and it now correctly untrains a PREVIOUS homebrew background's
    // skills too, which the old hardcoded map never could.
    const prevBgId = draft!.identity.backgroundId;
    const prevBg = prevBgId ? getMergedContentDB().backgrounds.find(b => b.id === prevBgId) : undefined;
    const prevSkills = prevBg ? backgroundSkillGrants(prevBg) : [];

    let updatedSkills = { ...draft!.skills.skills };
    for (const key of prevSkills) {
      if (updatedSkills[key]) {
        updatedSkills = { ...updatedSkills, [key]: { ...updatedSkills[key], trained: false } };
      }
    }

    let updated = {
      ...draft!,
      identity: { ...draft!.identity, backgroundId: bg!.id },
      // Remove old background features; new ones applied below.
      features: draft!.features.filter(f => f.source.kind !== 'background'),
      skills:   { skills: updatedSkills },
      // CHOICE-AUTHORING-1: sweep any still-unresolved choice queued from a
      // PREVIOUSLY-selected background (going back and re-picking during
      // creation) — same BACKGROUND_CHOICE_PREFIX convention swapBackground
      // uses for the live-play path.
      choices: draft!.choices.filter(c =>
        c.resolved || !c.definition.id.startsWith(BACKGROUND_CHOICE_PREFIX),
      ),
    };
    if (prevBgId) updated = revokeResourceSource(updated, 'background', prevBgId);

    // Apply background features via the grant pipeline
    for (const feature of bg!.features) {
      updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
    }

    // ...and any choices this background queues rather than auto-resolves
    // (e.g. "choose one artisan's tool") — same pending-choice objects the
    // leveling system produces, just queued here, mirroring race-detail.tsx's
    // identical pendingChoices handling.
    for (const choice of bg!.pendingChoices ?? []) {
      updated = queueChoice(updated, choice, 0, undefined, { kind: 'background', id: bg!.id });
    }

    // ...and the flexible ability score choice, compiled into one generated
    // Feature — mirrors race-detail.tsx's identical flexAsi compilation.
    // ABILITY-CAP-1: clamp each pick to headroom under the effective cap
    // (rules.maxAbilityScore), same rule the plain ASI path already
    // enforces, so a house rule allowing scores above 20 doesn't get
    // silently bypassed by a background's flexible ASI.
    if (flexAsi && flexPicks.length > 0) {
      const maxScore = rules.maxAbilityScore ?? Infinity;
      const effectiveBefore = applyStatModifiers(updated.stats, collectAllEffects(updated));
      const flexFeature: Feature = {
        id: `${bg!.id}_flexible_asi`,
        name: 'Ability Score Increase',
        description: flexAsi.prompt,
        source: { kind: 'background', refId: bg!.id },
        level: null, actions: [], choices: [], passive: true,
        effects: flexPicks.map((ab, idx) => {
          const headroom = Math.max(0, maxScore - effectiveBefore[ab]);
          return { type: 'stat_modifier' as const, target: ab, operation: 'add' as const, value: Math.min(flexAmountFor(idx), headroom), condition: null };
        }),
      };
      updated = applyGrant(updated, { kind: 'feature', value: { ...flexFeature, isActive: true } }, 0);
    }

    // Mark this background's skill proficiencies as trained so they appear
    // correctly on the skill-selection screen — driven by the background's
    // own feature effects (same list `skillProficiencies` above renders),
    // not a hardcoded per-id table. Works identically for official and
    // homebrew backgrounds.
    for (const key of backgroundSkillGrants(bg!)) {
      if (updated.skills.skills[key]) {
        updated = {
          ...updated,
          skills: {
            skills: {
              ...updated.skills.skills,
              [key]: { ...updated.skills.skills[key], trained: true },
            },
          },
        };
      }
    }

    // Personality stored in notes alongside other creation flags
    const existing = (() => { try { return JSON.parse(updated.notes || '{}'); } catch { return {}; } })();
    updated = { ...updated, notes: JSON.stringify({ ...existing, trait, ideal, bond, flaw }) };
    setDraft(updated);
    router.push('/creation/hub');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{bg.name}</Text>
        {isHomebrew && (
          <View style={styles.homebrewTag}>
            <Text style={styles.homebrewTagTxt}>Homebrew</Text>
          </View>
        )}
        {!isHomebrew && isNonSrd(bg.srd) && <NonSrdBadge />}
      </View>
      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Skill Proficiencies</Text>
      {skillProficiencies.length === 0 ? (
        <Text style={styles.emptyNote}>This background grants no skill proficiencies.</Text>
      ) : (
        skillProficiencies.map((s, i) => (
          <Text key={i} style={styles.bullet}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
        ))
      )}

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Tool Proficiencies</Text>
      {toolProficiencies.length === 0 ? (
        <Text style={styles.emptyNote}>This background grants no tool proficiencies.</Text>
      ) : (
        toolProficiencies.map((t, i) => <Text key={i} style={styles.bullet}>{t}</Text>)
      )}

      {detail && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Feature</Text>
          <Text style={styles.featureText}>{detail.feature}</Text>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Personality</Text>

          <PersonalityPicker label="Trait"  options={detail.traits}  value={trait} onChange={setTrait} />
          <PersonalityPicker label="Ideal"  options={detail.ideals}  value={ideal} onChange={setIdeal} />
          <PersonalityPicker label="Bond"   options={detail.bonds}   value={bond}  onChange={setBond}  />
          <PersonalityPicker label="Flaw"   options={detail.flaws}   value={flaw}  onChange={setFlaw}  />
        </>
      )}

      {!detail && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Features</Text>
          {bg.features.length === 0 ? (
            <Text style={styles.emptyNote}>This background grants no features.</Text>
          ) : (
            bg.features.map(f => (
              <View key={f.id} style={styles.featureBlock}>
                <Text style={styles.featureName}>{f.name}</Text>
                <Text style={styles.featureText}>{f.description}</Text>
              </View>
            ))
          )}
          <View style={styles.divider} />
          <Text style={styles.sub}>
            Traits, ideals, bonds, and flaws aren't predefined for this background —
            jot yours down on the Notes tab after creation.
          </Text>
        </>
      )}

      {flexAsi && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>{flexAsi.prompt}</Text>
          {flexAsi.mode.kind === 'two_one_or_three_one' && (
            <View style={flexStyles.subModeRow}>
              <Pressable
                style={[flexStyles.subModeBtn, flexSubMode === '2_1' && flexStyles.subModeBtnActive]}
                onPress={() => { setFlexSubMode('2_1'); setFlexPicks([]); }}
              >
                <Text style={[flexStyles.subModeTxt, flexSubMode === '2_1' && flexStyles.subModeTxtActive]}>+2 / +1</Text>
              </Pressable>
              <Pressable
                style={[flexStyles.subModeBtn, flexSubMode === '3x1' && flexStyles.subModeBtnActive]}
                onPress={() => { setFlexSubMode('3x1'); setFlexPicks([]); }}
              >
                <Text style={[flexStyles.subModeTxt, flexSubMode === '3x1' && flexStyles.subModeTxtActive]}>+1 / +1 / +1</Text>
              </Pressable>
            </View>
          )}
          <View style={flexStyles.abilityRow}>
            {flexAbilityOptions.map(ab => {
              const idx = flexPicks.indexOf(ab);
              const picked = idx !== -1;
              return (
                <Pressable
                  key={ab}
                  style={[flexStyles.abilityBtn, picked && flexStyles.abilityBtnActive]}
                  onPress={() => toggleFlexPick(ab)}
                >
                  <Text style={[flexStyles.abilityTxt, picked && flexStyles.abilityTxtActive]}>
                    {ab.toUpperCase()}{picked ? ` +${flexAmountFor(idx)}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.divider} />
      <Pressable
        style={[styles.selectBtn, !flexComplete && styles.selectBtnDisabled]}
        onPress={selectBackground}
        disabled={!flexComplete}
      >
        <Text style={styles.selectBtnText}>Select Background</Text>
      </Pressable>
    </ScrollView>
  );
}

function PersonalityPicker({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={ppStyles.block}>
      <Text style={ppStyles.label}>{label}</Text>
      <Pressable style={ppStyles.selector} onPress={() => setOpen(o => !o)}>
        <Text style={value ? ppStyles.selectorValue : ppStyles.selectorPlaceholder}>
          {value || 'Select'}
        </Text>
        <Text style={ppStyles.arrow}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <View style={ppStyles.dropdown}>
          {options.map((opt, i) => (
            <Pressable key={i} style={ppStyles.option} onPress={() => { onChange(opt); setOpen(false); }}>
              <Text style={[ppStyles.optionText, value === opt && ppStyles.optionSelected]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const ppStyles = StyleSheet.create({
  block:    { marginBottom: Spacing.md },
  label:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs, fontWeight: FontWeight.bold },
  selector: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.sm,
  },
  selectorValue:       { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  selectorPlaceholder: { fontSize: FontSize.sm, color: Colors.textDim, flex: 1 },
  arrow: { fontSize: FontSize.xs, color: Colors.textSecondary },
  dropdown: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, marginTop: 2, overflow: 'hidden',
  },
  option: { padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  optionText:     { fontSize: FontSize.sm, color: Colors.textPrimary },
  optionSelected: { color: Colors.gold, fontWeight: FontWeight.bold },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  headingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  sub:       { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
  featureBlock: { marginBottom: Spacing.md },
  featureName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 2 },
  divider:   { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.textPrimary,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  searchFlex: { flex: 1, marginHorizontal: 0, marginBottom: 0 },
  filtersToggle: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
  },
  filtersToggleActive:  { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  filtersToggleTxt:     { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filtersToggleTxtActive: { color: Colors.gold },
  filterPanel: { marginBottom: Spacing.xs },
  list: { paddingHorizontal: Spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowName:  { fontSize: FontSize.md, color: Colors.textPrimary },
  rowArrow: { fontSize: FontSize.xl, color: Colors.textDim },
  homebrewSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  homebrewHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.sm,
  },
  homebrewHeading: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDim,
    letterSpacing: 2,
  },
  createNewBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  createNewTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  homebrewEmptyText: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', paddingVertical: Spacing.sm },
  homebrewTag: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  homebrewTagTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  rulesetTag: {
    backgroundColor: Colors.textSecondary + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.textSecondary + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  rulesetTagTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  backBtn:     { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  backBtnText: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  bullet:      { fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },
  featureText: { fontSize: FontSize.md, color: Colors.textPrimary },
  selectBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  selectBtnDisabled: { opacity: 0.4 },
  selectBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});

const flexStyles = StyleSheet.create({
  subModeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  subModeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  subModeBtnActive: { backgroundColor: Colors.gold + '33', borderColor: Colors.gold },
  subModeTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary },
  subModeTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  abilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  abilityBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  abilityBtnActive: { backgroundColor: Colors.gold + '33', borderColor: Colors.gold },
  abilityTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  abilityTxtActive: { color: Colors.gold },
});
