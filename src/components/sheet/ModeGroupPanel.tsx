// src/components/sheet/ModeGroupPanel.tsx
// Controls for mode groups (src/engine/modes.ts): one panel per group the
// character carries. Wording comes from the group's own `optionLabel`
// ("Bound Spirit"), never a hardcoded "Subclass".
import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Entity, CampaignRules, ModeGroup } from '../../engine/types';
import {
  listModeGroups, modeSelectorInfo, setMode, startModePeriod, pickPendingRoll, rerollMode, clearMode,
  setTargetMode, removeTargetMode, setExtraTargets, targetLimit,
} from '../../engine/modes';
import { recomputeDerived } from '../../engine/pipeline';
import { useCharacterStore } from '../../store/characterStore';
import { syncAllyGrantsInStore } from '../../store/allyGrantSync';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

function Chips({ items, selected, onPick }: { items: { id: string; label: string }[]; selected?: string | null; onPick: (id: string) => void }) {
  return (
    <View style={styles.chips}>
      {items.map(i => (
        <Pressable key={i.id} style={[styles.chip, selected === i.id && styles.chipOn]} onPress={() => onPick(i.id)}>
          <Text style={[styles.chipTxt, selected === i.id && styles.chipTxtOn]}>{i.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SelfGroup({ entity, rules, group, onEntityUpdate }: { entity: Entity; rules: CampaignRules; group: ModeGroup; onEntityUpdate: (e: Entity) => void }) {
  const info = modeSelectorInfo(entity, group);
  const [physical, setPhysical] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const commit = (e: Entity) => onEntityUpdate(recomputeDerived(e, rules));
  const label = group.optionLabel;
  const nameOf = (id: string) => group.options.find(o => o.id === id)?.name ?? id;
  const optionItems = group.options.map(o => ({ id: o.id, label: o.name }));
  const dieRolls = (info.pendingRolls ?? []);

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{group.name.toUpperCase()}</Text>
      <Text style={styles.name}>{info.active ? `${label}: ${info.active.name}` : `No ${label} chosen yet`}</Text>
      {info.active?.summary ? <Text style={styles.hint}>{info.active.summary}</Text> : null}

      {info.canRoll && (
        <>
          <Text style={styles.hint}>
            A new {info.periodLabel} begins when the table says so — there is no calendar. Roll a d{info.die}
            {info.rollCount > 1 ? ` (${info.rollCount} dice — you choose which answers)` : ''}, or enter the die you rolled.
          </Text>
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={() => commit(startModePeriod(entity, group.id))}>
              <Text style={styles.btnTxt}>🎲 New {info.periodLabel}: roll d{info.die}{info.rollCount > 1 ? ` ×${info.rollCount}` : ''}</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <TextInput style={styles.input} value={physical} onChangeText={setPhysical} keyboardType="numeric"
              placeholder={info.rollCount > 1 ? 'dice, e.g. 3 8' : 'my roll'} placeholderTextColor={Colors.textDim} />
            <Pressable style={styles.btnGhost} onPress={() => {
              const vals = physical.split(/[\s,]+/).map(v => parseInt(v, 10)).filter(v => Number.isFinite(v));
              if (vals.length === 0) return;
              commit(startModePeriod(entity, group.id, vals));
              setPhysical('');
            }}>
              <Text style={styles.btnGhostTxt}>Use my roll</Text>
            </Pressable>
          </View>
          {dieRolls.length > 0 && (
            <>
              <Text style={styles.name}>Choose which {label.toLowerCase()} answers:</Text>
              <View style={styles.chips}>
                {dieRolls.map((v, i) => {
                  const optId = group.selector.kind === 'table' ? (group.selector.table?.find(t => t.value === v)?.optionId ?? group.options[v - 1]?.id) : undefined;
                  return (
                    <View key={i} style={{ gap: 2 }}>
                      <Pressable style={styles.btn} onPress={() => commit(pickPendingRoll(entity, group.id, i))}>
                        <Text style={styles.btnTxt}>{v} → {optId ? nameOf(optId) : '?'}</Text>
                      </Pressable>
                      {info.rerollsLeft > 0 && (
                        <Pressable style={styles.btnGhost} onPress={() => commit(rerollMode(entity, group.id, { index: i }))}>
                          <Text style={styles.btnGhostTxt}>Re-roll this die ({info.rerollsLeft} left)</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}
          {dieRolls.length === 0 && info.active && info.rerollsLeft > 0 && (
            <Pressable style={styles.btnGhost} onPress={() => commit(rerollMode(entity, group.id))}>
              <Text style={styles.btnGhostTxt}>Re-roll once ({info.rerollsLeft} left this {info.periodLabel}) — you must keep the new result</Text>
            </Pressable>
          )}
        </>
      )}

      {info.freeChoice && (
        <>
          <Text style={styles.hint}>{group.selector.kind === 'table' ? `Choose any ${label.toLowerCase()} — no roll needed.` : `Choose ${label.toLowerCase()}:`}</Text>
          <Chips items={optionItems} selected={info.active?.id} onPick={id => commit(setMode(entity, group.id, id, 'choice'))} />
        </>
      )}

      {!info.freeChoice && (
        <Pressable onPress={() => setShowAll(v => !v)}>
          <Text style={styles.link}>{showAll ? 'Hide' : 'Set directly (DM ruling)'}</Text>
        </Pressable>
      )}
      {showAll && !info.freeChoice && (
        <Chips items={optionItems} selected={info.active?.id} onPick={id => commit(setMode(entity, group.id, id, 'dm'))} />
      )}
      {!group.requireActiveOption && info.active && (
        <Pressable onPress={() => commit(clearMode(entity, group.id))}><Text style={styles.link}>Clear {label.toLowerCase()}</Text></Pressable>
      )}

      {info.history.length > 0 && (
        <Pressable onPress={() => setShowHistory(v => !v)}>
          <Text style={styles.link}>{showHistory ? 'Hide history' : `History (${info.history.length})`}</Text>
        </Pressable>
      )}
      {showHistory && info.history.slice().reverse().map((h, i) => (
        <Text key={i} style={styles.hint}>{h.at.slice(0, 10)} · {nameOf(h.optionId)} · {h.how.replace('_', ' ')}{h.roll ? ` (${h.roll})` : ''}</Text>
      ))}
    </View>
  );
}

function TargetGroup({ entity, rules, group, onEntityUpdate }: { entity: Entity; rules: CampaignRules; group: ModeGroup; onEntityUpdate: (e: Entity) => void }) {
  const characters = useCharacterStore(s => s.characters);
  const members = entity.targetModes?.[group.id]?.members ?? {};
  const limit = targetLimit(entity, group);
  const extra = entity.targetModes?.[group.id]?.extraTargets ?? 0;
  const commit = (e: Entity) => { onEntityUpdate(recomputeDerived(e, rules)); syncAllyGrantsInStore([e]); };
  const items = group.options.map(o => ({ id: o.id, label: o.name }));
  const candidates = characters.filter(c => c.kind === 'character');
  const count = Object.keys(members).length;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{group.name.toUpperCase()}</Text>
      <Text style={styles.hint}>
        Up to {limit} targets, each with its own {group.optionLabel.toLowerCase()} — re-pick each turn. Who is in range is table-resolved.
        Ends with the spell. ({count}/{limit} chosen)
      </Text>
      <View style={styles.row}>
        <Text style={styles.hint}>Extra targets from upcasting: {extra}</Text>
        <Pressable style={styles.btnGhost} onPress={() => commit(setExtraTargets(entity, group.id, extra + 1))}><Text style={styles.btnGhostTxt}>+</Text></Pressable>
        <Pressable style={styles.btnGhost} onPress={() => commit(setExtraTargets(entity, group.id, extra - 1))}><Text style={styles.btnGhostTxt}>−</Text></Pressable>
      </View>
      {candidates.length === 0 && <Text style={styles.hint}>No characters on this device to target.</Text>}
      {candidates.map(c => {
        const current = members[c.id];
        return (
          <View key={c.id} style={{ gap: 4 }}>
            <View style={styles.row}>
              <Text style={styles.name}>{c.identity.name || 'Unnamed'}{c.id === entity.id ? ' (you)' : ''}</Text>
              {current && <Pressable onPress={() => commit(removeTargetMode(entity, group.id, c.id))}><Text style={styles.link}>Remove</Text></Pressable>}
            </View>
            <Chips items={items} selected={current} onPick={id => commit(setTargetMode(entity, group.id, c.id, id))} />
          </View>
        );
      })}
    </View>
  );
}

export function ModeGroupPanels({ entity, rules, onEntityUpdate }: { entity: Entity; rules?: CampaignRules; onEntityUpdate?: (e: Entity) => void }) {
  if (!rules || !onEntityUpdate) return null;
  const carriers = listModeGroups(entity);
  if (carriers.length === 0) return null;
  return (
    <>
      {carriers.map(({ group }) => group.scope === 'target'
        ? <TargetGroup key={group.id} entity={entity} rules={rules} group={group} onEntityUpdate={onEntityUpdate} />
        : <SelfGroup key={group.id} entity={entity} rules={rules} group={group} onEntityUpdate={onEntityUpdate} />)}
    </>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 1 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  hint: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16 },
  link: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtOn: { color: Colors.gold, fontWeight: FontWeight.bold },
  input: { flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, padding: Spacing.sm },
  btn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: Spacing.md, alignItems: 'center' },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  btnGhost: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: Spacing.md, alignItems: 'center' },
  btnGhostTxt: { color: Colors.textSecondary, fontSize: FontSize.xs },
});
