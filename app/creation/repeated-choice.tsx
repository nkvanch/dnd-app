// app/creation/repeated-choice.tsx
// CHOICE-EXPANSION-1: shared creation-flow screen for Expertise/Tool/Language
// choices — one file instead of three near-identical screens, parametrized
// by `?kind=`. Mirrors level-up.tsx's own REPEATED-CHOICE-1 pattern exactly:
// stays on-screen resolving one choice of this kind at a time until none
// remain, THEN returns to the hub — never bounces back to the hub between
// individual choices within the same kind.
//
// Expertise-choice deadlock/edit closure: Expertise specifically (not Tool/
// Language — see the closure's own report for why those weren't touched)
// gained two behaviors on top of the above:
//   1. The completion count is capped at however many distinct skills are
//      actually eligible right now (effectiveRequiredCount, leveling.ts),
//      so a choice asking for more than exist can still complete instead of
//      permanently blocking creation.
//   2. Once every Expertise choice of this character is resolved, this
//      screen stays reachable (from the hub's "Current Progress" list,
//      which already lets you tap ANY section regardless of done-state) as
//      an EDIT view showing the current selections, rather than
//      immediately bouncing back to the hub — so changing a pick no longer
//      requires backing out of the choice entirely.
import { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { applyExpertiseChoiceToEntity, applyToolChoiceToEntity, applyLanguageChoiceToEntity, effectiveRequiredCount, withExpertiseChoiceGrantStripped } from '../../src/engine/leveling';
import { eligibleExpertiseOptions, eligibleToolOptions, eligibleLanguageOptions } from '../../src/engine/choiceEligibility';
import { ALL_SKILL_OPTIONS } from '../../src/content/skills';
import { RepeatedChoicePicker, RepeatedChoiceOption } from '../../src/components/RepeatedChoicePicker';
import { TOOL_CATEGORY_LABELS, TOOL_CATEGORY_ORDER } from '../../src/content/tools';
import { LANGUAGE_CATEGORY_LABELS, LANGUAGE_CATEGORY_ORDER } from '../../src/content/languages';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../src/theme';
import { Alert } from '../../src/utils/alert';

type Kind = 'expertise' | 'tool' | 'language';

const KIND_CONFIG: Record<Kind, {
  heading: string;
  searchable?: boolean;
  groupLabels?: Record<string, string>;
  groupOrder?: string[];
  eligible: typeof eligibleExpertiseOptions;
  emptyMessage: string;
  commitLabel: (n: number) => string;
  apply: typeof applyExpertiseChoiceToEntity;
}> = {
  expertise: {
    heading: 'Choose Expertise', searchable: false,
    eligible: eligibleExpertiseOptions,
    emptyMessage: 'No eligible skills right now — Expertise requires existing proficiency. Resolve any pending skill-proficiency choices first.',
    commitLabel: n => `Grant Expertise in ${n} Skill${n !== 1 ? 's' : ''} →`,
    apply: applyExpertiseChoiceToEntity,
  },
  tool: {
    heading: 'Choose Tool Proficiency',
    groupLabels: TOOL_CATEGORY_LABELS, groupOrder: TOOL_CATEGORY_ORDER,
    eligible: eligibleToolOptions,
    emptyMessage: "No eligible tools right now — you may already be proficient with everything in this choice's pool.",
    commitLabel: n => `Grant Proficiency in ${n} Tool${n !== 1 ? 's' : ''} →`,
    apply: applyToolChoiceToEntity,
  },
  language: {
    heading: 'Choose Languages',
    groupLabels: LANGUAGE_CATEGORY_LABELS, groupOrder: LANGUAGE_CATEGORY_ORDER,
    eligible: eligibleLanguageOptions,
    emptyMessage: "No eligible languages right now — you may already know everything in this choice's pool.",
    commitLabel: n => `Learn ${n} Language${n !== 1 ? 's' : ''} →`,
    apply: applyLanguageChoiceToEntity,
  },
};

/**
 * Expertise stale-eligibility closure: `legalOptions` (computed against the
 * grant-stripped entity — see withExpertiseChoiceGrantStripped, leveling.ts)
 * already correctly excludes a selection that's stale for a REAL reason
 * (e.g. an earlier proficiency choice changed since, so the skill isn't
 * trained at all anymore). This merges the choice's CURRENT selections back
 * in ONLY for display/repair purposes — so the user can see and deselect a
 * now-invalid pick — never as a legality signal. The caller must keep
 * `legalOptions` (not this merged result) as the source of truth for
 * effectiveRequired/completion — see requiredCount's own comment below.
 * Harmless no-op for a not-yet-resolved choice (selections is empty) or for
 * tool/language (never called for those kinds).
 */
function mergeStaleSelections(legalOptions: RepeatedChoiceOption[], selections: string[]): RepeatedChoiceOption[] {
  const known = new Set(legalOptions.map(o => o.id));
  const stale = selections
    .filter(id => !known.has(id))
    .map(id => ALL_SKILL_OPTIONS.find(s => s.id === id))
    .filter((s): s is typeof ALL_SKILL_OPTIONS[number] => s !== undefined)
    .map(s => ({ id: s.id, label: s.label, sublabel: 'No longer eligible' }));
  return stale.length === 0 ? legalOptions : [...legalOptions, ...stale];
}

export default function RepeatedChoiceScreen() {
  const router   = useRouter();
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();
  const kind: Kind = (kindParam === 'tool' || kindParam === 'language') ? kindParam : 'expertise';
  const config = KIND_CONFIG[kind];
  const isExpertise = kind === 'expertise';

  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);
  const [error, setError] = useState<string | null>(null);

  const allOfKind = draft?.choices.filter(c => c.definition.kind === kind) ?? [];
  const pending    = allOfKind.filter(c => !c.resolved);
  // Expertise-only: once nothing of this kind is pending, fall back to the
  // LAST choice of this kind so it stays reachable for editing rather than
  // vanishing entirely. Tool/Language are unaffected (this is always null
  // for them) — see the closure's own report for why those weren't
  // generalized this pass.
  const editableResolved = isExpertise && pending.length === 0 && allOfKind.length > 0
    ? allOfKind[allOfKind.length - 1]
    : null;
  const choice = pending[0] ?? editableResolved ?? null;

  // Distinguishes "this choice JUST became fully resolved during this visit"
  // (auto-advance to the hub, exactly like before this closure) from "I
  // navigated here directly while it was ALREADY resolved" (a deliberate
  // reopen from the hub's Current Progress list — stay and show the edit
  // view). Captured once, on the first render this screen has a real draft,
  // and never recomputed afterward.
  const arrivedAlreadyResolvedRef = useRef<boolean | null>(null);
  if (arrivedAlreadyResolvedRef.current === null && draft) {
    arrivedAlreadyResolvedRef.current = editableResolved !== null;
  }
  const isEditReentry = arrivedAlreadyResolvedRef.current === true;

  useEffect(() => {
    if (!draft) router.replace('/creation/name');
    // Auto-advance to the hub once nothing of this kind is pending anymore
    // — UNLESS this visit is a deliberate reopen of an already-resolved
    // Expertise choice (isEditReentry), in which case the screen stays put
    // showing the edit view instead of bouncing straight back.
    else if (pending.length === 0 && !isEditReentry) router.replace('/creation/hub');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, pending.length, isEditReentry]);

  if (!draft || !choice) return null;

  // Expertise stale-eligibility closure (Codex re-audit): eligibility is
  // computed against the GRANT-STRIPPED entity — the exact same input
  // applyExpertiseChoiceToEntity itself will validate against — never the
  // raw, un-stripped draft. This is what makes `legalOptions` an accurate
  // answer to "what could this choice legally select right now", including
  // correctly EXCLUDING a selection that's stale for a reason other than
  // "this choice's own grant is in the way" (e.g. an earlier proficiency
  // choice changed since — see withExpertiseChoiceGrantStripped's own doc
  // comment, leveling.ts). No-op for tool/language and for a not-yet-
  // resolved choice.
  const strippedDraft = isExpertise ? withExpertiseChoiceGrantStripped(draft, choice.id, rules) : draft;
  const legalOptions: RepeatedChoiceOption[] = config.eligible(strippedDraft, choice.definition.pool);
  // `displayOptions` additionally includes the choice's CURRENT selections
  // purely so a genuinely-stale pick stays visible/removable — see
  // mergeStaleSelections' own doc comment. NEVER used for legality/count —
  // that's `legalOptions` alone, below.
  const displayOptions = isExpertise && choice.resolved
    ? mergeStaleSelections(legalOptions, choice.selections)
    : legalOptions;
  // Expertise-choice deadlock closure (Part A/B), corrected: the effective
  // completion count is capped by how many options are actually LEGAL right
  // now — never by how many are merely DISPLAYED (a stale selection must
  // never inflate this). Tool/Language keep validating against the raw
  // nominal count (unchanged) since their apply functions weren't updated
  // this pass.
  const requiredCount = isExpertise
    ? effectiveRequiredCount(choice.definition.count, legalOptions.length)
    : choice.definition.count;
  const legalOptionIds = isExpertise ? new Set(legalOptions.map(o => o.id)) : undefined;

  return (
    <View style={styles.container}>
      {pending.length > 1 && (
        <Text style={styles.progressNote}>{pending.length - 1} more {kind} choice{pending.length - 1 === 1 ? '' : 's'} after this one</Text>
      )}
      {isEditReentry && (
        <Text style={styles.progressNote}>Editing your current selection — tap a row to change it.</Text>
      )}
      <RepeatedChoicePicker
        heading={config.heading}
        prompt={choice.definition.prompt}
        requiredCount={requiredCount}
        nominalCount={isExpertise ? choice.definition.count : undefined}
        options={displayOptions}
        legalOptionIds={legalOptionIds}
        initialSelected={choice.resolved ? choice.selections : undefined}
        searchable={config.searchable}
        groupLabels={config.groupLabels}
        groupOrder={config.groupOrder}
        emptyMessage={config.emptyMessage}
        commitLabel={config.commitLabel}
        error={error}
        onClose={isEditReentry ? () => router.push('/creation/hub') : undefined}
        onCommit={(sel) => {
          try {
            setDraft(config.apply(draft, choice.id, sel, rules));
            setError(null);
            // Stay on this screen — the navigation effect above only leaves
            // for the hub once `pending` (re-derived from the updated
            // draft) is actually empty AND this wasn't a deliberate reopen
            // (REPEATED-CHOICE-1's own auto-advance pattern, preserved for
            // the first-time-completion case).
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            Alert.alert('Could not resolve choice', msg);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  progressNote: {
    fontSize: FontSize.sm, color: Colors.textDim, fontWeight: FontWeight.bold,
    textAlign: 'center', paddingTop: Spacing.md,
  },
});
