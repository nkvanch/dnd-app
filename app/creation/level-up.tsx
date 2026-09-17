// app/creation/level-up.tsx
// Ability Score Improvement / Feat screen for the creation wizard.
// Thin wrapper around the shared <AsiFeatPicker>. REPEATED-CHOICE-1: a
// directly-created high-level character can queue several ASI-kind choices
// at once (one per ASI-granting level reached) — this used to navigate back
// to the hub after resolving EACH ONE, forcing the player to re-tap into
// this screen for every remaining choice (the exact "category list → choose
// one → category list → choose one" bounce the repeated-choice UX rule
// forbids). Now it stays on this screen, resolving one choice per tap,
// until none remain, only THEN returning to the hub.
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { AsiFeatPicker } from '../../src/components/AsiFeatPicker';

export default function LevelUpScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  const asiChoices = draft?.choices.filter(c => c.definition.kind === 'asi' && !c.resolved) ?? [];

  // Navigation guard — runs in an effect, never during render.
  useEffect(() => {
    if (!draft) {
      router.replace('/creation/name');
    } else if (asiChoices.length === 0) {
      router.replace('/creation/hub');
    }
  }, [draft?.id, asiChoices.length]);

  if (!draft || asiChoices.length === 0) return null;

  return (
    <AsiFeatPicker
      entity={draft}
      choice={asiChoices[0]}
      rules={rules}
      progressNote={asiChoices.length > 1 ? `${asiChoices.length - 1} more ASI/feat choice${asiChoices.length - 1 === 1 ? '' : 's'} after this one` : undefined}
      browseStateKey="feat:levelup"
      onResolved={(updated) => {
        // Stay on this screen — the navigation effect above only leaves for
        // the hub once `asiChoices` (re-derived from the updated draft)
        // is actually empty.
        setDraft(updated);
      }}
    />
  );
}
