import { useSpellPayment } from './SpellPaymentChooser';
import { SpellPaymentOption } from '../../engine/spellPayment';
import { grantEntitlement } from '../../engine/entitlements';
// ============================================================================
// FILE: src/components/sheet/TabSpells.tsx
// Spellbook tab — spell reference + Cast for every spell a character knows.
//
// Only rendered when entity.spellcasting is non-null (parent gates this).
// Cast flow uses the same ActionCard / UseModal pipeline as TabActions, so
// slot consumption, unavailability checks, and the dice result modal are all
// shared — no parallel cast implementation.
//
// Prepared casters (Wizard, Cleric, Druid, Paladin): shows a "Prepared" badge
// and a toggle to add/remove spells from entity.spellcasting.prepared.
// Spontaneous casters: all known spells are castable; no prepared toggle.
// ============================================================================
import { useState, useCallback, useMemo, useRef, memo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, CampaignRules, ActionCard, Spell, ActivationOption, SpellCastingContext } from '../../engine/types';
import { spellRepo } from '../../content/spellRepo';
import { resolveSpellById } from '../../content/contentResolution';
import { useHomebrewStore } from '../../store/homebrewStore';
import { getClassLevels } from '../../engine/multiclass';
import { castConcentrationSpell } from '../../engine/combat';
import { doubleDiceCount } from '../../engine/dice';
import { useDiceLogStore } from '../../store/diceLogStore';
import { UseModal, applyActionCardUse, ActivationOptionModal } from './TabActions';
import { AddSpellModal } from './AddSpellModal';
import { PREPARED_CASTER_CLASS_IDS, formatCastingContextLabel, CardGenOptions } from '../../engine/actionCards';
import { Alert } from '../../utils/alert';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_ORDINALS: Record<number, string> = {
  1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th',
  6: '6th', 7: '7th', 8: '8th', 9: '9th',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  entity:         Entity;
  rules:          CampaignRules;
  // Optional label param (audit finding TIMELINE-LABEL-1): this tab funnels
  // 3 semantically different actions — cast, toggle-prepared, learn a new
  // spell — through one callback, and the parent sheet screen has no way to
  // tell them apart on its own. Each call site below now passes its own
  // specific label; the parent falls back to a generic one if omitted.
  onEntityUpdate: (updated: Entity, label?: string) => void;
  /** Closure item 16 — the one authoritative End Turn entry point, shared
   *  verbatim with the Character and Actions tabs (see app/sheet/[id].tsx's
   *  handleEndTurn). */
  onEndTurn: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

function TabSpellsInner({ entity, rules, onEntityUpdate, onEndTurn }: Props) {
  const [activeCard, setActiveCard] = useState<ActionCard | null>(null);
  // Rules-engine blocker RE-AUDIT closure (2F): carries the bypass/context
  // decision ALONGSIDE the card, not just the card alone — see
  // TabActions.tsx's PendingActionUse for the identical fix and its own doc
  // comment on why the old bare-card version was a real bug (a chosen
  // source/Cast-Anyway decision was silently discarded by the option picker).
  const [pendingUse, setPendingUse] = useState<{
    card: ActionCard;
    bypassSpellPreparation?: boolean;
    selectedSpellCastingContext?: SpellCastingContext;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const homebrewSpells = useHomebrewStore(s => s.spells);
  const [addSpellOpen, setAddSpellOpen] = useState(false);

  // Rules-engine blocker RE-AUDIT closure (dependency inversion, 1B/1D):
  // the ONE place this tab resolves the authoritative merged official +
  // homebrew + active-ruleset content — the engine (actionCards.ts/
  // actionUse.ts/entitlements.ts) never reads useHomebrewStore itself
  // anymore; it's computed here, in the application/UI layer, and passed
  // down explicitly to every engine call that needs it.
  const mergedContentDB = useHomebrewStore(s => s.getMergedContentDB(entity.rulesetId));
  const cardContent: Pick<CardGenOptions, 'classDefs' | 'homebrewSpells'> = useMemo(
    () => ({ classDefs: mergedContentDB.classes, homebrewSpells: mergedContentDB.spells }),
    [mergedContentDB],
  );

  // Mirrors the latest `entity` prop for handlers that span an async gap —
  // bug fix: addSpell (below) used to read the `entity` closed over at the
  // moment it was called, which could be stale by the time its await
  // resolved if any other mutation (damage, a rest, a synced update from
  // the DM) landed on the store in the meantime. Since onEntityUpdate
  // installs a full entity rather than merging, committing that stale
  // snapshot silently reverted whatever changed during the wait. Every
  // sibling handler in this file already resolves its async lookup BEFORE
  // touching `entity`; addSpell is the one that reads it AFTER, so it's
  // the one that needs this.
  const entityRef = useRef(entity);
  entityRef.current = entity;

  // A character may reach this tab without a spellcasting block (e.g. a Skeleton
  // whose Doomed Touch cantrip hasn't been initialised). Use a safe default so
  // the Add Spell action can initialise a real block on first use.
  const spellcasting = entity.spellcasting ?? {
    ability:       'con' as const,
    slots:         { '1':{total:0,used:0}, '2':{total:0,used:0}, '3':{total:0,used:0}, '4':{total:0,used:0}, '5':{total:0,used:0}, '6':{total:0,used:0}, '7':{total:0,used:0}, '8':{total:0,used:0}, '9':{total:0,used:0} },
    cantrips:      [] as string[],
    known:         [] as string[],
    prepared:      [] as string[],
    concentrating: null as string | null,
  };
  const { identity } = entity;

  // Add a spell/cantrip to the character. Initialises the spellcasting block
  // if the entity didn't have one. Cantrips (level 0) go to .cantrips; leveled
  // spells go to .known.
  async function addSpell(spellId: string, level: number) {
    // Warm Tier 2 before this id ever reaches the engine pipeline (spellMap
    // lookup / generateAllActionCards on the next render).
    await spellRepo.ensureLoaded([spellId]);
    // Read the CURRENT entity via the ref, not the stale `entity` closed
    // over when addSpell was called — see entityRef's own doc comment.
    const current = entityRef.current;
    const block = current.spellcasting ?? {
      ability: 'con' as const,
      slots: { '1':{total:0,used:0}, '2':{total:0,used:0}, '3':{total:0,used:0}, '4':{total:0,used:0}, '5':{total:0,used:0}, '6':{total:0,used:0}, '7':{total:0,used:0}, '8':{total:0,used:0}, '9':{total:0,used:0} },
      cantrips: [], known: [], prepared: [], concentrating: null,
    };
    const next = level === 0
      ? { ...block, cantrips: [...new Set([...block.cantrips, spellId])] }
      : { ...block, known:    [...new Set([...block.known,    spellId])] };
    const addedSpell = resolveSpellById(spellId, homebrewSpells);
    const spellName = addedSpell?.name ?? spellId;
    // Rules-engine blocker fix (closure 1C, re-audit 1F): this used to
    // always stamp sourceKind:'manual', even for a spell that's actually on
    // one of the character's OWN classes' spell lists — isSpellPreparationLegal
    // then treated it as permanently exempt from preparation (manual sources
    // never require prep), letting a "+ Add Additional Spell" Wizard/Cleric
    // pick silently bypass preparation forever. Tags the real class source
    // when EXACTLY ONE of the character's classes has this spell on its
    // list (Spell.classes) — the same single-candidate rule the migration
    // path (entitlements.ts's reclassifyManualSpellSources) uses. Zero
    // candidates (not on any of their classes' lists at all) stays an
    // ordinary manual grant. 2+ candidates is genuine unresolved ambiguity
    // (the player didn't say which class they're adding it as) — tagged via
    // ambiguousClassIds rather than a silent guess, so Cast later offers an
    // explicit source choice instead of behaving as globally unrestricted.
    const candidateClassIds = getClassLevels(current)
      .map(c => c.classId as string)
      .filter(classId => (addedSpell?.classes ?? []).includes(classId));
    const source = candidateClassIds.length === 1
      ? { sourceKind: 'class' as const, sourceId: candidateClassIds[0] }
      : candidateClassIds.length >= 2
        ? { sourceKind: 'manual' as const, ambiguousClassIds: candidateClassIds }
        : { sourceKind: 'manual' as const };
    onEntityUpdate(grantEntitlement({ ...current, spellcasting: next }, { kind: level === 0 ? 'cantrip_access' : 'spell_access', key: spellId, ...source }), `Learned ${spellName}`);
  }

  // Multiclass-aware: a character is a "prepared caster" for this tab's
  // purposes if ANY of their classes prepares spells — matches identity.classId
  // for single-class characters (getClassLevels' legacy fallback).
  const isPreparedCaster = getClassLevels(entity).some(c => PREPARED_CASTER_CLASS_IDS.has(c.classId));
  const preparedSet      = new Set(spellcasting.prepared);

  // ── Spell cards ───────────────────────────────────────────────────────────
  // ActionCard instances already know slot availability. We filter to the
  // 'spellcasting' tab to exclude non-spell feature cards. Cards themselves
  // are computed once per mutation by recomputeDerived(), not here — no
  // useMemo needed, entity.actionCards is already stable per entity version.

  const spellCards = (entity.actionCards ?? []).filter(c => c.tabs.includes('spellcasting'));

  // ── Spell detail lookup ───────────────────────────────────────────────────
  // Only ever needs ids the character actually knows (spellCards' featureIds)
  // — those are already warmed into spellRepo's Tier-2 cache by
  // characterStore.ts's loadCharacters()/mutation paths, so this is a
  // synchronous lookup, not a fetch. resolveSpellById gives homebrew-first
  // precedence — see contentResolution.ts.

  const spellMap = useMemo(() => {
    const map = new Map<string, Spell>();
    for (const card of spellCards) {
      const sp = resolveSpellById(card.featureId, homebrewSpells);
      if (sp) map.set(card.featureId, sp);
    }
    return map;
  }, [spellCards, homebrewSpells]);

  // ── Group cards by spell level ────────────────────────────────────────────
  // Level is inferred from resourceCost.spellSlotTier; cantrips have null cost → level 0.

  const grouped = useMemo(() => {
    const groups = new Map<number, ActionCard[]>();
    for (const card of spellCards) {
      const level = card.resourceCost?.spellSlotTier ?? 0;
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level)!.push(card);
    }
    return groups;
  }, [spellCards]);

  const sortedLevels = Array.from(grouped.keys()).sort((a, b) => a - b);

  // ── Cast handler (mirrors TabActions.handleUse exactly) ──────────────────

  const { requestPayment, paymentChooser } = useSpellPayment(entity);
  const performCast = useCallback((card: ActionCard, option?: ActivationOption, payment?: SpellPaymentOption, bypassPreparation?: boolean, selectedContext?: SpellCastingContext) => {
    // Bug fix (architecture review U5): this used to hand-duplicate
    // applyActionCardUse's spell-slot/resource-spend logic without ever
    // calling markActionSlotUsed — casting a spell from this tab consumed
    // a slot but never marked the action-economy slot used, so the same
    // character could still use an Actions-tab feature that same turn.
    // Delegating to the shared implementation also picks up its
    // abilityEffects application, which this handler never had at all.
    // `bypassPreparation` is the table-first Quick Override ("Cast
    // Anyway") — see applyActionCardUse's own doc comment. A normal legal
    // cast and a Quick Override cast both converge on this exact same
    // call; there is no separate cast implementation for either.
    let updated = applyActionCardUse(entity, card, rules, option, payment, bypassPreparation, selectedContext, cardContent);
    if (updated === entity) return;

    // applyActionCardUse's own concentration check only looks up official
    // spellRepo content — this tab's spellMap resolves homebrew-first (see
    // its own comment above), so re-check on top for a homebrew
    // concentration spell it would otherwise miss. Only when the cast
    // actually went through (updated !== entity — applyActionCardUse
    // returns the original entity unchanged on any failed-cost guard).
    // castConcentrationSpell's drop-then-begin design makes a second call
    // for the same spell (the official-content case, already handled
    // inside applyActionCardUse) a safe no-op, not a double-application bug.
    if (updated !== entity) {
      const spell = spellMap.get(card.featureId);
      if (spell?.concentration) {
        updated = castConcentrationSpell(updated, spell, rules);
      }
    }

    onEntityUpdate(updated, `Cast ${card.name}`);
    setActiveCard(card);
  }, [entity, onEntityUpdate, spellMap, rules, cardContent]);

  // Rules-engine blocker RE-AUDIT closure (2F): the LAST step of every cast
  // path below — after a casting source (if any choice existed) and a
  // preparation Cast Anyway decision (if any) are both already resolved.
  // An activation-option card (e.g. Divine Smite's spell-slot tier) defers
  // to the option picker, preserving that already-decided bypass/context
  // instead of discarding it — see pendingUse's own doc comment for why
  // this matters (the old flow silently lost it here).
  const proceedToPaymentOrOptions = useCallback((card: ActionCard, bypassSpellPreparation: boolean, selectedContext?: SpellCastingContext) => {
    if (card.activation.options && card.activation.options.length > 0) {
      setPendingUse({ card, bypassSpellPreparation, selectedSpellCastingContext: selectedContext });
      return;
    }
    requestPayment(card, undefined, payment => performCast(card, undefined, payment, bypassSpellPreparation, selectedContext));
  }, [performCast, requestPayment]);

  // Rules-engine blocker RE-AUDIT closure (1C/1E) — when a spell has 2+
  // MECHANICALLY DISTINCT casting sources (e.g. a Wizard/Sorcerer character
  // sharing a spell), casting proceeds via a SPECIFIC chosen context, never
  // a silent tie-break. A prep-blocked context selected intentionally still
  // offers Cast Anyway for THAT context; a legal one casts directly. Single-
  // context spells (the overwhelming majority) skip this entirely and fall
  // through to the unchanged flow below.
  const castViaContext = useCallback((card: ActionCard, context: SpellCastingContext) => {
    if (!context.legal) {
      Alert.alert(
        `${card.name} is not prepared.`,
        'You can cast it anyway for this one time — it will not be added to your prepared spells, and everything else (slot, concentration, etc.) still applies normally.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cast Anyway', onPress: () => proceedToPaymentOrOptions(card, true, context) },
        ],
      );
      return;
    }
    proceedToPaymentOrOptions(card, false, context);
  }, [proceedToPaymentOrOptions]);

  const handleCast = useCallback((card: ActionCard) => {
    if (card.spellCastingContexts && card.spellCastingContexts.length > 1) {
      Alert.alert(
        `Cast ${card.name} as...`,
        undefined,
        [
          ...card.spellCastingContexts.map(ctx => ({
            text: formatCastingContextLabel(entity, ctx, cardContent.classDefs),
            onPress: () => castViaContext(card, ctx),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
      return;
    }

    // Table-first Quick Override (rules-engine blocker A): a leveled spell
    // blocked ONLY by preparation (card.preparationOverridable — see
    // generateSpellCard's own doc comment) offers a compact, explicit,
    // local, non-destructive "Cast Anyway" instead of just sitting
    // disabled. Choosing it never touches entity.spellcasting.prepared —
    // it's a one-off exception for THIS cast, not a permanent rules
    // change; the normal slot/payment/resource/action-economy bookkeeping
    // below still runs exactly as it would for a legal cast. If the spell
    // has ANY other independent blocker (no usable slot, etc.),
    // preparationOverridable is false and this offer never appears —
    // existing payment/resource rules still apply unconditionally.
    if (card.preparationOverridable) {
      Alert.alert(
        `${card.name} is not prepared.`,
        'You can cast it anyway for this one time — it will not be added to your prepared spells, and everything else (slot, concentration, etc.) still applies normally.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cast Anyway', onPress: () => proceedToPaymentOrOptions(card, true, card.spellCastingContext) },
        ],
      );
      return;
    }
    proceedToPaymentOrOptions(card, false, card.spellCastingContext);
  }, [entity, castViaContext, cardContent, proceedToPaymentOrOptions]);

  const handleChooseOption = useCallback((option: ActivationOption) => {
    const pending = pendingUse;
    setPendingUse(null);
    if (!pending) return;
    const { card, bypassSpellPreparation, selectedSpellCastingContext } = pending;
    requestPayment(card, option, payment => performCast(card, option, payment, bypassSpellPreparation, selectedSpellCastingContext));
  }, [performCast, pendingUse, requestPayment]);

  // ── Prepared toggle (prepared casters only) ──────────────────────────────

  const togglePrepared = useCallback((spellId: string) => {
    if (!entity.spellcasting) return;
    const alreadyPrepared = entity.spellcasting.prepared.includes(spellId);
    const newPrepared = alreadyPrepared
      ? entity.spellcasting.prepared.filter(id => id !== spellId)
      : [...entity.spellcasting.prepared, spellId];
    const spellName = spellMap.get(spellId)?.name ?? spellId;
    onEntityUpdate({
      ...entity,
      spellcasting: { ...entity.spellcasting, prepared: newPrepared },
    }, alreadyPrepared ? `Unprepared ${spellName}` : `Prepared ${spellName}`);
  }, [entity, onEntityUpdate, spellMap]);

  function rollForCard(crit: boolean) {
    if (!activeCard) return null;
    const expr = activeCard.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1];
    if (!expr) return null;
    const finalExpr = crit ? doubleDiceCount(expr) : expr;
    try { return useDiceLogStore.getState().rollAndLog(finalExpr, activeCard.name); }
    catch { return null; }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Add Spell button */}
      <Pressable style={styles.addSpellBtn} onPress={() => setAddSpellOpen(true)}>
        <Text style={styles.addSpellBtnTxt}>+ Add Spell or Cantrip</Text>
      </Pressable>

      {/* Closure item 16: calls the ONE shared onEndTurn handler
          (app/sheet/[id].tsx's handleEndTurn) instead of computing
          playerEndTurn() locally and passing a locally-chosen label through
          this tab's own onEntityUpdate — guarantees identical timeline
          label/category/sync/undo behavior regardless of which tab End
          Turn is pressed from. No preview gate, same precedent as the
          other two tabs. */}
      <Pressable
        style={styles.endTurnBtn}
        onPress={onEndTurn}
      >
        <Text style={styles.endTurnBtnTxt}>⏭ End Turn</Text>
      </Pressable>

      {/* Concentration banner */}
      {spellcasting.concentrating && (
        <View style={styles.concBanner}>
          <Text style={styles.concBannerTxt}>
            🧠 Concentrating: {spellMap.get(spellcasting.concentrating)?.name ?? spellcasting.concentrating}
            {spellcasting.concentratingDuration?.unit === 'rounds' && ` · ${spellcasting.concentratingDuration.remaining}r`}
          </Text>
        </View>
      )}

      {/* Empty state */}
      {sortedLevels.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📖</Text>
          <Text style={styles.emptyTxt}>No spells known yet.</Text>
          <Text style={styles.emptySubTxt}>
            Spells appear here after leveling up or completing the creation wizard.
          </Text>
        </View>
      )}

      {/* Level sections */}
      {sortedLevels.map(level => {
        const cards    = grouped.get(level)!;
        const slotKey  = String(level) as keyof typeof spellcasting.slots;
        const slotData = level > 0 ? spellcasting.slots[slotKey] : null;

        return (
          <View key={level} style={styles.levelSection}>
            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {level === 0
                  ? 'CANTRIPS'
                  : `${SLOT_ORDINALS[level]?.toUpperCase() ?? `LEVEL ${level}`} LEVEL`}
              </Text>
              {slotData && slotData.total > 0 && (
                <View style={[
                  styles.slotBadge,
                  slotData.used >= slotData.total && styles.slotBadgeEmpty,
                ]}>
                  <Text style={[
                    styles.slotBadgeTxt,
                    slotData.used >= slotData.total && styles.slotBadgeTxtEmpty,
                  ]}>
                    {slotData.total - slotData.used}/{slotData.total} slots
                  </Text>
                </View>
              )}
            </View>

            {/* Spell rows */}
            {cards.map(card => {
              const spell      = spellMap.get(card.featureId);
              const isExpanded = expandedId === card.featureId;
              const isPrepared = preparedSet.has(card.featureId);

              // Table-first Quick Override (rules-engine blocker A): a
              // spell blocked ONLY by preparation stays fully discoverable
              // and actionable — not dimmed/hidden like a genuinely
              // unavailable card (no slot, action already used, etc.).
              // Tapping Cast opens the "Cast Anyway" prompt (handleCast);
              // the button is never disabled for this reason alone.
              const blockedOnlyByPreparation = card.preparationOverridable === true;
              const genuinelyUnavailable = !card.available && !blockedOnlyByPreparation;

              return (
                <View key={card.featureId} style={[
                  styles.spellCard,
                  genuinelyUnavailable && styles.spellCardUnavail,
                ]}>
                  <View style={styles.spellRow}>
                    {/* Left — tap to expand */}
                    <Pressable
                      style={styles.spellBody}
                      onPress={() => setExpandedId(isExpanded ? null : card.featureId)}
                    >
                      <View style={styles.spellNameLine}>
                        <Text style={[styles.spellName, genuinelyUnavailable && styles.spellNameDim]}>
                          {card.name}
                        </Text>
                        <View style={styles.spellTags}>
                          {blockedOnlyByPreparation && (
                            <View style={styles.tagUnprepared}>
                              <Text style={styles.tagUnpreparedTxt}>Not Prepared</Text>
                            </View>
                          )}
                          {spell?.concentration && (
                            <View style={styles.tagConc}>
                              <Text style={styles.tagConcTxt}>Conc</Text>
                            </View>
                          )}
                          {spell?.ritual && (
                            <View style={styles.tagRitual}>
                              <Text style={styles.tagRitualTxt}>Ritual</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.expandCaret}>{isExpanded ? '▲' : '▼'}</Text>
                      </View>
                      <Text style={styles.spellMeta} numberOfLines={1}>
                        {spell
                          ? `${spell.school} · ${spell.castingTime}`
                          : card.layer1
                        }
                      </Text>
                    </Pressable>

                    {/* Right — prepared toggle (prepared casters, leveled spells) + Cast */}
                    <View style={styles.spellActions}>
                      {isPreparedCaster && level > 0 && (
                        <Pressable
                          style={[styles.prepBtn, isPrepared && styles.prepBtnActive]}
                          onPress={() => togglePrepared(card.featureId)}
                        >
                          <Text style={[styles.prepBtnTxt, isPrepared && styles.prepBtnTxtActive]}>
                            {isPrepared ? '✓' : '○'}
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={[styles.castBtn, genuinelyUnavailable && styles.castBtnDisabled]}
                        onPress={() => handleCast(card)}
                        disabled={genuinelyUnavailable}
                      >
                        <Text style={[styles.castBtnTxt, genuinelyUnavailable && styles.castBtnTxtDisabled]}>
                          {card.available || blockedOnlyByPreparation ? 'Cast' : 'N/A'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Expanded spell details */}
                  {isExpanded && (
                    <View style={styles.details}>
                      {spell ? (
                        <>
                          <View style={styles.detailGrid}>
                            <DetailCell label="Range"      value={spell.range} />
                            <DetailCell label="Duration"   value={spell.duration} />
                            <DetailCell label="Components" value={spell.components.join(', ')} />
                          </View>
                          {/* Key effect from action card (damage dice, save, etc.) */}
                          {card.layer2 && (
                            <Text style={styles.detailEffect}>{card.layer2}</Text>
                          )}
                          {card.layer3 && (
                            <Text style={styles.detailSave}>{card.layer3}</Text>
                          )}
                          <Text style={styles.detailDesc}>{spell.description}</Text>
                          {spell.upcast && (
                            <View style={styles.upcastBlock}>
                              <Text style={styles.upcastLabel}>At Higher Levels</Text>
                              <Text style={styles.upcastDesc}>{spell.upcast}</Text>
                            </View>
                          )}
                        </>
                      ) : (
                        // Vault spell with no hand-authored entry — show layer2/layer3 only
                        <>
                          {card.layer2 && <Text style={styles.detailEffect}>{card.layer2}</Text>}
                          {card.layer3 && <Text style={styles.detailSave}>{card.layer3}</Text>}
                        </>
                      )}
                      {!card.available && card.unavailableReason && (
                        <Text style={styles.unavailNote}>{card.unavailableReason}</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      {/* Shared cast result modal */}
      {paymentChooser}
      <UseModal
        card={activeCard}
        onRoll={rollForCard}
        onClose={() => setActiveCard(null)}
      />

      <ActivationOptionModal
        entity={entity}
        card={pendingUse?.card ?? null}
        onChoose={handleChooseOption}
        onClose={() => setPendingUse(null)}
      />

      {/* Add Spell picker modal — rich multi-axis filtering */}
      <AddSpellModal
        visible={addSpellOpen}
        entity={entity}
        onAdd={(spellId, isCantrip) => { void addSpell(spellId, isCantrip ? 0 : 1); }}
        onClose={() => setAddSpellOpen(false)}
      />
    </ScrollView>
  );
}

// EDIT-PERF-1: see TabCharacter.tsx's identical comment.
export const TabSpells = memo(TabSpellsInner);

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailCellLabel}>{label}</Text>
      <Text style={styles.detailCellValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  addSpellBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66', borderStyle: 'dashed',
    padding: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm,
  },
  addSpellBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  endTurnBtn: {
    alignSelf: 'flex-start', marginBottom: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  endTurnBtnTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  modalBackdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl, maxHeight: '90%',
  },
  modalTitle:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalSearch: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  modalGroup:      { marginBottom: Spacing.sm },
  modalGroupLabel: { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2, fontWeight: FontWeight.bold, marginBottom: Spacing.xs },
  modalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalRowName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  modalRowMeta: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },
  modalAdd:     { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  modalRemove:  { fontSize: FontSize.sm, color: Colors.red, fontWeight: FontWeight.bold },
  modalEmpty:   { color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },
  modalClose:   { alignItems: 'center', padding: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md },
  modalCloseTxt:{ color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  // Concentration
  concBanner: {
    backgroundColor: Colors.blue + '22',
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.blue + '66',
    padding:         Spacing.sm,
    marginBottom:    Spacing.xs,
  },
  concBannerTxt: {
    color:      Colors.blue,
    fontWeight: FontWeight.bold,
    fontSize:   FontSize.sm,
    textAlign:  'center',
  },

  // Empty
  empty:      { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyIcon:  { fontSize: 48 },
  emptyTxt:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptySubTxt:{ fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  // Level section
  levelSection: { gap: Spacing.xs },
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sectionTitle: {
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.bold,
    color:         Colors.textSecondary,
    letterSpacing: 2,
  },

  // Slot badge
  slotBadge: {
    backgroundColor:  Colors.blue + '22',
    borderRadius:     Radius.full,
    borderWidth:      1,
    borderColor:      Colors.blue + '66',
    paddingHorizontal: Spacing.sm,
    paddingVertical:  2,
  },
  slotBadgeEmpty: {
    backgroundColor: Colors.border,
    borderColor:     Colors.border,
  },
  slotBadgeTxt: {
    fontSize:   FontSize.xs,
    color:      Colors.blue,
    fontWeight: FontWeight.bold,
  },
  slotBadgeTxtEmpty: { color: Colors.textDim },

  // Spell card
  spellCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    overflow:        'hidden',
  },
  spellCardUnavail: { opacity: 0.6 },

  spellRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       Spacing.sm,
    gap:           Spacing.sm,
  },

  // Left body (tap to expand)
  spellBody: { flex: 1, gap: 3 },
  spellNameLine: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
  },
  spellName: {
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
    color:      Colors.textPrimary,
    flexShrink: 1,
  },
  spellNameDim: { color: Colors.textDim },
  spellTags: { flexDirection: 'row', gap: 4 },
  tagConc: {
    backgroundColor: Colors.blue + '22',
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     Colors.blue + '66',
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  tagConcTxt:  { fontSize: 9, color: Colors.blue, fontWeight: FontWeight.bold },
  tagRitual: {
    backgroundColor: Colors.gold + '22',
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     Colors.gold + '66',
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  tagRitualTxt:{ fontSize: 9, color: Colors.gold, fontWeight: FontWeight.bold },
  tagUnprepared: {
    backgroundColor: Colors.textDim + '22',
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     Colors.textDim + '66',
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  tagUnpreparedTxt: { fontSize: 9, color: Colors.textDim, fontWeight: FontWeight.bold },
  expandCaret: { fontSize: 9, color: Colors.textDim, marginLeft: 'auto' },
  spellMeta:   { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Right actions
  spellActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  // Prepared toggle
  prepBtn: {
    width:           28,
    height:          28,
    borderRadius:    Radius.full,
    borderWidth:     1,
    borderColor:     Colors.border,
    backgroundColor: Colors.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
  },
  prepBtnActive: {
    borderColor:     Colors.green + '88',
    backgroundColor: Colors.green + '22',
  },
  prepBtnTxt:        { fontSize: FontSize.sm, color: Colors.textDim },
  prepBtnTxtActive:  { color: Colors.green, fontWeight: FontWeight.bold },

  // Cast button
  castBtn: {
    backgroundColor:  Colors.blue + '22',
    borderRadius:     Radius.md,
    borderWidth:      1,
    borderColor:      Colors.blue + '66',
    paddingHorizontal: Spacing.sm,
    paddingVertical:  Spacing.xs,
    minWidth:         44,
    alignItems:       'center',
  },
  castBtnDisabled: {
    backgroundColor: Colors.surfaceHigh,
    borderColor:     Colors.border,
  },
  castBtnTxt:         { fontSize: FontSize.sm, color: Colors.blue, fontWeight: FontWeight.bold },
  castBtnTxtDisabled: { color: Colors.textDim },

  // Expanded details
  details: {
    paddingHorizontal: Spacing.sm,
    paddingBottom:     Spacing.sm,
    paddingTop:        2,
    gap:               Spacing.xs,
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
    marginBottom:  Spacing.xs,
  },
  detailCell: {
    backgroundColor:  Colors.surfaceHigh,
    borderRadius:     Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   4,
  },
  detailCellLabel: {
    fontSize:      FontSize.xs,
    color:         Colors.textDim,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailCellValue: {
    fontSize:   FontSize.sm,
    color:      Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  detailEffect: {
    fontSize:   FontSize.sm,
    color:      Colors.gold,
    fontWeight: FontWeight.bold,
  },
  detailSave: {
    fontSize: FontSize.xs,
    color:    Colors.textSecondary,
  },
  detailDesc: {
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    lineHeight: 18,
  },
  upcastBlock: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold + '66',
    padding:         Spacing.sm,
    gap:             2,
  },
  upcastLabel: {
    fontSize:   FontSize.xs,
    color:      Colors.gold,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  upcastDesc: {
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
    lineHeight: 16,
  },
  unavailNote: {
    fontSize:   FontSize.xs,
    color:      Colors.red,
    fontStyle:  'italic',
  },
});
