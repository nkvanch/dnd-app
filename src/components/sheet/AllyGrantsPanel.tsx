// src/components/sheet/AllyGrantsPanel.tsx
// UI for ally-targeting effects (see src/engine/allyGrants.ts):
//  - AuraChecklistPanel: the holder ticks which allies are currently inside
//    each aura they project (no battle map, so this is table-resolved).
//  - ReceivedGrantsPanel: what other creatures' features are currently giving
//    this character, with dismiss / spend-die / spend-token controls.
//  - AllyGrantTargetModal: after using a feature with a chosen grant, pick
//    who receives it (yourself or another character on this device).
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { Entity, CampaignRules } from '../../engine/types';
import {
  listAllyGrantSources, isAuraProjecting, auraKey, grantRangeFeet, setAuraMember, applyChosenGrant,
  dismissReceivedGrant, spendGrantDie, spendGrantToken, AllyGrantSource,
} from '../../engine/allyGrants';
import { useCharacterStore, DEFAULT_RULES } from '../../store/characterStore';
import { useHomebrewStore } from '../../store/homebrewStore';
import { syncAllyGrantsInStore } from '../../store/allyGrantSync';
import { Alert } from '../../utils/alert';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function AuraChecklistPanel({ entity, onEntityUpdate }: { entity: Entity; onEntityUpdate?: (e: Entity) => void }) {
  const homebrewItems = useHomebrewStore(s => s.items);
  const characters = useCharacterStore(s => s.characters);
  const auras = useMemo(
    () => listAllyGrantSources(entity, homebrewItems).filter(s => s.spec.mode === 'aura' && !s.spec.selfOnly),
    [entity, homebrewItems]);
  const others = characters.filter(c => c.id !== entity.id && c.kind === 'character');
  if (auras.length === 0) return null;

  function toggle(src: AllyGrantSource, allyId: string, on: boolean) {
    const next = setAuraMember(entity, src.feature.id, src.spec.id, allyId, on);
    onEntityUpdate?.(next);
    syncAllyGrantsInStore([next]);
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>AURAS — WHO IS IN RANGE?</Text>
      {auras.map(src => {
        const projecting = isAuraProjecting(entity, src.spec);
        const members = entity.auraMembers?.[auraKey(src.feature.id, src.spec.id)] ?? [];
        const range = grantRangeFeet(src.spec, entity);
        return (
          <View key={`${src.feature.id}:${src.spec.id}`} style={styles.block}>
            <Text style={styles.name}>{src.spec.label}{range ? ` · ${range} ft` : ''}</Text>
            {src.spec.activeWhileFlag && (
              <Pressable style={styles.btnGhost} onPress={() => {
                const flag = src.spec.activeWhileFlag!;
                const on = entity.conditionMonitor.flags[flag] === true;
                onEntityUpdate?.({ ...entity, conditionMonitor: { ...entity.conditionMonitor, flags: { ...entity.conditionMonitor.flags, [flag]: !on } } });
              }}>
                <Text style={styles.btnGhostTxt}>{entity.conditionMonitor.flags[src.spec.activeWhileFlag] === true ? 'Active — tap to end' : 'Inactive — tap to start'}</Text>
              </Pressable>
            )}
            {!projecting && (
              <Text style={styles.hint}>
                {src.spec.activeWhileFlag ? `Not active — turn on "${src.spec.activeWhileFlag.replace(/_/g, ' ')}" first.` : 'Not active (you are incapacitated).'}
              </Text>
            )}
            {src.spec.includeSelf && <Text style={styles.hint}>Applies to you automatically.</Text>}
            <Text style={styles.hint}>Grimoire has no battle map — tick the allies currently within range; the effect applies to exactly that set.</Text>
            {others.length === 0 && <Text style={styles.hint}>No other characters on this device. Allies on another phone apply it by hand.</Text>}
            <View style={styles.chips}>
              {others.map(o => {
                const on = members.includes(o.id);
                return (
                  <Pressable key={o.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(src, o.id, !on)}>
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{on ? '✓ ' : ''}{o.identity.name || 'Unnamed'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function ReceivedGrantsPanel({ entity, rules, onEntityUpdate }: { entity: Entity; rules?: CampaignRules; onEntityUpdate?: (e: Entity) => void }) {
  const grants = entity.receivedGrants ?? [];
  if (grants.length === 0) return null;
  const r = rules ?? DEFAULT_RULES;
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>EFFECTS FROM ALLIES</Text>
      {grants.map(g => (
        <View key={g.id} style={styles.block}>
          <Text style={styles.name}>{g.label} <Text style={styles.hint}>from {g.sourceName}{g.mode === 'aura' ? ' (aura)' : ''}</Text></Text>
          {g.note ? <Text style={styles.hint}>{g.note}</Text> : null}
          {g.tempHpGranted ? <Text style={styles.hint}>Granted {g.tempHpGranted} temporary HP.</Text> : null}
          {g.duration ? <Text style={styles.hint}>{g.duration.remaining} {g.duration.unit} left (counted at the end of your turns — dismiss early if the table says so).</Text> : null}
          <View style={styles.chips}>
            {g.die && g.die.remaining > 0 && (
              <Pressable style={styles.btn} onPress={() => {
                const res = spendGrantDie(entity, g.id, r);
                if (!res) return;
                onEntityUpdate?.(res.entity);
                Alert.alert(g.label, `Rolled ${res.roll} on the ${res.size}. Add it to the ${g.die!.usableOn}.`);
              }}>
                <Text style={styles.btnTxt}>Use {g.die.remaining}× {g.die.size} — {g.die.usableOn}</Text>
              </Pressable>
            )}
            {g.token && g.token.remaining > 0 && (
              <Pressable style={styles.btn} onPress={() => onEntityUpdate?.(spendGrantToken(entity, g.id, r))}>
                <Text style={styles.btnTxt}>Use ({g.token.remaining} left): {g.token.text}</Text>
              </Pressable>
            )}
            {g.mode === 'chosen' && (
              <Pressable style={styles.btnGhost} onPress={() => onEntityUpdate?.(dismissReceivedGrant(entity, g.id, r))}>
                <Text style={styles.btnGhostTxt}>Dismiss</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Chosen-grant specs on the feature a just-used card came from. */
export function chosenSourcesForFeature(entity: Entity, featureId: string, homebrewItems: Parameters<typeof listAllyGrantSources>[1]): AllyGrantSource[] {
  return listAllyGrantSources(entity, homebrewItems).filter(s => s.spec.mode === 'chosen' && s.feature.id === featureId);
}

export function AllyGrantTargetModal({ holder, sources, onClose, onHolderUpdate }: {
  holder: Entity | null;
  sources: AllyGrantSource[];
  onClose: () => void;
  onHolderUpdate: (e: Entity) => void;
}) {
  const characters = useCharacterStore(s => s.characters);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const [picked, setPicked] = useState<string[]>([]);
  if (!holder || sources.length === 0) return null;
  const src = sources[0];
  const many = src.spec.targets === 'many';
  const others = characters.filter(c => c.id !== holder.id && c.kind === 'character');
  const options = [{ id: holder.id, name: 'Yourself', entity: holder }, ...others.map(o => ({ id: o.id, name: o.identity.name || 'Unnamed', entity: o }))];

  function give(targets: Entity[]) {
    let h = holder!;
    for (const target of targets) {
      for (const s of sources) {
        const res = applyChosenGrant(h, target.id === h.id ? h : target, s);
        h = res.holder;
        if (target.id !== holder!.id) {
          const grantedTarget = res.target;
          updateCharacter(target.id, () => grantedTarget, `${s.spec.label} granted`);
        }
      }
    }
    onHolderUpdate(h);
    setPicked([]);
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{src.spec.label}</Text>
          <Text style={styles.hint}>
            {many ? 'Tick everyone who receives it' : 'Choose who receives it'}
            {grantRangeFeet(src.spec, holder) ? ` (within ${grantRangeFeet(src.spec, holder)} ft — range is table-resolved)` : ''}. {src.spec.note ?? ''}
          </Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {options.map(o => {
              const on = picked.includes(o.id);
              return (
                <Pressable key={o.id} style={[many ? styles.chip : styles.btn, many && on && styles.chipOn, { marginTop: Spacing.xs }]}
                  onPress={() => many ? setPicked(p => on ? p.filter(x => x !== o.id) : [...p, o.id]) : give([o.entity])}>
                  <Text style={many ? [styles.chipTxt, on && styles.chipTxtOn] : styles.btnTxt}>{many && on ? '✓ ' : ''}{o.name}</Text>
                </Pressable>
              );
            })}
            {others.length === 0 && <Text style={styles.hint}>No other characters on this device — an ally on another phone applies it by hand.</Text>}
          </ScrollView>
          {many && (
            <Pressable style={[styles.btn, picked.length === 0 && { opacity: 0.4 }]} disabled={picked.length === 0}
              onPress={() => give(options.filter(o => picked.includes(o.id)).map(o => o.entity))}>
              <Text style={styles.btnTxt}>Grant to {picked.length}</Text>
            </Pressable>
          )}
          <Pressable style={styles.btnGhost} onPress={onClose}><Text style={styles.btnGhostTxt}>Skip (table resolves it)</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 1 },
  block: { gap: 4 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  hint: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtOn: { color: Colors.gold, fontWeight: FontWeight.bold },
  btn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: Spacing.md, alignItems: 'center' },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  btnGhost: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: Spacing.md, alignItems: 'center' },
  btnGhostTxt: { color: Colors.textSecondary, fontSize: FontSize.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
});
