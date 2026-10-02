// app/creation/hub.tsx
// Creation hub with "Next →" sequential button and fixed scores completion check.
import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { getHouseRule } from '../../src/engine/houseRules';
import { Entity } from '../../src/engine/types';
import { subclassEntriesForClassMerged } from '../../src/content/subclasses/subclassBrowse';
import { skillProgressFor, spellProgressFor } from '../../src/content/creationProgress';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { SafeBottomView } from '../../src/components/SafeBottomView';

type Section = {
  key:   string;
  label: string;
  route: string;
  done:  (d: Entity) => boolean;
};

const ORDERED_SECTIONS: Section[] = [
  { key: 'race',       label: 'Race',          route: '/creation/race',       done: d => !!d.identity.raceId },
  { key: 'class',      label: 'Class',         route: '/creation/class',      done: d => !!d.identity.classId },
  { key: 'scores',     label: 'Ability Scores', route: '/creation/scores',
    done: d => {
      try {
        const notes = JSON.parse(d.notes || '{}');
        return !!notes.scoresConfirmed;
      } catch { return false; }
    },
  },
  { key: 'background', label: 'Background',    route: '/creation/background', done: d => !!d.identity.backgroundId },
  { key: 'skills',     label: 'Skills',        route: '/creation/skills',
    done: d => {
      const pending = d.choices.filter(c => c.definition.kind === 'skill' && !c.resolved);
      return pending.length === 0;
    },
  },
  { key: 'feats',      label: 'Feats (optional)', route: '/creation/feats',
    done: d => {
      try { return !!JSON.parse(d.notes || '{}').featsVisited; }
      catch { return false; }
    },
  },
  { key: 'equipment',  label: 'Equipment',     route: '/creation/equipment',
    // CREATION-HUB-PROGRESS-1: was `equipmentVisited` (a flag set only when
    // the player clicks the Continue button on that screen) — a player who
    // resolves every choice and then navigates away via a hub link instead
    // of that button would show as incomplete despite having nothing left
    // to do. Real required-choice-resolution state instead: vacuously done
    // when a class has no equipment choices at all, matching the "nothing
    // required = nothing to complete" rule applied below for Spells too.
    done: d => d.choices.filter(c => c.definition.kind === 'equipment' && !c.resolved).length === 0,
  },
  { key: 'spells',     label: 'Spells',        route: '/creation/spells',
    // Same fix as Equipment above — real cumulative cantrip/known-spell
    // entitlement (spellProgressFor, shared with the picker's own headers)
    // instead of a visited flag. A non-caster (or a caster with a 0/0
    // target at this level, e.g. Ranger/Paladin/Artificer at level 1) has
    // nothing to resolve, so it's vacuously done.
    done: d => {
      const p = spellProgressFor(d);
      const cantripsOk = !p.cantrips || p.cantrips.done === p.cantrips.total;
      const spellsOk   = !p.spells   || p.spells.done   === p.spells.total;
      return cantripsOk && spellsOk;
    },
  },
];

const PRIMARY_KEYS = ['race', 'class', 'scores'];

const SUBCLASS_SECTION: Section = {
  key:   'subclass',
  label: 'Subclass',
  route: '/creation/subclass',
  done:  d => d.choices.filter(c => c.definition.kind === 'subclass' && !c.resolved).length === 0,
};

const ASI_SECTION: Section = {
  key:   'asi',
  label: 'Ability Improvements',
  route: '/creation/level-up',
  done:  d => d.choices.filter(c => c.definition.kind === 'asi' && !c.resolved).length === 0,
};

const SPELLCASTING_ABILITY_SECTION: Section = {
  key:   'spellcasting_ability',
  label: 'Spellcasting Ability',
  route: '/creation/spellcasting-ability',
  done:  d => d.choices.filter(c => c.definition.kind === 'spellcasting_ability' && !c.resolved).length === 0,
};

// CHOICE-EXPANSION-1: same conditional-section pattern as ASI/subclass/
// spellcasting-ability above — only appear when the character actually has
// a pending choice of this kind (e.g. Rogue/Bard's Expertise), all three
// routing to the one shared app/creation/repeated-choice.tsx screen.
const EXPERTISE_SECTION: Section = {
  key: 'expertise', label: 'Expertise', route: '/creation/repeated-choice?kind=expertise',
  done: d => d.choices.filter(c => c.definition.kind === 'expertise' && !c.resolved).length === 0,
};
const TOOL_SECTION: Section = {
  key: 'tool', label: 'Tool Proficiencies', route: '/creation/repeated-choice?kind=tool',
  done: d => d.choices.filter(c => c.definition.kind === 'tool' && !c.resolved).length === 0,
};
const LANGUAGE_SECTION: Section = {
  key: 'language', label: 'Languages', route: '/creation/repeated-choice?kind=language',
  done: d => d.choices.filter(c => c.definition.kind === 'language' && !c.resolved).length === 0,
};

export default function HubScreen() {
  const router = useRouter();
  const draft  = useCharacterStore(s => s.draft);
  const rules  = useCharacterStore(s => s.rules);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);

  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft]);

  if (!draft) return null;

  // The optional Feats step only appears when the table allows a 1st-level feat.
  const featsAllowed = getHouseRule(rules, 'featAtCreation');
  const baseSections = featsAllowed
    ? ORDERED_SECTIONS
    : ORDERED_SECTIONS.filter(s => s.key !== 'feats');

  // Conditionally include Subclass section, spliced right after Class — a
  // class whose subclass unlocks at level 1 (Cleric, Sorcerer, Warlock) or
  // below whatever target level the character is being created at should
  // have that choice made as part of creation itself, immediately after
  // picking the class, not deferred to the Features tab.
  const subclassChoices = draft.choices.filter(c => c.definition.kind === 'subclass');
  let sections = baseSections;
  if (subclassChoices.length > 0) {
    const classIdx = sections.findIndex(s => s.key === 'class');
    sections = [...sections.slice(0, classIdx + 1), { ...SUBCLASS_SECTION, label: subclassChoices[0].definition.subclassLabel ?? SUBCLASS_SECTION.label }, ...sections.slice(classIdx + 1)];
  }

  // Conditionally include ASI section only when there are pending ASI choices
  const asiChoices = draft.choices.filter(c => c.definition.kind === 'asi');
  if (asiChoices.length > 0) {
    sections = [...sections, ASI_SECTION];
  }

  // Same pattern for the rare-case spellcasting-ability choice (homebrew
  // classes with 2+ spellcastingAbilityOptions) — was previously never
  // tracked or routed to at all, so this pending choice just sat unresolved
  // forever with no way for the player to reach it.
  const spellAbilityChoices = draft.choices.filter(c => c.definition.kind === 'spellcasting_ability');
  if (spellAbilityChoices.length > 0) {
    sections = [...sections, SPELLCASTING_ABILITY_SECTION];
  }

  // CHOICE-EXPANSION-1 item 18/19: same "only when pending" pattern —
  // progress reflects the actual unresolved ChoiceDefinition count, never a
  // fabricated total (item 14: automatic grants never consume these slots,
  // since they're never queued as choices in the first place).
  const expertiseChoices = draft.choices.filter(c => c.definition.kind === 'expertise');
  if (expertiseChoices.length > 0) sections = [...sections, EXPERTISE_SECTION];
  const toolChoices = draft.choices.filter(c => c.definition.kind === 'tool');
  if (toolChoices.length > 0) sections = [...sections, TOOL_SECTION];
  const languageChoices = draft.choices.filter(c => c.definition.kind === 'language');
  if (languageChoices.length > 0) sections = [...sections, LANGUAGE_SECTION];

  // CREATION-EDIT-AFFORDANCE-1: shows what's currently selected for the
  // "named content" sections (race/class/subclass/background) instead of
  // just a bare checkmark — makes it visually obvious the row represents
  // an editable choice, not a one-time completed step (matches the same
  // fix applied to subclass selection itself, SUBCLASS-CHANGE-1).
  function progressSubtitle(sec: Section, d: Entity): string | null {
    const mergedDB = getMergedContentDB();
    if (sec.key === 'race') return mergedDB.races.find(r => r.id === d.identity.raceId)?.name ?? null;
    if (sec.key === 'class') return mergedDB.classes.find(c => c.id === d.identity.classId)?.name ?? null;
    if (sec.key === 'background') return mergedDB.backgrounds.find(b => b.id === d.identity.backgroundId)?.name ?? null;
    if (sec.key === 'subclass') {
      const resolved = [...d.choices].reverse().find(c => c.definition.kind === 'subclass' && c.resolved);
      if (!resolved) return null;
      const forClassId = resolved.definition.forClassId ?? d.identity.classId;
      const entries = subclassEntriesForClassMerged(forClassId, homebrewSubclasses);
      return entries.find(e => e.id === resolved.selections[0])?.name ?? null;
    }
    return null;
  }

  // STARTING-EQUIPMENT-1: the hub should reflect ACTUAL incomplete
  // progress for Equipment, not just whether the screen was visited — a
  // player who leaves after choosing 2 of 3 required equipment groups
  // should see "2/3 choices", not a bare ✗ indistinguishable from having
  // made no progress at all.
  function equipmentSubtitle(d: Entity): string | null {
    const all = d.choices.filter(c => c.definition.kind === 'equipment');
    if (all.length === 0) return null;
    const resolvedCount = all.filter(c => c.resolved).length;
    if (resolvedCount === all.length) return null;
    return `${resolvedCount}/${all.length} choices`;
  }

  // CREATION-HUB-PROGRESS-1: real skill-slot entitlement (not "screen
  // visited"), via the exact same achievable-count calculation skills.tsx
  // itself uses for its own Confirm gate — see skillProgressFor's doc
  // comment for why a simpler "sum of definition.count" denominator would
  // be misleading under the warn-mode overlap house rule.
  function skillsSubtitle(d: Entity): string | null {
    const p = skillProgressFor(d, rules);
    if (!p || p.done === p.total) return null;
    return `${p.done}/${p.total}`;
  }

  // Real cumulative Cantrips/Known-Spells entitlement, shared with the
  // spell picker's own section headers (spellProgressFor). Two separate
  // categories can't be honestly collapsed into one denominator (a
  // half-caster's "2 cantrips known, 0 leveled spells yet" isn't a single
  // fraction) — shows a subtitle only for whichever categories actually
  // apply to this class/level, joined with " · ".
  function spellsSubtitle(d: Entity): string | null {
    const p = spellProgressFor(d);
    const parts: string[] = [];
    if (p.cantrips && p.cantrips.done !== p.cantrips.total) parts.push(`Cantrips ${p.cantrips.done}/${p.cantrips.total}`);
    if (p.spells && p.spells.done !== p.spells.total) parts.push(`Spells ${p.spells.done}/${p.spells.total}`);
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  // Ability Improvements (ASI/Feat choices from leveling — the one place
  // in this engine with a genuinely BOUNDED, authoritative feat-adjacent
  // entitlement; see the "Feats (optional)" note below for why that
  // creation-time step itself has no fixed total to show as a fraction).
  function asiSubtitle(d: Entity): string | null {
    const all = d.choices.filter(c => c.definition.kind === 'asi');
    if (all.length === 0) return null;
    const resolvedCount = all.filter(c => c.resolved).length;
    if (resolvedCount === all.length) return null;
    return `${resolvedCount}/${all.length}`;
  }

  // "Feats (optional)" at creation (app/creation/feats.tsx) is deliberately
  // open-ended — "take as many feats as your table's house rule allows,"
  // with no fixed required count anywhere in the data model (confirmed:
  // makeCreationFeatChoice() synthesizes a throwaway single-feat choice
  // per tap, never a persisted N-slot entitlement). A fabricated
  // denominator here would violate the same "don't count automatic/
  // manual against a required total" rule the ACTUAL bounded case (ASI
  // choices, above) has to respect — so this shows a plain count of what
  // was taken, not a fraction, rather than inventing one.
  function featsSubtitle(d: Entity): string | null {
    const taken = d.features.filter(f => f.source.kind === 'feat').length;
    return taken > 0 ? `${taken} taken` : null;
  }

  // CHOICE-EXPANSION-1: same resolvedCount/total shape as asiSubtitle above
  // — item 19's invariant (hub count == picker count == underlying
  // unresolved choice count) means this reads directly off d.choices, never
  // a screen-visited flag.
  function choiceKindSubtitle(d: Entity, kind: 'expertise' | 'tool' | 'language'): string | null {
    const all = d.choices.filter(c => c.definition.kind === kind);
    if (all.length === 0) return null;
    const resolvedCount = all.filter(c => c.resolved).length;
    if (resolvedCount === all.length) return null;
    return `${resolvedCount}/${all.length}`;
  }

  const allDone = sections.every(s => s.done(draft));

  // Find the first incomplete section for the "Next →" button
  const nextSection = sections.find(s => !s.done(draft));

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >

      <Text style={styles.heading}>Character Creation</Text>
      <View style={styles.divider} />

      {/* Primary quick-access buttons */}
      <Text style={styles.sectionLabel}>Choose where to begin:</Text>
      <View style={styles.primaryRow}>
        {PRIMARY_KEYS.map(key => {
          const sec  = ORDERED_SECTIONS.find(s => s.key === key)!;
          const done = sec.done(draft);
          return (
            <Pressable
              key={key}
              style={[styles.primaryBtn, done && styles.primaryBtnDone]}
              onPress={() => router.push(sec.route as any)}
            >
              <Text style={[styles.primaryBtnText, done && styles.primaryBtnTextDone]}>
                {sec.label}
              </Text>
              {done && <Text style={styles.doneCheck}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      {/* Progress tracker — all sections */}
      <Text style={styles.sectionLabel}>Current Progress</Text>
      <View style={styles.progressList}>
        {sections.map(sec => {
          const done = sec.done(draft);
          const subtitle =
            sec.key === 'equipment' ? equipmentSubtitle(draft) :
            sec.key === 'skills'    ? skillsSubtitle(draft) :
            sec.key === 'spells'    ? spellsSubtitle(draft) :
            sec.key === 'asi'       ? asiSubtitle(draft) :
            sec.key === 'feats'     ? featsSubtitle(draft) :
            sec.key === 'expertise' ? choiceKindSubtitle(draft, 'expertise') :
            sec.key === 'tool'      ? choiceKindSubtitle(draft, 'tool') :
            sec.key === 'language'  ? choiceKindSubtitle(draft, 'language') :
            (done ? progressSubtitle(sec, draft) : null);
          return (
            <Pressable key={sec.key} style={styles.progressRow} onPress={() => router.push(sec.route as any)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressLabel}>{sec.label}</Text>
                {subtitle && <Text style={styles.progressSubtitle}>{subtitle}</Text>}
              </View>
              <Text style={[styles.progressStatus, done ? styles.statusDone : styles.statusPending]}>
                {done ? '✓' : '✗'}
              </Text>
              {/* Same chevron affordance used for every other editable
                  selection in the app — signals this row is tappable/
                  revisitable, not a completed one-time step. */}
              <Text style={styles.progressArrow}>›</Text>
            </Pressable>
          );
        })}
      </View>

    </ScrollView>
    {(nextSection && !allDone || allDone) && (
      <SafeBottomView>
        <View style={styles.footer}>
          {/* Next sequential button */}
          {nextSection && !allDone && (
            <Pressable style={styles.nextBtn} onPress={() => router.push(nextSection.route as any)}>
              <Text style={styles.nextBtnText}>Next: {nextSection.label} →</Text>
            </Pressable>
          )}

          {/* Review — only when everything done */}
          {allDone && (
            <Pressable style={styles.reviewBtn} onPress={() => router.push('/creation/review')}>
              <Text style={styles.reviewBtnText}>Review Character →</Text>
            </Pressable>
          )}
        </View>
      </SafeBottomView>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg },
  footer:    { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 1 },

  primaryRow: { gap: Spacing.sm },
  primaryBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  primaryBtnDone:     { borderColor: Colors.green },
  primaryBtnText:     { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  primaryBtnTextDone: { color: Colors.green },
  doneCheck:          { fontSize: FontSize.lg, color: Colors.green },

  progressList: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  progressLabel:  { fontSize: FontSize.md, color: Colors.textPrimary },
  progressSubtitle: { fontSize: FontSize.sm, color: Colors.gold, marginTop: 2 },
  progressStatus: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  progressArrow:  { fontSize: FontSize.lg, color: Colors.textDim },
  statusDone:    { color: Colors.green },
  statusPending: { color: Colors.red },

  nextBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold,
    paddingVertical: Spacing.md, alignItems: 'center', marginBottom: Spacing.sm,
  },
  nextBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },

  reviewBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  reviewBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
