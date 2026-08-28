// app/creation/subclass.tsx
// Subclass choice screen for the creation wizard. Thin wrapper around the
// shared <SubclassPicker> (previously only reachable post-creation from the
// Features tab) — resolves pending 'subclass' choices already unlocked by
// the target level set during class selection (level 1 for Cleric/Sorcerer/
// Warlock, or any class whose unlock level is <= targetLevel when creating
// a character above level 1), then returns to the hub for the next one.
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { SubclassPicker } from '../../src/components/SubclassPicker';

export default function SubclassScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  const subclassChoices = draft?.choices.filter(c => c.definition.kind === 'subclass' && !c.resolved) ?? [];

  // Navigation guard — runs in an effect, never during render.
  useEffect(() => {
    if (!draft) {
      router.replace('/creation/name');
    } else if (subclassChoices.length === 0) {
      router.replace('/creation/hub');
    }
  }, [draft?.id, subclassChoices.length]);

  if (!draft || subclassChoices.length === 0) return null;

  return (
    <SubclassPicker
      entity={draft}
      choice={subclassChoices[0]}
      rules={rules}
      onResolved={(updated) => {
        setDraft(updated);
        router.push('/creation/hub');
      }}
    />
  );
}
