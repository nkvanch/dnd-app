// app/creation/background.tsx
// Background list + detail page with personality trait selectors.
import { View, Text, FlatList, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { globalContentDB } from '../../src/content/classes/library';
import { Background, SkillName, Ability, Feature } from '../../src/engine/types';
import { applyGrant } from '../../src/engine/leveling';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// ── BG_DETAIL — all 13 PHB backgrounds ───────────────────────────────────────

const BG_DETAIL: Record<string, {
  skillProficiencies: string[];
  toolProficiencies: string[];
  feature: string;
  traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
}> = {
  acolyte: {
    skillProficiencies: ['Insight', 'Religion'],
    toolProficiencies: ['None'],
    feature: 'Shelter of the Faithful',
    traits: ['I idolize a particular hero of my faith and constantly refer to their deeds.', 'I see omens in every event and action.'],
    ideals: ['Tradition', 'Charity', 'Change', 'Power'],
    bonds: ['I owe my life to the priest who took me in when my parents died.'],
    flaws: ['I am inflexible in my thinking.'],
  },
  charlatan: {
    skillProficiencies: ['Deception', 'Sleight of Hand'],
    toolProficiencies: ['Disguise kit', 'Forgery kit'],
    feature: 'False Identity',
    traits: ['I fall in and out of love easily and am always pursuing someone.', 'I have a joke for every occasion.'],
    ideals: ['Independence', 'Fairness', 'Charity', 'Creativity'],
    bonds: ['I fleeced the wrong person and must work to repay my debt.'],
    flaws: ["I can't resist a pretty face."],
  },
  criminal: {
    skillProficiencies: ['Deception', 'Stealth'],
    toolProficiencies: ["Thieves' tools", 'One gaming set'],
    feature: 'Criminal Contact',
    traits: ['I always have a plan for when things go wrong.', 'I am always calm, no matter what the situation.'],
    ideals: ['Honor', 'Freedom', 'Charity', 'Redemption'],
    bonds: ["I'm trying to pay off an old debt I owe to a generous benefactor."],
    flaws: ['When I see something valuable, I can\'t think of anything but how to steal it.'],
  },
  entertainer: {
    skillProficiencies: ['Acrobatics', 'Performance'],
    toolProficiencies: ['Disguise kit', 'One musical instrument'],
    feature: 'By Popular Demand',
    traits: ['I know a story relevant to almost every situation.', 'I love a good insult, even one directed at me.'],
    ideals: ['Beauty', 'Tradition', 'Creativity', 'Greed'],
    bonds: ['I want to be famous, whatever it takes.'],
    flaws: ["I'm a sucker for a pretty face."],
  },
  folk_hero: {
    skillProficiencies: ['Animal Handling', 'Survival'],
    toolProficiencies: ["One artisan's tools", 'Vehicles (land)'],
    feature: 'Rustic Hospitality',
    traits: ['I judge people by their actions, not their words.', "I'm confident in my own abilities and do what I can to instill confidence in others."],
    ideals: ['Respect', 'Fairness', 'Freedom', 'Might'],
    bonds: ['I protect those who cannot protect themselves.'],
    flaws: ['The tyrant who rules my land will stop at nothing to see me captured or dead.'],
  },
  guild_artisan: {
    skillProficiencies: ['Insight', 'Persuasion'],
    toolProficiencies: ["One artisan's tools"],
    feature: 'Guild Membership',
    traits: ['I believe that anything worth doing is worth doing right.', "I'm rude to people who slack off at their work."],
    ideals: ['Community', 'Generosity', 'Freedom', 'Aspiration'],
    bonds: ['The workshop where I learned my trade is the most important place in the world to me.'],
    flaws: ["I'll do anything to get my hands on something rare or priceless."],
  },
  hermit: {
    skillProficiencies: ['Medicine', 'Religion'],
    toolProficiencies: ['Herbalism kit'],
    feature: 'Discovery',
    traits: ["I've been isolated for so long that I rarely speak, preferring gestures and the occasional grunt.", 'I am utterly serene, even in the face of disaster.'],
    ideals: ['Greater Good', 'Logic', 'Free Thinking', 'Self-Knowledge'],
    bonds: ['I entered seclusion to hide from those who might still be hunting me.'],
    flaws: ['I like keeping secrets and won\'t share them with anyone.'],
  },
  noble: {
    skillProficiencies: ['History', 'Persuasion'],
    toolProficiencies: ['One gaming set'],
    feature: 'Position of Privilege',
    traits: ['My eloquent flattery makes everyone I talk to feel like the most wonderful and important person in the world.', 'The common folk love me for my kindness and generosity.'],
    ideals: ['Respect', 'Responsibility', 'Independence', 'Power'],
    bonds: ['I will face any challenge to win the approval of my family.'],
    flaws: ['I secretly believe that everyone is beneath me.'],
  },
  outlander: {
    skillProficiencies: ['Athletics', 'Survival'],
    toolProficiencies: ['One musical instrument'],
    feature: 'Wanderer',
    traits: ["I'm driven by a wanderlust that led me away from home.", 'I watch over my friends as if they were a litter of newborn pups.'],
    ideals: ['Change', 'Greater Good', 'Independence', 'Might'],
    bonds: ['My family, clan, or tribe is the most important thing in my life.'],
    flaws: ['I am slow to trust members of other races, tribes, and societies.'],
  },
  sage: {
    skillProficiencies: ['Arcana', 'History'],
    toolProficiencies: ['None'],
    feature: 'Researcher',
    traits: ['I use polysyllabic words that convey the impression of great erudition.', "I've read every book in the world's greatest libraries — or I like to boast that I have."],
    ideals: ['Knowledge', 'Beauty', 'Logic', 'Power'],
    bonds: ['I have an ancient text that holds terrible secrets that must not fall into the wrong hands.'],
    flaws: ['I am easily distracted by the promise of information.'],
  },
  sailor: {
    skillProficiencies: ['Athletics', 'Perception'],
    toolProficiencies: ["Navigator's tools", 'Vehicles (water)'],
    feature: "Ship's Passage",
    traits: ['My friends know they can rely on me, no matter what.', 'I work hard so that I can play hard when the work is done.'],
    ideals: ['Respect', 'Fairness', 'Freedom', 'Mastery'],
    bonds: ["I'm loyal to my captain first, everything else second."],
    flaws: ['I follow orders, even if I think they\'re wrong.'],
  },
  soldier: {
    skillProficiencies: ['Athletics', 'Intimidation'],
    toolProficiencies: ['Gaming Set', 'Vehicles (Land)'],
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
    skillProficiencies: ['Sleight of Hand', 'Stealth'],
    toolProficiencies: ['Disguise kit', "Thieves' tools"],
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
  const [search, setSearch] = useState('');

  // If ?detail=id is in the URL, show the detail view inline. This branch comes
  // AFTER all hooks above so hook order stays identical across renders.
  if (detail) return <BackgroundDetail id={detail} />;

  const backgrounds = globalContentDB.backgrounds.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredHomebrewBackgrounds = homebrewBackgrounds.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Select Background</Text>
      <View style={styles.divider} />

      <TextInput
        style={styles.search}
        placeholder="Search"
        placeholderTextColor={Colors.textDim}
        value={search}
        onChangeText={setSearch}
      />

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
            <Text style={styles.rowArrow}>›</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.homebrewSection}>
            <View style={styles.homebrewHeader}>
              <Text style={styles.homebrewHeading}>HOMEBREW BACKGROUNDS</Text>
              <Pressable
                style={styles.createNewBtn}
                onPress={() => router.push('/(tabs)/homebrew' as any)}
              >
                <Text style={styles.createNewTxt}>Create in Homebrew →</Text>
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
    </View>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

function BackgroundDetail({ id }: { id: string }) {
  const router   = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const homebrewBackgrounds = useHomebrewStore(s => s.backgrounds);

  const bg     = [...globalContentDB.backgrounds, ...homebrewBackgrounds].find(b => b.id === id);
  const detail = BG_DETAIL[id];

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
    // Strip old background features and skills before applying the new one,
    // so changing background doesn't stack skills from both.
    const prevBgId = draft!.identity.backgroundId;
    const BG_SKILL_MAP: Record<string, string[]> = {
      acolyte:      ['insight', 'religion'],
      charlatan:    ['deception', 'sleight_of_hand'],
      criminal:     ['deception', 'stealth'],
      entertainer:  ['acrobatics', 'performance'],
      folk_hero:    ['animal_handling', 'survival'],
      guild_artisan:['insight', 'persuasion'],
      hermit:       ['medicine', 'religion'],
      noble:        ['history', 'persuasion'],
      outlander:    ['athletics', 'survival'],
      sage:         ['arcana', 'history'],
      sailor:       ['athletics', 'perception'],
      soldier:      ['athletics', 'intimidation'],
      urchin:       ['sleight_of_hand', 'stealth'],
    };

    // Remove old background's directly-set skill proficiencies.
    let updatedSkills = { ...draft!.skills.skills };
    if (prevBgId && BG_SKILL_MAP[prevBgId]) {
      for (const sk of BG_SKILL_MAP[prevBgId]) {
        const key = sk as SkillName;
        if (updatedSkills[key]) {
          updatedSkills = { ...updatedSkills, [key]: { ...updatedSkills[key], trained: false } };
        }
      }
    }

    let updated = {
      ...draft!,
      identity: { ...draft!.identity, backgroundId: bg!.id },
      // Remove old background features; new ones applied below.
      features: draft!.features.filter(f => f.source.kind !== 'background'),
      skills:   { skills: updatedSkills },
    };

    // Apply background features via the grant pipeline
    for (const feature of bg!.features) {
      updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
    }

    // ...and the flexible ability score choice, compiled into one generated
    // Feature — mirrors race-detail.tsx's identical flexAsi compilation.
    if (flexAsi && flexPicks.length > 0) {
      const flexFeature: Feature = {
        id: `${bg!.id}_flexible_asi`,
        name: 'Ability Score Increase',
        description: flexAsi.prompt,
        source: { kind: 'background', refId: bg!.id },
        level: null, actions: [], choices: [], passive: true,
        effects: flexPicks.map((ab, idx) => ({
          type: 'stat_modifier', target: ab, operation: 'add', value: flexAmountFor(idx), condition: null,
        })),
      };
      updated = applyGrant(updated, { kind: 'feature', value: { ...flexFeature, isActive: true } }, 0);
    }

    // Fix 10: directly mark background skill proficiencies as trained so they
    // appear correctly in the skill-selection screen.
    if (detail?.skillProficiencies) {
      for (const skillLabel of detail.skillProficiencies) {
        const key = skillLabel.toLowerCase().replace(/ /g, '_') as SkillName;
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
    }

    // Generalized version of the above, driven by the background's own feature
    // effects rather than the hardcoded BG_DETAIL table. This is what makes
    // homebrew backgrounds (which have no BG_DETAIL entry) grant proficiency
    // correctly — and is a harmless no-op re-application for PHB backgrounds,
    // whose features already carry the same grant_proficiency effects.
    for (const feature of bg!.features) {
      for (const effect of feature.effects) {
        if (
          effect.type === 'grant_proficiency' &&
          effect.operation === 'add' &&
          effect.target.startsWith('skill:')
        ) {
          const key = effect.target.slice(6) as SkillName;
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
        {!detail && (
          <View style={styles.homebrewTag}>
            <Text style={styles.homebrewTagTxt}>Homebrew</Text>
          </View>
        )}
      </View>
      <View style={styles.divider} />

      {detail && (
        <>
          <Text style={styles.sectionTitle}>Skill Proficiencies</Text>
          {detail.skillProficiencies.map((s, i) => <Text key={i} style={styles.bullet}>{s}</Text>)}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Tool Proficiencies</Text>
          {detail.toolProficiencies.map((t, i) => <Text key={i} style={styles.bullet}>{t}</Text>)}

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
            Traits, ideals, bonds, and flaws aren't predefined for homebrew backgrounds —
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
