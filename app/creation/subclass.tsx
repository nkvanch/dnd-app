// app/creation/subclass.tsx
// Subclass choice screen for the creation wizard. Thin wrapper around the
// shared <SubclassPicker> (previously only reachable post-creation from the
// Features tab) — resolves pending 'subclass' choices already unlocked by
// the target level set during class selection (level 1 for Cleric/Sorcerer/
// Warlock, or any class whose unlock level is <= targetLevel when creating
// a character above level 1), then returns to the hub for the next one.
import { useEffect, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { applySubclassToEntity } from '../../src/engine/leveling';
import { subclassEntriesForClassMerged } from '../../src/content/subclasses/subclassBrowse';
import { SubclassPicker } from '../../src/components/SubclassPicker';

export default function SubclassScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  // SUBCLASS-CHANGE-1: this screen used to only ever look at UNRESOLVED
  // subclass choices — once the player picked one, choice.resolved became
  // true, this list went permanently empty, and the effect below bounced
  // straight back to the hub, making the choice unreachable to revise.
  // Prefer an unresolved choice (first-time pick, unchanged behavior);
  // fall back to the most recently resolved one so re-opening this screen
  // (e.g. tapping "Subclass" on the hub again) lets the player change
  // their mind instead of silently doing nothing.
  const allSubclassChoices = draft?.choices.filter(c => c.definition.kind === 'subclass') ?? [];
  const unresolvedChoice   = allSubclassChoices.find(c => !c.resolved);
  const activeChoice       = unresolvedChoice ?? [...allSubclassChoices].reverse().find(c => c.resolved);

  // Navigation guard — runs in an effect, never during render.
  useEffect(() => {
    if (!draft) {
      router.replace('/creation/name');
    } else if (!activeChoice) {
      router.replace('/creation/hub');
    }
  }, [draft?.id, activeChoice?.id]);

  // NESTED-HOMEBREW-1 / SAVE-AND-ADD-1: auto-select a subclass just
  // created via "+ Create New Homebrew Subclass" once its builder saves
  // and returns here. Lives in this route file (not inside the shared
  // SubclassPicker component) specifically so it can safely use
  // useFocusEffect — the same race-condition fix already proven for
  // race.tsx/background.tsx applies here too, since resolving the choice
  // can itself navigate on to the hub (a competing navigation against the
  // builder's own goBack() if a plain useEffect fired while backgrounded).
  useFocusEffect(
    useCallback(() => {
      const newId = usePendingSelectionStore.getState().consumePending('subclass_picker');
      if (!newId || !draft || !activeChoice) return;
      const forClassId = activeChoice.definition.forClassId ?? draft.identity.classId;
      const homebrewSubclasses = useHomebrewStore.getState().subclasses;
      const entry = subclassEntriesForClassMerged(forClassId, homebrewSubclasses).find(e => e.id === newId);
      // Saved successfully either way — if it doesn't resolve to a valid
      // entry for THIS class (e.g. authored for a different class), leave
      // it unselected rather than crashing; the player can still find and
      // pick it from the Homebrew tab if that was a mistake.
      if (!entry) return;
      const updated = applySubclassToEntity(draft, activeChoice.id, newId, entry.progression, rules, activeChoice.definition.forClassId);
      setDraft(updated);
      const stillPending = updated.choices.some(c => c.definition.kind === 'subclass' && !c.resolved);
      if (!stillPending) router.push('/creation/hub');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft?.id, activeChoice?.id, rules])
  );

  if (!draft || !activeChoice) return null;

  return (
    <SubclassPicker
      entity={draft}
      choice={activeChoice}
      rules={rules}
      onCreateNewSubclass={() => router.push(`/homebrew/subclass-builder?classId=${activeChoice.definition.forClassId ?? draft.identity.classId ?? ''}`)}
      onResolved={(updated) => {
        // REPEATED-CHOICE-1: stay on this screen if another class (rare,
        // but real for a directly-created multiclass character where more
        // than one class's subclass unlocks by the target level) still has
        // an unresolved subclass choice — only leave for the hub once none
        // remain, instead of bouncing back after every single pick.
        setDraft(updated);
        const stillPending = updated.choices.some(c => c.definition.kind === 'subclass' && !c.resolved);
        if (!stillPending) router.push('/creation/hub');
      }}
    />
  );
}
