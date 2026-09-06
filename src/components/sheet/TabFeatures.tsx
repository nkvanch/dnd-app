// app/sheet/TabFeatures.tsx
// Tab 4 — Features grouped by source, plus spells if applicable.
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Entity, FeatureInstance, ActionCard, CampaignRules } from '../../engine/types';
import { resolveChoice } from '../../engine/leveling';
import { Alert } from '../../utils/alert';
import { AsiFeatPicker } from '../AsiFeatPicker';
import { SubclassPicker } from '../SubclassPicker';
import { InfusionPicker } from '../InfusionPicker';
import { FeaturePoolPicker } from '../FeaturePoolPicker';
import { SpellChoicePicker } from '../SpellChoicePicker';
import { RemoveFeatureModal } from './RemoveFeatureModal';
import { spellRepo } from '../../content/spellRepo';
import { DEFAULT_RULES } from '../../store/characterStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const SOURCE_ORDER = ['race','class','subclass','background','feat','item','spell','condition','campaign','manual'] as const;
const SOURCE_LABELS: Record<string, string> = {
  race: 'Race', class: 'Class', subclass: 'Subclass',
  background: 'Background', feat: 'Feat', item: 'Item',
  spell: 'Spell', condition: 'Condition', campaign: 'Campaign',
  // Deliberately its own group, distinct from 'campaign' — 'campaign' stays
  // reserved for the two existing single-slot manual-senses/manual-movement
  // features (TabCharacter.tsx), which are always-overwritten single slots,
  // not many independently-removable entries like 'manual' features are.
  manual: 'Manual',
};

// Matches app/creation/skills.tsx's SKILL_LABELS — some subclass features
// (e.g. Bard College of Lore's Additional Proficiencies) grant "choose N of
// ANY skill" and mark it with the pool:'all' sentinel rather than a literal
// option array (same convention as spellChoice() in classes/index.ts).
const ALL_SKILL_OPTIONS: { id: string; label: string; value: string }[] = [
  { id: 'athletics', label: 'Athletics', value: 'athletics' },
  { id: 'acrobatics', label: 'Acrobatics', value: 'acrobatics' },
  { id: 'sleight_of_hand', label: 'Sleight of Hand', value: 'sleight_of_hand' },
  { id: 'stealth', label: 'Stealth', value: 'stealth' },
  { id: 'arcana', label: 'Arcana', value: 'arcana' },
  { id: 'history', label: 'History', value: 'history' },
  { id: 'investigation', label: 'Investigation', value: 'investigation' },
  { id: 'nature', label: 'Nature', value: 'nature' },
  { id: 'religion', label: 'Religion', value: 'religion' },
  { id: 'animal_handling', label: 'Animal Handling', value: 'animal_handling' },
  { id: 'insight', label: 'Insight', value: 'insight' },
  { id: 'medicine', label: 'Medicine', value: 'medicine' },
  { id: 'perception', label: 'Perception', value: 'perception' },
  { id: 'survival', label: 'Survival', value: 'survival' },
  { id: 'deception', label: 'Deception', value: 'deception' },
  { id: 'intimidation', label: 'Intimidation', value: 'intimidation' },
  { id: 'performance', label: 'Performance', value: 'performance' },
  { id: 'persuasion', label: 'Persuasion', value: 'persuasion' },
];

function FeatureRow({ feature, onRemove }: { feature: FeatureInstance; onRemove?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable style={styles.featureRow} onPress={() => setExpanded(e => !e)}>
      <View style={styles.featureHeader}>
        <Text style={styles.featureName}>{feature.name}</Text>
        {onRemove && (
          <Pressable hitSlop={8} onPress={() => onRemove(feature.id)}>
            <Text style={styles.featureRemoveBtn}>✕</Text>
          </Pressable>
        )}
        <Text style={styles.featureChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <Text style={styles.featureDesc}>{feature.description}</Text>
      )}
    </Pressable>
  );
}

function SpellCardRow({ card }: { card: ActionCard }) {
  const [expanded, setExpanded] = useState(false);
  const spell = spellRepo.getSpellSync(card.featureId);
  const borderColor = card.color === 'red' ? Colors.red : card.color === 'green' ? Colors.green : card.color === 'blue' ? Colors.blue : card.color === 'purple' ? Colors.purple : Colors.textDim;
  return (
    <Pressable style={[styles.spellCard, { borderLeftColor: borderColor }]} onPress={() => setExpanded(e => !e)}>
      <View style={styles.spellHeader}>
        <View style={styles.spellInfo}>
          <Text style={styles.spellName}>{card.name}</Text>
          <Text style={styles.spellL1}>{card.layer1}</Text>
          <Text style={styles.spellL2}>{card.layer2}</Text>
          {card.layer3 ? <Text style={styles.spellL3}>{card.layer3}</Text> : null}
        </View>
        <Text style={styles.featureChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && spell && (
        <View style={styles.spellExpanded}>
          <Text style={styles.spellDesc}>{spell.description}</Text>
          {spell.upcast && <Text style={styles.spellUpcast}>At Higher Levels: {spell.upcast}</Text>}
          <Text style={styles.spellMeta}>
            {spell.castingTime}  ·  {spell.range}  ·  {spell.duration}
          </Text>
          <Text style={styles.spellComponents}>Components: {spell.components.join(', ')}</Text>
        </View>
      )}
    </Pressable>
  );
}

function CollapsibleGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.group}>
      <Pressable style={styles.groupHeader} onPress={() => setOpen(o => !o)}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.featureChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && <View style={styles.groupBody}>{children}</View>}
    </View>
  );
}

export function TabFeatures({ entity, rules, onEntityUpdate }: {
  entity: Entity;
  /** Optional — when provided, pending choices become resolvable in this tab. */
  rules?: CampaignRules;
  onEntityUpdate?: (updated: Entity) => void;
}) {
  const { features, spellcasting, derived } = entity;
  const [skillSelections, setSkillSelections] = useState<Record<string, string[]>>({});
  const [asiChoiceOpen, setAsiChoiceOpen] = useState<string | null>(null);
  const [subclassChoiceOpen, setSubclassChoiceOpen] = useState<string | null>(null);
  const [infusionChoiceOpen, setInfusionChoiceOpen] = useState<string | null>(null);
  const [poolChoiceOpen, setPoolChoiceOpen] = useState<string | null>(null);
  const [spellChoiceOpen, setSpellChoiceOpen] = useState<string | null>(null);
  const [removingFeatureId, setRemovingFeatureId] = useState<string | null>(null);

  const pendingChoices = entity.choices.filter(c => !c.resolved);
  const canResolve     = !!rules && !!onEntityUpdate;

  function toggleSkill(choiceId: string, optionId: string, count: number) {
    setSkillSelections(prev => {
      const cur = prev[choiceId] ?? [];
      if (cur.includes(optionId)) return { ...prev, [choiceId]: cur.filter(o => o !== optionId) };
      if (cur.length >= count)    return prev;
      return { ...prev, [choiceId]: [...cur, optionId] };
    });
  }

  function confirmSkillChoice(choiceId: string) {
    if (!rules || !onEntityUpdate) return;
    const sel    = skillSelections[choiceId] ?? [];
    const choice = entity.choices.find(c => c.id === choiceId);
    // resolveChoice() only resolves against a literal pool array — substitute
    // in the resolved 'all' skill list first, same as the creation-time
    // resolver in app/creation/skills.tsx does.
    const target = choice?.definition.pool === 'all'
      ? { ...entity, choices: entity.choices.map(c => c.id === choiceId
          ? { ...c, definition: { ...c.definition, pool: ALL_SKILL_OPTIONS } } : c) }
      : entity;
    try {
      onEntityUpdate(resolveChoice(target, choiceId, sel, rules));
      setSkillSelections(prev => ({ ...prev, [choiceId]: [] }));
    } catch (e) {
      Alert.alert('Could not resolve choice', e instanceof Error ? e.message : String(e));
    }
  }

  // Group features by source kind
  const groups = new Map<string, FeatureInstance[]>();
  for (const f of features) {
    if (!f.isActive) continue;
    const kind = f.source.kind;
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind)!.push(f);
  }

  // Spell cards (prepared + known + cantrips)
  const spellCards = spellcasting
    ? (entity.actionCards ?? []).filter(c => c.tabs.includes('spellcasting'))
    : [];

  const cantrips = spellCards.filter(c => {
    const sp = spellRepo.getSpellSync(c.featureId);
    return sp?.level === 0;
  });
  const leveled = spellCards.filter(c => {
    const sp = spellRepo.getSpellSync(c.featureId);
    return sp && sp.level > 0;
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Pending level-up / creation choices */}
      {pendingChoices.length > 0 && (
        <CollapsibleGroup title={`PENDING CHOICES (${pendingChoices.length})`}>
          {pendingChoices.map(c => {
            const def       = c.definition;
            const isSkill   = def.kind === 'skill' && (Array.isArray(def.pool) || def.pool === 'all');
            const skillPool = def.pool === 'all'
              ? ALL_SKILL_OPTIONS
              : (Array.isArray(def.pool) ? def.pool as { id: string; label: string; value: unknown }[] : []);
            const sel       = skillSelections[c.id] ?? [];
            return (
              <View key={c.id} style={styles.pendingRow}>
                <Text style={styles.pendingPrompt}>{def.prompt}</Text>
                <Text style={styles.pendingMeta}>From level {c.grantedAt} · pick {def.count}</Text>

                {def.kind === 'asi' && (
                  <Pressable
                    style={[styles.resolveBtn, !canResolve && styles.resolveBtnDisabled]}
                    disabled={!canResolve}
                    onPress={() => setAsiChoiceOpen(c.id)}
                  >
                    <Text style={styles.resolveBtnTxt}>Resolve — ASI or Feat →</Text>
                  </Pressable>
                )}

                {def.kind === 'subclass' && (
                  <Pressable
                    style={[styles.resolveBtn, !canResolve && styles.resolveBtnDisabled]}
                    disabled={!canResolve}
                    onPress={() => setSubclassChoiceOpen(c.id)}
                  >
                    <Text style={styles.resolveBtnTxt}>Resolve — Choose Subclass →</Text>
                  </Pressable>
                )}

                {def.kind === 'infusion' && (
                  <Pressable
                    style={[styles.resolveBtn, !canResolve && styles.resolveBtnDisabled]}
                    disabled={!canResolve}
                    onPress={() => setInfusionChoiceOpen(c.id)}
                  >
                    <Text style={styles.resolveBtnTxt}>Resolve — Learn Infusions →</Text>
                  </Pressable>
                )}

                {def.kind === 'feature_pool' && (
                  <Pressable
                    style={[styles.resolveBtn, !canResolve && styles.resolveBtnDisabled]}
                    disabled={!canResolve}
                    onPress={() => setPoolChoiceOpen(c.id)}
                  >
                    <Text style={styles.resolveBtnTxt}>Resolve — Choose →</Text>
                  </Pressable>
                )}

                {def.kind === 'spell' && (
                  <Pressable
                    style={[styles.resolveBtn, !canResolve && styles.resolveBtnDisabled]}
                    disabled={!canResolve}
                    onPress={() => setSpellChoiceOpen(c.id)}
                  >
                    <Text style={styles.resolveBtnTxt}>
                      Resolve — Choose {def.id.includes('cantrip') ? 'Cantrips' : 'Spells'} →
                    </Text>
                  </Pressable>
                )}

                {isSkill && (
                  <>
                    <View style={styles.chipRow}>
                      {skillPool.map(opt => {
                        const selected  = sel.includes(opt.id);
                        const skillName = String(opt.value);
                        const alreadyTrained =
                          entity.skills.skills[skillName as keyof typeof entity.skills.skills]?.trained === true;
                        return (
                          <Pressable
                            key={opt.id}
                            style={[styles.chip, selected && styles.chipSelected, alreadyTrained && styles.chipDisabled]}
                            disabled={alreadyTrained || !canResolve}
                            onPress={() => toggleSkill(c.id, opt.id, def.count)}
                          >
                            <Text style={[styles.chipTxt, selected && styles.chipTxtSelected]}>
                              {opt.label}{alreadyTrained ? ' ✓' : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable
                      style={[styles.resolveBtn, (sel.length !== def.count || !canResolve) && styles.resolveBtnDisabled]}
                      disabled={sel.length !== def.count || !canResolve}
                      onPress={() => confirmSkillChoice(c.id)}
                    >
                      <Text style={styles.resolveBtnTxt}>Confirm ({sel.length}/{def.count})</Text>
                    </Pressable>
                  </>
                )}

                {def.kind !== 'asi' && def.kind !== 'subclass' && def.kind !== 'infusion' && def.kind !== 'feature_pool' && def.kind !== 'spell' && !isSkill && (
                  <Text style={styles.pendingNote}>
                    Resolve this with your DM for now — an in-app picker for this choice type is coming.
                  </Text>
                )}
              </View>
            );
          })}
        </CollapsibleGroup>
      )}

      {/* Feature groups */}
      {SOURCE_ORDER.filter(k => groups.has(k)).map(kind => (
        <CollapsibleGroup key={kind} title={SOURCE_LABELS[kind] ?? kind}>
          {groups.get(kind)!.map(f => (
            <FeatureRow
              key={f.id}
              feature={f}
              onRemove={canResolve ? setRemovingFeatureId : undefined}
            />
          ))}
        </CollapsibleGroup>
      ))}

      {/* Spellcasting section */}
      {spellcasting && (
        <CollapsibleGroup title="SPELLS">
          <View style={styles.spellMeta2}>
            <View style={styles.spellMetaPill}>
              <Text style={styles.spellMetaLabel}>Spell DC</Text>
              <Text style={styles.spellMetaValue}>{derived.spellSaveDC ?? '—'}</Text>
            </View>
            <View style={styles.spellMetaPill}>
              <Text style={styles.spellMetaLabel}>Attack</Text>
              <Text style={styles.spellMetaValue}>
                {derived.spellAttackBonus != null
                  ? (derived.spellAttackBonus >= 0 ? `+${derived.spellAttackBonus}` : String(derived.spellAttackBonus))
                  : '—'}
              </Text>
            </View>
            <View style={styles.spellMetaPill}>
              <Text style={styles.spellMetaLabel}>Ability</Text>
              <Text style={styles.spellMetaValue}>{spellcasting.ability.toUpperCase()}</Text>
            </View>
          </View>

          {/* Spell slots — all tiers that have slots, not just level 1 */}
          {(['1','2','3','4','5','6','7','8','9'] as const).some(t => spellcasting.slots[t]?.total > 0) && (
            <View style={styles.slotGrid}>
              {(['1','2','3','4','5','6','7','8','9'] as const).map(tier => {
                const slot = spellcasting.slots[tier];
                if (!slot || slot.total === 0) return null;
                return (
                  <View key={tier} style={styles.slotBlock}>
                    <Text style={styles.slotTier}>Lv {tier}</Text>
                    <View style={styles.slotPips}>
                      {Array.from({ length: slot.total }).map((_, i) => (
                        <View key={i} style={[styles.slotPip, i < slot.used && styles.slotPipUsed]} />
                      ))}
                    </View>
                    <Text style={styles.slotCount}>{slot.total - slot.used}/{slot.total}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {cantrips.length > 0 && (
            <View style={styles.spellSubGroup}>
              <Text style={styles.spellSubTitle}>CANTRIPS</Text>
              {cantrips.map(c => <SpellCardRow key={c.featureId} card={c} />)}
            </View>
          )}
          {leveled.length > 0 && (
            <View style={styles.spellSubGroup}>
              <Text style={styles.spellSubTitle}>SPELLS</Text>
              {leveled.map(c => <SpellCardRow key={c.featureId} card={c} />)}
            </View>
          )}
          {spellCards.length === 0 && (
            <Text style={styles.emptyNote}>No spells prepared.</Text>
          )}
        </CollapsibleGroup>
      )}

      {features.filter(f => f.isActive).length === 0 && !spellcasting && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTxt}>No features yet.</Text>
        </View>
      )}

      {/* ASI / Feat resolution modal */}
      <Modal visible={asiChoiceOpen !== null} animationType="slide" onRequestClose={() => setAsiChoiceOpen(null)}>
        <View style={styles.asiModalRoot}>
          {(() => {
            const ch = entity.choices.find(c => c.id === asiChoiceOpen && !c.resolved);
            if (!ch || !rules || !onEntityUpdate) {
              return (
                <View style={styles.asiDone}>
                  <Text style={styles.asiDoneTxt}>Nothing to resolve.</Text>
                  <Pressable style={styles.resolveBtn} onPress={() => setAsiChoiceOpen(null)}>
                    <Text style={styles.resolveBtnTxt}>Close</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <AsiFeatPicker
                entity={entity}
                choice={ch}
                rules={rules}
                onClose={() => setAsiChoiceOpen(null)}
                onResolved={(updated) => { onEntityUpdate(updated); setAsiChoiceOpen(null); }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Subclass resolution modal */}
      <Modal visible={subclassChoiceOpen !== null} animationType="slide" onRequestClose={() => setSubclassChoiceOpen(null)}>
        <View style={styles.asiModalRoot}>
          {(() => {
            const ch = entity.choices.find(c => c.id === subclassChoiceOpen && !c.resolved);
            if (!ch || !rules || !onEntityUpdate) {
              return (
                <View style={styles.asiDone}>
                  <Text style={styles.asiDoneTxt}>Nothing to resolve.</Text>
                  <Pressable style={styles.resolveBtn} onPress={() => setSubclassChoiceOpen(null)}>
                    <Text style={styles.resolveBtnTxt}>Close</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <SubclassPicker
                entity={entity}
                choice={ch}
                rules={rules}
                onClose={() => setSubclassChoiceOpen(null)}
                onResolved={(updated) => { onEntityUpdate(updated); setSubclassChoiceOpen(null); }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Infusion resolution modal */}
      <Modal visible={infusionChoiceOpen !== null} animationType="slide" onRequestClose={() => setInfusionChoiceOpen(null)}>
        <View style={styles.asiModalRoot}>
          {(() => {
            const ch = entity.choices.find(c => c.id === infusionChoiceOpen && !c.resolved);
            if (!ch || !rules || !onEntityUpdate) {
              return (
                <View style={styles.asiDone}>
                  <Text style={styles.asiDoneTxt}>Nothing to resolve.</Text>
                  <Pressable style={styles.resolveBtn} onPress={() => setInfusionChoiceOpen(null)}>
                    <Text style={styles.resolveBtnTxt}>Close</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <InfusionPicker
                entity={entity}
                choice={ch}
                rules={rules}
                onClose={() => setInfusionChoiceOpen(null)}
                onResolved={(updated) => { onEntityUpdate(updated); setInfusionChoiceOpen(null); }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Feature-pool resolution modal (Battle Master maneuvers, Ranger Hunter sub-choices) */}
      <Modal visible={poolChoiceOpen !== null} animationType="slide" onRequestClose={() => setPoolChoiceOpen(null)}>
        <View style={styles.asiModalRoot}>
          {(() => {
            const ch = entity.choices.find(c => c.id === poolChoiceOpen && !c.resolved);
            if (!ch || !rules || !onEntityUpdate) {
              return (
                <View style={styles.asiDone}>
                  <Text style={styles.asiDoneTxt}>Nothing to resolve.</Text>
                  <Pressable style={styles.resolveBtn} onPress={() => setPoolChoiceOpen(null)}>
                    <Text style={styles.resolveBtnTxt}>Close</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <FeaturePoolPicker
                entity={entity}
                choice={ch}
                rules={rules}
                onClose={() => setPoolChoiceOpen(null)}
                onResolved={(updated) => { onEntityUpdate(updated); setPoolChoiceOpen(null); }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Spell-choice resolution modal (known-spell casters gaining spells/cantrips on level-up) */}
      <Modal visible={spellChoiceOpen !== null} animationType="slide" onRequestClose={() => setSpellChoiceOpen(null)}>
        <View style={styles.asiModalRoot}>
          {(() => {
            const ch = entity.choices.find(c => c.id === spellChoiceOpen && !c.resolved);
            if (!ch || !rules || !onEntityUpdate) {
              return (
                <View style={styles.asiDone}>
                  <Text style={styles.asiDoneTxt}>Nothing to resolve.</Text>
                  <Pressable style={styles.resolveBtn} onPress={() => setSpellChoiceOpen(null)}>
                    <Text style={styles.resolveBtnTxt}>Close</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <SpellChoicePicker
                entity={entity}
                choice={ch}
                rules={rules}
                onClose={() => setSpellChoiceOpen(null)}
                onResolved={(updated) => { onEntityUpdate(updated); setSpellChoiceOpen(null); }}
              />
            );
          })()}
        </View>
      </Modal>

      <RemoveFeatureModal
        visible={removingFeatureId !== null}
        entity={entity}
        rules={rules ?? DEFAULT_RULES}
        featureId={removingFeatureId}
        onConfirm={(updated) => { onEntityUpdate?.(updated); setRemovingFeatureId(null); }}
        onCancel={() => setRemovingFeatureId(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  group: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, backgroundColor: Colors.surfaceHigh,
  },
  groupTitle:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 1 },
  groupBody:     { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  featureChevron:{ fontSize: FontSize.xs, color: Colors.textDim },
  featureRemoveBtn: { fontSize: FontSize.md, color: Colors.red, paddingHorizontal: Spacing.sm },

  featureRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  featureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featureName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  featureDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },

  spellMeta2: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  spellMetaPill: {
    flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  spellMetaLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  spellMetaValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.blue },

  slotGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
  slotBlock: { alignItems: 'center', gap: 4, minWidth: 48 },
  slotTier:  { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1 },
  slotPips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
  slotPip:   { width: 10, height: 10, borderRadius: Radius.full, backgroundColor: Colors.blue },
  slotPipUsed: { backgroundColor: Colors.border },
  slotCount: { fontSize: FontSize.xs, color: Colors.textDim },

  spellSubGroup: { gap: Spacing.xs, marginBottom: Spacing.sm },
  spellSubTitle: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2, marginBottom: 4 },

  spellCard: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3,
    padding: Spacing.sm, marginBottom: 4,
  },
  spellHeader:  { flexDirection: 'row', alignItems: 'flex-start' },
  spellInfo:    { flex: 1, gap: 2 },
  spellName:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  spellL1:      { fontSize: FontSize.xs, color: Colors.textDim },
  spellL2:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  spellL3:      { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  spellExpanded:{ marginTop: Spacing.sm, gap: Spacing.xs },
  spellDesc:    { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  spellUpcast:  { fontSize: FontSize.sm, color: Colors.blue, lineHeight: 18 },
  spellMeta:    { fontSize: FontSize.xs, color: Colors.textDim },
  spellComponents:{ fontSize: FontSize.xs, color: Colors.textDim },

  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic', padding: Spacing.sm },
  empty:     { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyIcon: { fontSize: 48 },
  emptyTxt:  { fontSize: FontSize.lg, color: Colors.textSecondary },

  // Pending choices
  pendingRow:    { paddingVertical: Spacing.sm, gap: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pendingPrompt: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  pendingMeta:   { fontSize: FontSize.xs, color: Colors.textDim },
  pendingNote:   { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipSelected:    { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipDisabled:    { opacity: 0.4 },
  chipTxt:         { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTxtSelected: { color: Colors.gold, fontWeight: FontWeight.bold },
  resolveBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm, alignItems: 'center', marginTop: 2,
  },
  resolveBtnDisabled: { opacity: 0.4 },
  resolveBtnTxt:      { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  asiModalRoot: { flex: 1, backgroundColor: Colors.bg, paddingTop: Spacing.xl + 8 },
  asiDone:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.lg },
  asiDoneTxt:   { fontSize: FontSize.lg, color: Colors.textPrimary },
});
