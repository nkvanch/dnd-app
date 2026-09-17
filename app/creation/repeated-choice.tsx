// app/creation/repeated-choice.tsx
// CHOICE-EXPANSION-1: shared creation-flow screen for Expertise/Tool/Language
// choices — one file instead of three near-identical screens, parametrized
// by `?kind=`. Mirrors level-up.tsx's own REPEATED-CHOICE-1 pattern exactly:
// stays on-screen resolving one choice of this kind at a time until none
// remain, THEN returns to the hub — never bounces back to the hub between
// individual choices within the same kind.
import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { applyExpertiseChoiceToEntity, applyToolChoiceToEntity, applyLanguageChoiceToEntity } from '../../src/engine/leveling';
import { eligibleExpertiseOptions, eligibleToolOptions, eligibleLanguageOptions } from '../../src/engine/choiceEligibility';
import { RepeatedChoicePicker, RepeatedChoiceOption } from '../../src/components/RepeatedChoicePicker';
import { TOOL_CATEGORY_LABELS, TOOL_CATEGORY_ORDER } from '../../src/content/tools';
import { LANGUAGE_CATEGORY_LABELS, LANGUAGE_CATEGORY_ORDER } from '../../src/content/languages';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../src/theme';
import { useState } from 'react';
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

export default function RepeatedChoiceScreen() {
  const router   = useRouter();
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();
  const kind: Kind = (kindParam === 'tool' || kindParam === 'language') ? kindParam : 'expertise';
  const config = KIND_CONFIG[kind];

  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);
  const [error, setError] = useState<string | null>(null);

  const pending = draft?.choices.filter(c => c.definition.kind === kind && !c.resolved) ?? [];

  useEffect(() => {
    if (!draft) router.replace('/creation/name');
    else if (pending.length === 0) router.replace('/creation/hub');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, pending.length]);

  if (!draft || pending.length === 0) return null;

  const choice  = pending[0];
  const options: RepeatedChoiceOption[] = config.eligible(draft, choice.definition.pool);

  return (
    <View style={styles.container}>
      {pending.length > 1 && (
        <Text style={styles.progressNote}>{pending.length - 1} more {kind} choice{pending.length - 1 === 1 ? '' : 's'} after this one</Text>
      )}
      <RepeatedChoicePicker
        heading={config.heading}
        prompt={choice.definition.prompt}
        requiredCount={choice.definition.count}
        options={options}
        searchable={config.searchable}
        groupLabels={config.groupLabels}
        groupOrder={config.groupOrder}
        emptyMessage={config.emptyMessage}
        commitLabel={config.commitLabel}
        error={error}
        onCommit={(sel) => {
          try {
            setDraft(config.apply(draft, choice.id, sel, rules));
            setError(null);
            // Stay on this screen — the navigation effect above only leaves
            // for the hub once `pending` (re-derived from the updated
            // draft) is actually empty (REPEATED-CHOICE-1's own pattern).
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
