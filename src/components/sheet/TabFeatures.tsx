// app/sheet/TabFeatures.tsx
// Tab 4 — Features grouped by source, plus spells if applicable.
import { useState, memo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Entity, FeatureInstance, ActionCard, CampaignRules } from '../../engine/types';
import { resolveChoice, applyExpertiseChoiceToEntity, applyToolChoiceToEntity, applyLanguageChoiceToEntity } from '../../engine/leveling';
import { recomputeDerived } from '../../engine/pipeline';
import { eligibleExpertiseOptions, eligibleToolOptions, eligibleLanguageOptions } from '../../engine/choiceEligibility';
import { Alert } from '../../utils/alert';
import { AsiFeatPicker } from '../AsiFeatPicker';
import { SubclassPicker } from '../SubclassPicker';
import { InfusionPicker } from '../InfusionPicker';
import { FeaturePoolPicker } from '../FeaturePoolPicker';
import { SpellChoicePicker } from '../SpellChoicePicker';
import { RepeatedChoicePicker, RepeatedChoiceOption } from '../RepeatedChoicePicker';
import { RemoveFeatureModal } from './RemoveFeatureModal';
import { AddCustomFeatureModal } from './AddCustomFeatureModal';
import { ChangeBackgroundModal } from './ChangeBackgroundModal';
import { spellRepo } from '../../content/spellRepo';
import { spellProgressFor, groupPendingSpellChoices } from '../../content/creationProgress';
import { DEFAULT_RULES } from '../../store/characterStore';
import { TOOL_CATEGORY_LABELS, TOOL_CATEGORY_ORDER } from '../../content/tools';
import { LANGUAGE_CATEGORY_LABELS, LANGUAGE_CATEGORY_ORDER } from '../../content/languages';
import { ALL_SKILL_OPTIONS } from '../../content/skills';
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

// ALL_SKILL_OPTIONS now comes from ../../content/skills — some subclass
// features (e.g. Bard College of Lore's Additional Proficiencies) grant
// "choose N of ANY skill" and mark it with the pool:'all' sentinel rather
// than a literal option array (same convention as spellChoice() in
// classes/index.ts).

// Copied from TabExploration.tsx's own "+Feat" flow (Phase 2 of the live
// feature/background editing track) — a throwaway ChoiceState fabricated
// fresh each time, never inserted into entity.choices, so it can't pollute
// state (applyFeatToEntity's scan over updated.choices simply finds no
// match). AsiFeatPicker already has its own internal FeatPreviewModal
// preview step, so no new preview code is needed here.
function makeAdHocFeatChoice(): import('../../engine/types').ChoiceState {
  const id = `adhoc_feat_${Date.now().toString(36)}`;
  return {
    id, grantedAt: 0, resolved: false, selections: [],
    definition: { id, prompt: 'Take a feat', kind: 'asi', count: 1, pool: 'all', grants: [], required: false, resolved: false },
  };
}

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

function TabFeaturesInner({ entity, rules, onEntityUpdate }: {
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
  const [expertiseChoiceOpen, setExpertiseChoiceOpen] = useState<string | null>(null);
  const [toolChoiceOpen, setToolChoiceOpen] = useState<string | null>(null);
  const [languageChoiceOpen, setLanguageChoiceOpen] = useState<string | null>(null);
  const [repeatedChoiceError, setRepeatedChoiceError] = useState<string | null>(null);
  const [removingFeatureId, setRemovingFeatureId] = useState<string | null>(null);
  const [addFeatOpen, setAddFeatOpen] = useState(false);
  const [addCustomFeatureOpen, setAddCustomFeatureOpen] = useState(false);
  const [changeBackgroundOpen, setChangeBackgroundOpen] = useState(false);

  const pendingChoices = entity.choices.filter(c => !c.resolved);
  const canResolve     = !!rules && !!onEntityUpdate;
  // REPEATED-CHOICE-1: total ASI/Feat entitlements still outstanding — shown
  // on the resolve button so a directly-created high-level character (e.g.
  // 3 queued ASI-or-feat choices from levels 4/8/12) sees the real count up
  // front, and the resolve flow (below) chains through all of them without
  // bouncing back to this list in between.
  const asiPendingCount = pendingChoices.filter(c => c.definition.kind === 'asi').length;

  // SPELL-ACCUMULATION-2: a known-spell caster (Wizard/Sorcerer/Bard/Warlock/
  // Ranger/...) queues one small kind:'spell' ChoiceDefinition PER LEVEL that
  // grants a new cantrip/known spell (see src/content/classes/index.ts). A
  // directly-created or fast-leveled character can have several of these
  // unresolved at once, and rendering one PENDING CHOICES row per underlying
  // ChoiceState — same bug app/creation/spells.tsx's SPELL-ACCUMULATION-1
  // already fixed for the creation flow — produced a stack of separate
  // "Choose Spells" rows here on the sheet instead of one cumulative prompt.
  // Fixed the same way: group by cantrip vs known-spell (same id.includes
  // ('cantrip') convention spells.tsx/creationProgress.ts already use), show
  // ONE row per non-empty group with the combined pick-count, and chain the
  // resolution modal through every remaining choice in that group — same
  // "stay open, resolve one at a time" pattern the ASI modal below already
  // uses for REPEATED-CHOICE-1.
  const { cantripPending, knownSpellPending } = groupPendingSpellChoices(pendingChoices);
  const cantripPrimaryId    = cantripPending[0]?.id;
  const knownSpellPrimaryId = knownSpellPending[0]?.id;
  const cantripPendingTotal    = cantripPending.reduce((sum, c) => sum + c.definition.count, 0);
  const knownSpellPendingTotal = knownSpellPending.reduce((sum, c) => sum + c.definition.count, 0);

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

  // Situational effects (item 9 — context-dependent/three-state mechanics):
  // every distinct real-world fact a currently-held effect (feature or
  // equipped-item) asks about, deduped by situational.id so a fact shared
  // by several entries (e.g. every copy of the same racial trait) only
  // needs answering once. See Effect.situational's own doc comment and
  // pipeline.ts's collectAllEffects gating.
  const situationalById = new Map<string, { question: string; sourceName: string }>();
  for (const f of features) {
    if (!f.isActive) continue;
    for (const effect of f.effects) {
      if (effect.situational && !situationalById.has(effect.situational.id)) {
        situationalById.set(effect.situational.id, { question: effect.situational.question, sourceName: f.name });
      }
    }
  }
  for (const item of entity.inventory.equipped) {
    for (const f of item.features) {
      for (const effect of f.effects) {
        if (effect.situational && !situationalById.has(effect.situational.id)) {
          situationalById.set(effect.situational.id, { question: effect.situational.question, sourceName: f.name });
        }
      }
    }
  }
  const situationalItems = Array.from(situationalById.entries()).map(([id, v]) => ({ id, ...v }));

  function answerSituational(id: string, value: boolean | undefined) {
    if (!rules || !onEntityUpdate) return;
    const next = { ...(entity.situationalAnswers ?? {}) };
    if (value === undefined) delete next[id]; else next[id] = value;
    onEntityUpdate(recomputeDerived({ ...entity, situationalAnswers: next }, rules));
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

      {/* Header-level identity action — changes the whole background, not
          one feature, so it's kept visually separate from the feature-list
          actions below (Phase 4 of live editing). */}
      {canResolve && (
        <Pressable style={styles.changeBgBtn} onPress={() => setChangeBackgroundOpen(true)}>
          <Text style={styles.changeBgBtnTxt}>⇄ Change Background</Text>
        </Pressable>
      )}

      {/* Add an existing feat, or author a one-off feature, live mid-session
          (Phases 2/3 of live editing) */}
      {canResolve && (
        <View style={styles.addFeatRow}>
          <Pressable style={[styles.addFeatBtn, styles.addFeatBtnHalf]} onPress={() => setAddFeatOpen(true)}>
            <Text style={styles.addFeatBtnTxt}>+ Add Feat</Text>
          </Pressable>
          <Pressable style={[styles.addFeatBtn, styles.addFeatBtnHalf]} onPress={() => setAddCustomFeatureOpen(true)}>
            <Text style={styles.addFeatBtnTxt}>+ Custom Feature</Text>
          </Pressable>
        </View>
      )}

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

            // SPELL-ACCUMULATION-2: only the first unresolved choice in each
            // group (cantrip / known-spell) renders a row — the rest are
            // folded into that row's aggregated count and resolved via the
            // same modal's chaining, never shown individually.
            if (def.kind === 'spell' && c.id !== cantripPrimaryId && c.id !== knownSpellPrimaryId) {
              return null;
            }
            const isCantripGroup = def.kind === 'spell' && c.id === cantripPrimaryId;
            const spellGroupTotal = isCantripGroup ? cantripPendingTotal : knownSpellPendingTotal;
            // spellProgressFor is the same authoritative done/total calculation
            // app/creation/spells.tsx's "Selected X/Y" header uses — reused here
            // so the sheet and creation flow report identical entitlement math,
            // not a second display-only calculation (item 23's own rule).
            const spellProgress = def.kind === 'spell' ? spellProgressFor(entity) : null;
            const spellGroupProgress = isCantripGroup ? spellProgress?.cantrips : spellProgress?.spells;
            const spellGroupPrompt = def.kind === 'spell' && spellGroupProgress
              ? `Selected ${spellGroupProgress.done} / ${spellGroupProgress.total} ${isCantripGroup ? 'cantrips' : 'known spells'}.`
              : def.prompt;

            return (
              <View key={c.id} style={styles.pendingRow}>
                <Text style={styles.pendingPrompt}>{spellGroupPrompt}</Text>
                {def.kind === 'spell' ? (
                  <Text style={styles.pendingMeta}>
                    {(isCantripGroup ? cantripPending : knownSpellPending).length > 1
                      ? `Across levels ${(isCantripGroup ? cantripPending : knownSpellPending).map(x => x.grantedAt).join(', ')}`
                      : `From level ${c.grantedAt}`} · pick {spellGroupTotal} total
                  </Text>
                ) : (
                  <Text style={styles.pendingMeta}>From level {c.grantedAt} · pick {def.count}</Text>
                )}

                {def.kind === 'asi' && (
                  <Pressable
                    style={[styles.resolveBtn, !canResolve && styles.resolveBtnDisabled]}
                    disabled={!canResolve}
                    onPress={() => setAsiChoiceOpen(c.id)}
                  >
                    <Text style={styles.resolveBtnTxt}>
                      Resolve — ASI or Feat{asiPendingCount > 1 ? ` (${asiPendingCount} pending)` : ''} →
                    </Text>
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

                {def.kind === 'expertise' && (
                  <Pressable
                    style={[styles.resolveBtn, !canResolve && styles.resolveBtnDisabled]}
                    disabled={!canResolve}
                    onPress={() => { setRepeatedChoiceError(null); setExpertiseChoiceOpen(c.id); }}
                  >
                    <Text style={styles.resolveBtnTxt}>Resolve — Choose Expertise →</Text>
                  </Pressable>
                )}

                {def.kind === 'tool' && (
                  <Pressable
                    style={[styles.resolveBtn, !canResolve && styles.resolveBtnDisabled]}
                    disabled={!canResolve}
                    onPress={() => { setRepeatedChoiceError(null); setToolChoiceOpen(c.id); }}
                  >
                    <Text style={styles.resolveBtnTxt}>Resolve — Choose Tool Proficiency →</Text>
                  </Pressable>
                )}

                {def.kind === 'language' && (
                  <Pressable
                    style={[styles.resolveBtn, !canResolve && styles.resolveBtnDisabled]}
                    disabled={!canResolve}
                    onPress={() => { setRepeatedChoiceError(null); setLanguageChoiceOpen(c.id); }}
                  >
                    <Text style={styles.resolveBtnTxt}>Resolve — Choose Language →</Text>
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

                {def.kind !== 'asi' && def.kind !== 'subclass' && def.kind !== 'infusion' && def.kind !== 'feature_pool'
                  && def.kind !== 'spell' && def.kind !== 'expertise' && def.kind !== 'tool' && def.kind !== 'language' && !isSkill && (
                  // CHOICE-EXPANSION-1 item 17/16: a genuinely unsupported kind
                  // (e.g. 'custom', which carries no structured meaning
                  // anywhere in this schema today — see leveling.ts's
                  // canAutoResolve/resolveChoice) stays visible here rather
                  // than disappearing; validateEntity also surfaces it as an
                  // 'unresolved_choice_kind' Issue (header badge), so it isn't
                  // ONLY this one line of text.
                  <Text style={styles.pendingNote}>
                    This choice type ("{def.kind}") has no in-app picker yet — resolve it with your DM for now. Nothing has been silently skipped.
                  </Text>
                )}
              </View>
            );
          })}
        </CollapsibleGroup>
      )}

      {/* Situational effects (item 9) — a fact the app can't observe
          (positioning, "an ally within 5 feet", etc.), so it's surfaced as
          an explicit question rather than silently assumed true or false.
          Unanswered defaults to "doesn't apply" — see answerSituational. */}
      {situationalItems.length > 0 && (
        <CollapsibleGroup title={`SITUATIONAL (${situationalItems.length})`}>
          {situationalItems.map(s => {
            const current = entity.situationalAnswers?.[s.id]; // undefined | true | false
            return (
              <View key={s.id} style={styles.situationalRow}>
                <Text style={styles.situationalSource}>{s.sourceName}</Text>
                <Text style={styles.situationalQuestion}>{s.question}</Text>
                <View style={styles.situationalBtns}>
                  <Pressable
                    style={[styles.situationalBtn, current === true && styles.situationalBtnYesActive]}
                    disabled={!canResolve}
                    onPress={() => answerSituational(s.id, current === true ? undefined : true)}
                  >
                    <Text style={[styles.situationalBtnTxt, current === true && styles.situationalBtnTxtActive]}>Yes</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.situationalBtn, current === false && styles.situationalBtnNoActive]}
                    disabled={!canResolve}
                    onPress={() => answerSituational(s.id, current === false ? undefined : false)}
                  >
                    <Text style={[styles.situationalBtnTxt, current === false && styles.situationalBtnTxtActive]}>No</Text>
                  </Pressable>
                  {current === undefined && <Text style={styles.situationalUnset}>Unset — treated as No</Text>}
                </View>
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

      {/* ASI / Feat resolution modal — REPEATED-CHOICE-1: chains through every
          remaining pending 'asi' choice instead of closing after one, so a
          character with N outstanding ASI/feat entitlements (e.g. direct
          high-level creation) resolves all of them in one continuous flow. */}
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
            const remainingAfterThis = pendingChoices.filter(c => c.definition.kind === 'asi' && c.id !== ch.id).length;
            return (
              <AsiFeatPicker
                entity={entity}
                choice={ch}
                rules={rules}
                onClose={() => setAsiChoiceOpen(null)}
                onResolved={(updated) => {
                  onEntityUpdate(updated);
                  const next = updated.choices.find(c => !c.resolved && c.definition.kind === 'asi');
                  setAsiChoiceOpen(next ? next.id : null);
                }}
                progressNote={remainingAfterThis > 0 ? `${remainingAfterThis} more ASI/feat choice${remainingAfterThis === 1 ? '' : 's'} after this one` : undefined}
                browseStateKey="feat:levelup"
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
            // SPELL-ACCUMULATION-2: chains through every remaining unresolved
            // choice in the SAME group (cantrip vs known-spell) as the one
            // just resolved — same "stay open, resolve one at a time" shape
            // as the ASI modal's REPEATED-CHOICE-1 chaining above, scoped to
            // one group so a cantrip pick never auto-opens a known-spell pick.
            const wasCantripChoice = ch.definition.id.includes('cantrip');
            const remainingInGroup = (wasCantripChoice ? cantripPending : knownSpellPending)
              .filter(c => c.id !== ch.id).length;
            return (
              <SpellChoicePicker
                entity={entity}
                choice={ch}
                rules={rules}
                onClose={() => setSpellChoiceOpen(null)}
                onResolved={(updated) => {
                  onEntityUpdate(updated);
                  const next = updated.choices.find(c =>
                    !c.resolved && c.definition.kind === 'spell' && c.definition.id.includes('cantrip') === wasCantripChoice,
                  );
                  setSpellChoiceOpen(next ? next.id : null);
                }}
                progressNote={remainingInGroup > 0 ? `${remainingInGroup} more ${wasCantripChoice ? 'cantrip' : 'spell'} choice${remainingInGroup === 1 ? '' : 's'} after this one` : undefined}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Expertise resolution modal — item 3: eligible pool is skills the
          character is CURRENTLY trained in and not already expert in,
          computed live here (not inferred from display strings), further
          intersected with the choice's own literal pool if it has one
          (a restricted "choose 2 of these 3" Expertise grant). */}
      <Modal visible={expertiseChoiceOpen !== null} animationType="slide" onRequestClose={() => setExpertiseChoiceOpen(null)}>
        <View style={styles.asiModalRoot}>
          {(() => {
            const ch = entity.choices.find(c => c.id === expertiseChoiceOpen && !c.resolved);
            if (!ch || !rules || !onEntityUpdate) {
              return (
                <View style={styles.asiDone}>
                  <Text style={styles.asiDoneTxt}>Nothing to resolve.</Text>
                  <Pressable style={styles.resolveBtn} onPress={() => setExpertiseChoiceOpen(null)}>
                    <Text style={styles.resolveBtnTxt}>Close</Text>
                  </Pressable>
                </View>
              );
            }
            const options: RepeatedChoiceOption[] = eligibleExpertiseOptions(entity, ch.definition.pool);
            return (
              <RepeatedChoicePicker
                heading="Choose Expertise"
                prompt={ch.definition.prompt}
                requiredCount={ch.definition.count}
                options={options}
                searchable={false}
                emptyMessage="No eligible skills right now — Expertise requires existing proficiency. Resolve any pending skill-proficiency choices first."
                commitLabel={n => `Grant Expertise in ${n} Skill${n !== 1 ? 's' : ''} →`}
                error={repeatedChoiceError}
                onClose={() => setExpertiseChoiceOpen(null)}
                onCommit={(sel) => {
                  try {
                    onEntityUpdate(applyExpertiseChoiceToEntity(entity, ch.id, sel, rules));
                    setExpertiseChoiceOpen(null);
                  } catch (e) {
                    setRepeatedChoiceError(e instanceof Error ? e.message : String(e));
                  }
                }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Tool-proficiency resolution modal — grouped by ToolCategory, searchable
          (item 8: large registry). A restricted literal pool narrows the
          registry to just those options (item 12: filters only narrow the
          legal pool, never broaden it). */}
      <Modal visible={toolChoiceOpen !== null} animationType="slide" onRequestClose={() => setToolChoiceOpen(null)}>
        <View style={styles.asiModalRoot}>
          {(() => {
            const ch = entity.choices.find(c => c.id === toolChoiceOpen && !c.resolved);
            if (!ch || !rules || !onEntityUpdate) {
              return (
                <View style={styles.asiDone}>
                  <Text style={styles.asiDoneTxt}>Nothing to resolve.</Text>
                  <Pressable style={styles.resolveBtn} onPress={() => setToolChoiceOpen(null)}>
                    <Text style={styles.resolveBtnTxt}>Close</Text>
                  </Pressable>
                </View>
              );
            }
            const options: RepeatedChoiceOption[] = eligibleToolOptions(entity, ch.definition.pool);
            return (
              <RepeatedChoicePicker
                heading="Choose Tool Proficiency"
                prompt={ch.definition.prompt}
                requiredCount={ch.definition.count}
                options={options}
                groupLabels={TOOL_CATEGORY_LABELS}
                groupOrder={TOOL_CATEGORY_ORDER}
                emptyMessage="No eligible tools right now — you may already be proficient with everything in this choice's pool."
                commitLabel={n => `Grant Proficiency in ${n} Tool${n !== 1 ? 's' : ''} →`}
                error={repeatedChoiceError}
                onClose={() => setToolChoiceOpen(null)}
                onCommit={(sel) => {
                  try {
                    onEntityUpdate(applyToolChoiceToEntity(entity, ch.id, sel, rules));
                    setToolChoiceOpen(null);
                  } catch (e) {
                    setRepeatedChoiceError(e instanceof Error ? e.message : String(e));
                  }
                }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Language resolution modal — grouped by LanguageCategory. Secret
          languages (Thieves' Cant, Druidic) are excluded from the default
          'all'-sentinel pool (item 13) but remain selectable when a choice's
          own literal pool explicitly includes them. */}
      <Modal visible={languageChoiceOpen !== null} animationType="slide" onRequestClose={() => setLanguageChoiceOpen(null)}>
        <View style={styles.asiModalRoot}>
          {(() => {
            const ch = entity.choices.find(c => c.id === languageChoiceOpen && !c.resolved);
            if (!ch || !rules || !onEntityUpdate) {
              return (
                <View style={styles.asiDone}>
                  <Text style={styles.asiDoneTxt}>Nothing to resolve.</Text>
                  <Pressable style={styles.resolveBtn} onPress={() => setLanguageChoiceOpen(null)}>
                    <Text style={styles.resolveBtnTxt}>Close</Text>
                  </Pressable>
                </View>
              );
            }
            const options: RepeatedChoiceOption[] = eligibleLanguageOptions(entity, ch.definition.pool);
            return (
              <RepeatedChoicePicker
                heading="Choose Languages"
                prompt={ch.definition.prompt}
                requiredCount={ch.definition.count}
                options={options}
                groupLabels={LANGUAGE_CATEGORY_LABELS}
                groupOrder={LANGUAGE_CATEGORY_ORDER}
                emptyMessage="No eligible languages right now — you may already know everything in this choice's pool."
                commitLabel={n => `Learn ${n} Language${n !== 1 ? 's' : ''} →`}
                error={repeatedChoiceError}
                onClose={() => setLanguageChoiceOpen(null)}
                onCommit={(sel) => {
                  try {
                    onEntityUpdate(applyLanguageChoiceToEntity(entity, ch.id, sel, rules));
                    setLanguageChoiceOpen(null);
                  } catch (e) {
                    setRepeatedChoiceError(e instanceof Error ? e.message : String(e));
                  }
                }}
              />
            );
          })()}
        </View>
      </Modal>

      {/* Add an existing feat live (Phase 2) */}
      <Modal visible={addFeatOpen} animationType="slide" onRequestClose={() => setAddFeatOpen(false)}>
        <View style={styles.asiModalRoot}>
          {rules && onEntityUpdate ? (
            <AsiFeatPicker entity={entity} choice={makeAdHocFeatChoice()} rules={rules} featOnly
              onClose={() => setAddFeatOpen(false)}
              onResolved={(updated) => { onEntityUpdate(updated); setAddFeatOpen(false); }}
              browseStateKey="feat:live" />
          ) : (
            <View style={styles.asiDone}>
              <Text style={styles.asiDoneTxt}>Nothing to resolve.</Text>
              <Pressable style={styles.resolveBtn} onPress={() => setAddFeatOpen(false)}>
                <Text style={styles.resolveBtnTxt}>Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* EDIT-PERF-1: gated like every other sheet-level modal
          (FREEEDIT-PERF-1's precedent in app/sheet/[id].tsx) — these three
          used to be unconditionally mounted, so their component bodies
          (state, effects, any data derivation) ran on every render of this
          tab regardless of whether they were open. */}
      {removingFeatureId !== null && (
        <RemoveFeatureModal
          visible
          entity={entity}
          rules={rules ?? DEFAULT_RULES}
          featureId={removingFeatureId}
          onConfirm={(updated) => { onEntityUpdate?.(updated); setRemovingFeatureId(null); }}
          onCancel={() => setRemovingFeatureId(null)}
        />
      )}

      {addCustomFeatureOpen && (
        <AddCustomFeatureModal
          visible
          entity={entity}
          rules={rules ?? DEFAULT_RULES}
          onConfirm={(updated) => { onEntityUpdate?.(updated); setAddCustomFeatureOpen(false); }}
          onCancel={() => setAddCustomFeatureOpen(false)}
        />
      )}

      {changeBackgroundOpen && (
        <ChangeBackgroundModal
          visible
          entity={entity}
          rules={rules ?? DEFAULT_RULES}
          onConfirm={(updated) => { onEntityUpdate?.(updated); setChangeBackgroundOpen(false); }}
          onCancel={() => setChangeBackgroundOpen(false)}
        />
      )}
    </ScrollView>
  );
}

// EDIT-PERF-1: see TabCharacter.tsx's identical comment.
export const TabFeatures = memo(TabFeaturesInner);

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

  changeBgBtn: {
    backgroundColor: Colors.blue + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.blue + '66',
    padding: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm,
  },
  changeBgBtnTxt: { color: Colors.blue, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  addFeatRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  addFeatBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66', borderStyle: 'dashed',
    padding: Spacing.sm, alignItems: 'center',
  },
  addFeatBtnHalf: { flex: 1 },
  addFeatBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

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
  situationalRow:      { paddingVertical: Spacing.sm, gap: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  situationalSource:   { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  situationalQuestion: { fontSize: FontSize.sm, color: Colors.textPrimary },
  situationalBtns:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  situationalBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  situationalBtnYesActive: { borderColor: Colors.green, backgroundColor: Colors.green + '22' },
  situationalBtnNoActive:  { borderColor: Colors.red, backgroundColor: Colors.red + '22' },
  situationalBtnTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  situationalBtnTxtActive: { color: Colors.textPrimary },
  situationalUnset:        { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  asiModalRoot: { flex: 1, backgroundColor: Colors.bg, paddingTop: Spacing.xl + 8 },
  asiDone:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.lg },
  asiDoneTxt:   { fontSize: FontSize.lg, color: Colors.textPrimary },
});
