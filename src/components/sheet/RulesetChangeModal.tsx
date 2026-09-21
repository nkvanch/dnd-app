// src/components/sheet/RulesetChangeModal.tsx
// LIVE-RULESET-1: "Change Ruleset" — pick a target ruleset (same Game as
// the character's current one, per item 33's explicit cross-game gate),
// preview the consequences via simulateRulesetChange() (engine/
// rulesetChange.ts), then confirm. Two-step modal (picker -> preview),
// same Modal/backdrop/sheet shell every other sheet-preview modal in this
// app already uses (RestPreviewModal, LevelUpPreviewModal, etc.).
//
// CRITICAL correctness point, same rule every other preview-then-commit
// modal in this codebase already follows: the caller must apply
// `preview.after` verbatim on Confirm — never recompute the change a
// second time.
import { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Entity, CampaignRules, HomebrewSubclass, RulesetId } from '../../engine/types';
import { simulateRulesetChange, canApplyRulesetChange, RulesetChangePreview, RulesetChangeContentItem } from '../../engine/rulesetChange';
import { useHomebrewStore } from '../../store/homebrewStore';
import { RULESETS, rulesetLabel } from '../../content/rulesets';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { useCustomRuleProfileStore } from '../../store/customRuleProfileStore';
import { rulesetPickerViewModel } from './ruleProfileUi';

interface Props {
  visible:   boolean;
  entity:    Entity;
  rules:     CampaignRules;
  /** Applies `preview.after` verbatim — never re-derive the change. */
  onConfirm: (updated: Entity, label: string) => void;
  onCancel:  () => void;
}

const TYPE_LABEL: Record<RulesetChangeContentItem['type'], string> = {
  race: 'Race', subrace: 'Subrace', class: 'Class', subclass: 'Subclass',
  background: 'Background', feat: 'Feat', spell: 'Spell', item: 'Item', condition: 'Condition',
};

export function RulesetChangeModal({ visible, entity, rules, onConfirm, onCancel }: Props) {
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const homebrewSubclasses: HomebrewSubclass[] = useHomebrewStore(s => s.subclasses);
  const customProfiles = useCustomRuleProfileStore(s => s.profiles);

  const [targetRulesetId, setTargetRulesetId] = useState<RulesetId | undefined | null>(null); // null = picker step
  const [targetProfileId, setTargetProfileId] = useState<string | undefined>(undefined);

  function reset() {
    setTargetRulesetId(null);
    setTargetProfileId(undefined);
  }

  // item 33: only rulesets belonging to the SAME Game as the character's
  // current ruleset are offered — this app's engine can't yet safely
  // resolve a character across Games (see rulesetChange.ts's own scope
  // note). item 5: distinguish "untagged" (entity.rulesetId undefined —
  // legitimately defaults to 'dnd', the only Game any real character
  // exists under today) from "explicitly set to a ruleset this registry
  // doesn't recognize" — the latter must NOT silently guess 'dnd' too,
  // since that would hide a real data problem behind a plausible-looking
  // default. rulesetKnown is false only in that second case.
  const rulesetKnown = entity.rulesetId === undefined || RULESETS[entity.rulesetId] !== undefined;
  // Degraded recovery (item 5): when the current ruleset is set but
  // unrecognized, there's no Game to narrow by — offer every registered
  // ruleset instead of guessing, with the banner below making that explicit.
  const picker = useMemo(() => rulesetPickerViewModel(entity, customProfiles), [entity, customProfiles]);
  const availableRulesets = picker.official;
  const availableProfiles = picker.custom;
  const currentProfile = customProfiles.find(profile => profile.id === entity.customRuleProfileId);

  const preview: RulesetChangePreview | null = useMemo(() => {
    if (targetRulesetId === null) return null;
    const universalDB = getMergedContentDB();
    const targetDB = getMergedContentDB(targetRulesetId);
    return simulateRulesetChange(entity, targetRulesetId, universalDB, targetDB, homebrewSubclasses, rules);
  }, [targetRulesetId, entity, homebrewSubclasses, rules, getMergedContentDB]);

  function handleClose() {
    reset();
    onCancel();
  }

  function handleConfirm() {
    if (!preview || !canApplyRulesetChange(preview)) return;
    const fromLabel = rulesetLabel(entity.rulesetId) ?? 'Untagged';
    const profile = customProfiles.find(candidate => candidate.id === targetProfileId);
    const toLabel = profile?.name ?? rulesetLabel(targetRulesetId ?? undefined) ?? 'Untagged';
    onConfirm({ ...preview.after, customRuleProfileId: profile?.id }, `Rules changed: ${fromLabel} → ${toLabel}`);
    reset();
  }

  const incompatible = preview?.content.filter(c => c.category === 'incompatible') ?? [];
  const unresolved = preview?.content.filter(c => c.category === 'unresolved') ?? [];
  const compatibleCount = preview?.content.filter(c => c.category === 'compatible').length ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <ScrollView>
            <Text style={styles.title}>Change Ruleset</Text>

            {targetRulesetId === null ? (
              <>
                <Text style={styles.label}>Current Ruleset</Text>
                <Text style={styles.currentTxt}>
                  {currentProfile?.name ?? (rulesetKnown ? (rulesetLabel(entity.rulesetId) ?? 'Untagged (legacy)') : entity.rulesetId)}
                </Text>
                {rulesetKnown && entity.rulesetId === undefined && (
                  <Text style={styles.gameNote}>
                    {/* LIVE-RULESET-4 (item 8): every character created since this
                        feature shipped gets a real rulesetId at creation — an
                        untagged character here predates that and is preserved
                        exactly as-is (never auto-migrated). Pick a ruleset below
                        to give it one explicitly, whenever you're ready. */}
                    This character was created before ruleset tagging existed. It still works normally — pick a
                    ruleset below whenever you want to give it one explicitly.
                  </Text>
                )}
                {!rulesetKnown && (
                  <Text style={styles.warnBanner}>
                    This character's ruleset ("{entity.rulesetId}") isn't recognized, so its Game can't be
                    determined — showing every known ruleset below instead of narrowing by Game. Pick carefully;
                    the original value is preserved unless you actually confirm a switch.
                  </Text>
                )}
                {currentProfile && <Text style={styles.gameNote}>Based on {rulesetLabel(currentProfile.baseRulesetId)}</Text>}
                <Text style={styles.label}>Official</Text>
                {availableRulesets.map(r => (
                  <Pressable key={r.id} style={styles.rulesetRow} onPress={() => { setTargetProfileId(undefined); setTargetRulesetId(r.id); }}>
                    <Text style={styles.rulesetRowTxt}>{r.name}</Text>
                    {!entity.customRuleProfileId && r.id === entity.rulesetId && <Text style={styles.currentBadge}>current</Text>}
                  </Pressable>
                ))}
                {availableProfiles.length > 0 && <>
                  <Text style={styles.label}>Custom / Homebrew</Text>
                  {availableProfiles.map(profile => <Pressable key={profile.id} style={styles.rulesetRow} onPress={() => { setTargetProfileId(profile.id); setTargetRulesetId(profile.baseRulesetId); }}>
                    <View><Text style={styles.rulesetRowTxt}>{profile.name}</Text><Text style={styles.gameNote}>Based on {rulesetLabel(profile.baseRulesetId)}</Text></View>
                    {profile.id === entity.customRuleProfileId && <Text style={styles.currentBadge}>current</Text>}
                  </Pressable>)}
                </>}
                <Text style={styles.gameNote}>
                  {rulesetKnown
                    ? "Only rulesets compatible with this character's Game are shown."
                    : 'Every registered ruleset is shown — this character\'s current Game could not be determined.'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  {currentProfile?.name ?? rulesetLabel(entity.rulesetId) ?? 'Untagged'} → {customProfiles.find(p => p.id === targetProfileId)?.name ?? rulesetLabel(targetRulesetId) ?? 'Untagged'}
                </Text>

                {preview?.blocked ? (
                  <Text style={styles.blockedTxt}>{preview.blockedReason ?? 'This switch was refused.'}</Text>
                ) : preview?.sameRuleset ? (
                  <Text style={styles.emptyTxt}>That's already this character's current ruleset.</Text>
                ) : (
                  <>
                    <Text style={styles.warnBanner}>
                      This may change what's compatible for future picks and diagnostics. Existing content is never removed or silently replaced.
                    </Text>

                    {compatibleCount > 0 && (
                      <Text style={styles.sectionSummary}>✓ {compatibleCount} reference{compatibleCount === 1 ? '' : 's'} stay compatible.</Text>
                    )}

                    {incompatible.length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>NO LONGER COMPATIBLE ({incompatible.length})</Text>
                        {incompatible.map(item => (
                          <Text key={`${item.type}:${item.id}`} style={styles.rowTxt}>
                            {TYPE_LABEL[item.type]}: {item.name}
                          </Text>
                        ))}
                      </View>
                    )}

                    {unresolved.length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>UNRESOLVED ({unresolved.length})</Text>
                        {unresolved.map(item => (
                          <Text key={`${item.type}:${item.id}`} style={styles.rowTxt}>
                            {TYPE_LABEL[item.type]}: {item.name}
                          </Text>
                        ))}
                      </View>
                    )}

                    {preview && preview.derivedChanges.length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>DERIVED CHANGES</Text>
                        {preview.derivedChanges.map((row, i) => (
                          <Text key={i} style={styles.rowTxt}>{row.label}</Text>
                        ))}
                      </View>
                    )}

                    {preview && preview.invalidatedChoices.length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>EXISTING CHOICES NO LONGER VALID</Text>
                        {preview.invalidatedChoices.map(c => (
                          <Text key={c.id} style={styles.rowTxt}>{c.prompt}</Text>
                        ))}
                      </View>
                    )}

                    {preview && preview.pendingChoices.length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>STILL PENDING</Text>
                        {preview.pendingChoices.map(c => (
                          <Text key={c.id} style={styles.rowTxt}>{c.prompt}</Text>
                        ))}
                      </View>
                    )}

                    {incompatible.length === 0 && unresolved.length === 0 &&
                     (!preview || preview.invalidatedChoices.length === 0) && (
                      <Text style={styles.emptyTxt}>No incompatibilities found.</Text>
                    )}
                  </>
                )}

                <Pressable style={styles.backLink} onPress={() => setTargetRulesetId(null)}>
                  <Text style={styles.backLinkTxt}>← Choose a different ruleset</Text>
                </Pressable>
              </>
            )}

            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
              {targetRulesetId !== null && (
                <Pressable
                  style={[styles.confirmBtn, (!preview || !canApplyRulesetChange(preview)) && styles.confirmBtnDisabled]}
                  disabled={!preview || !canApplyRulesetChange(preview)}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmTxt}>Change Ruleset</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, maxHeight: '85%',
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xs },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, marginTop: Spacing.sm },
  currentTxt: { fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },

  rulesetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginTop: Spacing.xs,
  },
  rulesetRowTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  currentBadge: { fontSize: FontSize.xs, color: Colors.gold },
  gameNote: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: Spacing.sm, fontStyle: 'italic' },

  warnBanner: {
    fontSize: FontSize.xs, color: Colors.textSecondary, backgroundColor: Colors.surface,
    borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.xs,
  },
  sectionSummary: { fontSize: FontSize.sm, color: Colors.green, marginBottom: Spacing.xs },
  emptyTxt: { fontSize: FontSize.md, color: Colors.textDim, textAlign: 'center', paddingVertical: Spacing.md },
  blockedTxt: { fontSize: FontSize.sm, color: Colors.red, textAlign: 'center', paddingVertical: Spacing.md, fontWeight: FontWeight.bold },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginTop: Spacing.xs, gap: 2,
  },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 2 },
  rowTxt: { fontSize: FontSize.sm, color: Colors.textPrimary },

  backLink: { alignSelf: 'center', marginTop: Spacing.sm },
  backLinkTxt: { fontSize: FontSize.xs, color: Colors.gold },

  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.xs },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center',
  },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  confirmBtn: { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
