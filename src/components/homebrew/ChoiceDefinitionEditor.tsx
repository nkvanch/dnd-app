// src/components/homebrew/ChoiceDefinitionEditor.tsx
// CHOICE-AUTHORING-1: shared homebrew authoring UI for structured
// ChoiceDefinitions (currently kinds 'expertise' | 'tool' | 'language' —
// see src/content/choiceDefinitionCompiler.ts's own header comment for how
// a future kind gets added). Mirrors TraitEditor.tsx's own split exactly:
// this file is the React layer, choiceDefinitionCompiler.ts is the plain-TS
// draft<->ChoiceDefinition compiler it wraps.
//
// Integration point: every builder that already manages a list of
// ChoiceDefinition-bearing content (Race/Subrace.pendingChoices,
// Background/Feat.pendingChoices, a ClassProgression/SubclassProgression
// level entry's own `choices`) renders <ChoiceDefinitionListEditor> and
// keeps `DraftChoice[]` as its own local state, compiling to
// `ChoiceDefinition[]` only at save time — same "draft state through the
// screen, compile once on save" shape TraitListEditor already established
// for DraftTrait/Feature.
import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  AuthorableChoiceKind, PoolMode, DraftChoice,
  newDraftChoice, validateDraftChoice, registryFor, categoryOrderFor, idsForCategories,
  poolSizeForDraft,
} from '../../content/choiceDefinitionCompiler';
import { TOOL_CATEGORY_LABELS } from '../../content/tools';
import { LANGUAGE_CATEGORY_LABELS } from '../../content/languages';
import { SafeBottomView } from '../SafeBottomView';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { styles as traitStyles } from './TraitEditor';

export type { DraftChoice, AuthorableChoiceKind, PoolMode };
export { newDraftChoice };

const KIND_LABELS: Record<AuthorableChoiceKind, string> = {
  expertise: 'Expertise', tool: 'Tool Proficiency', language: 'Language',
};
const KIND_ORDER: AuthorableChoiceKind[] = ['expertise', 'tool', 'language'];

const POOL_MODE_LABELS: Record<PoolMode, string> = {
  all: 'All eligible options',
  category: 'Category',
  restricted: 'Restricted list',
};

function categoryLabelsFor(kind: AuthorableChoiceKind): Record<string, string> {
  return kind === 'tool' ? TOOL_CATEGORY_LABELS : kind === 'language' ? LANGUAGE_CATEGORY_LABELS : {};
}

function allPoolNote(kind: AuthorableChoiceKind): string {
  if (kind === 'expertise') return 'Legal targets are computed live from the character — currently proficient skills that aren\'t already Expertise.';
  if (kind === 'tool') return 'Any tool not already known.';
  return 'Any normally-selectable language not already known — secret languages (Thieves\' Cant, Druidic) are excluded from this default pool; use a restricted list to include them explicitly.';
}

function summarizeDraft(draft: DraftChoice): string {
  const count = parseInt(draft.count, 10) || 0;
  const kindLabel = KIND_LABELS[draft.kind];
  const poolLabel =
    draft.poolMode === 'all' ? 'any eligible' :
    draft.poolMode === 'category' ? (draft.categories.length > 0
      ? draft.categories.map(c => categoryLabelsFor(draft.kind)[c] ?? c).join(', ')
      : '(no category selected)') :
    `${draft.restrictedIds.length} option${draft.restrictedIds.length === 1 ? '' : 's'}`;
  return `Choose ${count || '?'} · ${kindLabel} · ${poolLabel}`;
}

// ── Editor modal — configures ONE ChoiceDefinition ─────────────────────────

export function ChoiceDefinitionEditorModal({ draft, visible, onChange, onDone, onDelete }: {
  draft: DraftChoice | null;
  visible: boolean;
  onChange: (d: DraftChoice) => void;
  onDone: () => void;
  onDelete: () => void;
}) {
  if (!draft) return null;
  const set = (patch: Partial<DraftChoice>) => onChange({ ...draft, ...patch });

  const poolModes: PoolMode[] = draft.kind === 'expertise' ? ['all', 'restricted'] : ['all', 'category', 'restricted'];
  const registry = registryFor(draft.kind);
  const categories = categoryOrderFor(draft.kind);
  const errors = validateDraftChoice(draft);
  const poolSize = poolSizeForDraft(draft);

  function setKind(kind: AuthorableChoiceKind) {
    if (kind === draft!.kind) return;
    // Pool selections don't carry meaning across kinds (a tool id isn't a
    // language id) — reset rather than risk a stale, silently-wrong pool.
    onChange({ ...draft!, kind, poolMode: 'all', categories: [], restrictedIds: [] });
  }

  function toggleCategory(cat: string) {
    const active = draft!.categories.includes(cat);
    set({ categories: active ? draft!.categories.filter(c => c !== cat) : [...draft!.categories, cat] });
  }

  function toggleRestricted(id: string) {
    const active = draft!.restrictedIds.includes(id);
    set({ restrictedIds: active ? draft!.restrictedIds.filter(x => x !== id) : [...draft!.restrictedIds, id] });
  }

  // Group the restricted-pool checklist by category when the kind has one
  // (tool/language), otherwise a single flat list (expertise/skills).
  const grouped: { group: string | null; entries: typeof registry }[] = categories.length > 0
    ? categories.map(cat => ({ group: categoryLabelsFor(draft.kind)[cat] ?? cat, entries: registry.filter(o => o.category === cat) }))
    : [{ group: null, entries: registry }];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <Pressable style={traitStyles.backdrop} onPress={onDone}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
        <Pressable style={traitStyles.traitModalSheet} onPress={e => e.stopPropagation()}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={traitStyles.traitModalTitle}>Player Choice</Text>

            <Text style={traitStyles.fieldLabel}>Choice Type</Text>
            <View style={traitStyles.chipWrap}>
              {KIND_ORDER.map(k => (
                <Pressable key={k} style={[traitStyles.chip, draft.kind === k && traitStyles.chipActive]} onPress={() => setKind(k)}>
                  <Text style={[traitStyles.chipTxt, draft.kind === k && traitStyles.chipTxtActive]}>{KIND_LABELS[k]}</Text>
                </Pressable>
              ))}
            </View>

            <View style={traitStyles.rowInline}>
              <Text style={traitStyles.inlineLabel}>Choose:</Text>
              <TextInput style={[traitStyles.input, traitStyles.smallInput]} value={draft.count}
                onChangeText={v => set({ count: v })} keyboardType="number-pad" />
            </View>

            <Text style={traitStyles.fieldLabel}>Prompt (optional)</Text>
            <TextInput style={traitStyles.input} value={draft.prompt} onChangeText={v => set({ prompt: v })}
              placeholder="Shown to the player — defaults to a generic prompt if left blank"
              placeholderTextColor={Colors.textDim} />

            <Text style={traitStyles.fieldLabel}>Eligible Pool</Text>
            <View style={traitStyles.chipWrap}>
              {poolModes.map(m => (
                <Pressable key={m} style={[traitStyles.chip, draft.poolMode === m && traitStyles.chipActive]}
                  onPress={() => set({ poolMode: m })}>
                  <Text style={[traitStyles.chipTxt, draft.poolMode === m && traitStyles.chipTxtActive]}>{POOL_MODE_LABELS[m]}</Text>
                </Pressable>
              ))}
            </View>

            {draft.poolMode === 'all' && (
              <Text style={traitStyles.effectNote}>{allPoolNote(draft.kind)}</Text>
            )}

            {draft.poolMode === 'category' && (
              <View style={styles.poolPanel}>
                <View style={traitStyles.chipWrap}>
                  {categories.map(cat => {
                    const active = draft.categories.includes(cat);
                    return (
                      <Pressable key={cat} style={[traitStyles.chip, active && traitStyles.chipActive]} onPress={() => toggleCategory(cat)}>
                        <Text style={[traitStyles.chipTxt, active && traitStyles.chipTxtActive]}>{categoryLabelsFor(draft.kind)[cat] ?? cat}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={traitStyles.effectNote}>
                  Compiled to the specific {idsForCategories(draft.kind, draft.categories).length} option{idsForCategories(draft.kind, draft.categories).length === 1 ? '' : 's'} in
                  {' '}the selected categor{draft.categories.length === 1 ? 'y' : 'ies'} when saved.
                </Text>
              </View>
            )}

            {draft.poolMode === 'restricted' && (
              <View style={styles.poolPanel}>
                {grouped.map(g => (
                  <View key={g.group ?? '_'} style={{ gap: 4 }}>
                    {g.group && <Text style={traitStyles.effectGroupLabel}>{g.group}</Text>}
                    <View style={traitStyles.chipWrap}>
                      {g.entries.map(o => {
                        const active = draft.restrictedIds.includes(o.id);
                        return (
                          <Pressable key={o.id} style={[traitStyles.chip, active && traitStyles.chipActive]} onPress={() => toggleRestricted(o.id)}>
                            <Text style={[traitStyles.chipTxt, active && traitStyles.chipTxtActive]}>{o.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {draft.poolMode !== 'all' && (
              <Text style={styles.poolSizeNote}>Pool size: {poolSize}</Text>
            )}

            {errors.length > 0 && (
              <View style={styles.errorPanel}>
                {errors.map((e, i) => <Text key={i} style={styles.errorTxt}>⚠ {e}</Text>)}
              </View>
            )}

            <SafeBottomView>
              <View style={traitStyles.traitModalBtnRow}>
                <Pressable style={traitStyles.traitDeleteBtn} onPress={onDelete}>
                  <Text style={traitStyles.traitDeleteTxt}>Delete Choice</Text>
                </Pressable>
                <Pressable style={traitStyles.traitDoneBtn} onPress={onDone}>
                  <Text style={traitStyles.traitDoneTxt}>Done</Text>
                </Pressable>
              </View>
            </SafeBottomView>
          </ScrollView>
        </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ── List of choices + add flow ──────────────────────────────────────────────

export function ChoiceDefinitionListEditor({ choices, onChange, addLabel }: {
  choices: DraftChoice[];
  onChange: (choices: DraftChoice[]) => void;
  addLabel?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  function addChoice() {
    const d = newDraftChoice('tool');
    onChange([...choices, d]);
    setOpenId(d.localId);
  }
  function updateChoice(d: DraftChoice) {
    onChange(choices.map(x => x.localId === d.localId ? d : x));
  }
  function deleteChoice(localId: string) {
    onChange(choices.filter(x => x.localId !== localId));
    setOpenId(null);
  }

  const open = choices.find(c => c.localId === openId) ?? null;

  return (
    <View style={{ gap: Spacing.xs }}>
      {choices.map(c => {
        const invalid = validateDraftChoice(c).length > 0;
        return (
          <Pressable key={c.localId} style={traitStyles.traitCard} onPress={() => setOpenId(c.localId)}>
            <View style={{ flex: 1 }}>
              <Text style={traitStyles.traitCardName}>{KIND_LABELS[c.kind]} choice{invalid ? ' ⚠' : ''}</Text>
              <Text style={traitStyles.traitCardMeta}>{summarizeDraft(c)}</Text>
            </View>
            <Text style={traitStyles.traitCardCaret}>{'>'}</Text>
          </Pressable>
        );
      })}
      <Pressable style={styles.addBtn} onPress={addChoice}>
        <Text style={styles.addBtnTxt}>{addLabel ?? '+ Add Player Choice'}</Text>
      </Pressable>

      <ChoiceDefinitionEditorModal
        draft={open}
        visible={!!open}
        onChange={updateChoice}
        onDone={() => setOpenId(null)}
        onDelete={() => open && deleteChoice(open.localId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  poolPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.sm, marginTop: Spacing.xs,
  },
  poolSizeNote: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 4 },
  errorPanel: {
    backgroundColor: Colors.red + '11', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '55',
    padding: Spacing.sm, gap: 4, marginTop: Spacing.sm,
  },
  errorTxt: { color: Colors.red, fontSize: FontSize.xs },
  addBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed', padding: Spacing.sm, alignItems: 'center',
  },
  addBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
