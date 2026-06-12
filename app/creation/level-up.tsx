// app/creation/level-up.tsx
// Ability Score Improvement / Feat screen for the creation wizard.
// Thin wrapper around the shared <AsiFeatPicker>; resolves pending ASI choices
// on the draft, then returns to the hub (which shows the next one, if any).
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
      onResolved={(updated) => {
        setDraft(updated);
        router.push('/creation/hub');
      }}
    />
  );
}
