// src/components/sheet/GrantFeatureModal.tsx
// "Grant a reward feature" (DM, mid-campaign): attach a stored homebrew
// Feature — or a quick inline one (max-HP / initiative bonus + an optional
// limited-use pool) — to this character under a lineage + tier. Granting a
// lineage that is already active REPLACES it and keeps both rows in the
// ledger (see src/engine/featureGrants.ts). Also renders that ledger.
import { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Entity, CampaignRules, Feature, ResourceGrant } from '../../engine/types';
import { grantFeatureBundle, revokeFeatureGrant, activeGrantFor, FeatureGrantDef } from '../../engine/featureGrants';
import { useHomebrewStore } from '../../store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'reward';
const RECHARGES = [['long_rest', 'Long rest'], ['short_rest', 'Short rest'], ['dawn', 'Dawn'], ['never', 'Never']] as const;

export function FeatureGrantLedger({ entity, rules, onEntityUpdate }: { entity: Entity; rules?: CampaignRules; onEntityUpdate?: (e: Entity) => void }) {
  const rows = entity.featureGrants ?? [];
  if (rows.length === 0) return null;
  const lineages = Array.from(new Set(rows.map(r => r.lineageId)));
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>GRANTED REWARDS</Text>
      {lineages.map(lid => {
        const hist = rows.filter(r => r.lineageId === lid);
        return (
          <View key={lid} style={{ gap: 2 }}>
            <Text style={styles.name}>{hist[hist.length - 1].label}</Text>
            {hist.map(h => (
              <View key={h.id} style={styles.histRow}>
                <Text style={[styles.hint, h.status !== 'active' && styles.dim]}>
                  {h.tier ? `Tier ${h.tier} · ` : ''}{h.status === 'active' ? 'active' : h.status} · granted {h.grantedAt.slice(0, 10)} by {h.grantedBy}
                  {h.replacedAt ? ` · ${h.status} ${h.replacedAt.slice(0, 10)}` : ''}{h.note ? ` — ${h.note}` : ''}
                </Text>
                {h.status === 'active' && rules && onEntityUpdate && (
                  <Pressable onPress={() => onEntityUpdate(revokeFeatureGrant(entity, h.id, rules))}><Text style={styles.revoke}>Revoke</Text></Pressable>
                )}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function GrantFeatureModal({ visible, entity, rules, onConfirm, onCancel }: {
  visible: boolean; entity: Entity; rules: CampaignRules; onConfirm: (e: Entity) => void; onCancel: () => void;
}) {
  const library = useHomebrewStore(s => s.features);
  const [libraryId, setLibraryId] = useState<string | null>(null);
  const [lineage, setLineage] = useState('');
  const [tier, setTier] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [maxHp, setMaxHp] = useState('');
  const [init, setInit] = useState('');
  const [poolName, setPoolName] = useState('');
  const [poolMax, setPoolMax] = useState('');
  const [poolRecharge, setPoolRecharge] = useState<string>('long_rest');
  const [note, setNote] = useState('');

  const lineageId = slug(lineage || name);
  const replacing = lineage.trim() ? activeGrantFor(entity, lineageId) : undefined;
  const picked = library.find(f => f.id === libraryId);
  const canConfirm = !!(picked || name.trim()) && (!!lineage.trim() || !!name.trim());

  function build(): FeatureGrantDef {
    const t = parseInt(tier, 10);
    const tierNum = Number.isFinite(t) ? t : undefined;
    const label = lineage.trim() || picked?.name || name.trim();
    const featureBase = picked ?? (() => {
      const effects: Feature['effects'] = [];
      const hp = parseInt(maxHp, 10), ini = parseInt(init, 10);
      if (hp) effects.push({ type: 'stat_modifier', target: 'max_hp', operation: 'add', value: hp, condition: null });
      if (ini) effects.push({ type: 'stat_modifier', target: 'initiative', operation: 'add', value: ini, condition: null });
      return { id: `${lineageId}_t${tierNum ?? 1}`, name: name.trim(), description: desc.trim() || name.trim(),
        source: { kind: 'manual', refId: lineageId }, level: null, effects, actions: [], choices: [], passive: true } as Feature;
    })();
    const pm = parseInt(poolMax, 10);
    const resources: ResourceGrant[] = !picked && poolName.trim() && pm > 0
      ? [{ resourceId: `${lineageId}_pool`, name: poolName.trim(), maximum: pm, recharge: poolRecharge }] : [];
    return { lineageId, label, tier: tierNum, features: [featureBase], resources, note: note.trim() || undefined };
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <ScrollView style={styles.root} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}>
        <Text style={styles.title}>GRANT A REWARD FEATURE</Text>
        <Text style={styles.hint}>
          Attach a feature to this character outside of level-up. Give it a reward name and a tier; granting the same reward name again
          REPLACES the active tier (bonuses do not stack) and keeps the earlier tier in the history.
        </Text>

        <Text style={styles.label}>Reward name (the lineage) *</Text>
        <TextInput style={styles.input} value={lineage} onChangeText={setLineage} placeholder="e.g. Weight of Authority" placeholderTextColor={Colors.textDim} />
        <Text style={styles.label}>Tier (optional)</Text>
        <TextInput style={styles.input} value={tier} onChangeText={setTier} keyboardType="numeric" placeholder="1" placeholderTextColor={Colors.textDim} />
        {replacing && <Text style={styles.warn}>This will replace the active {replacing.tier ? `Tier ${replacing.tier}` : 'grant'} — its bonuses and pool are removed first (spent uses stay spent). History is kept.</Text>}

        {library.length > 0 && (
          <>
            <Text style={styles.label}>Use a stored homebrew feature</Text>
            <View style={styles.chips}>
              {library.map(f => (
                <Pressable key={f.id} style={[styles.chip, libraryId === f.id && styles.chipOn]} onPress={() => setLibraryId(libraryId === f.id ? null : f.id)}>
                  <Text style={[styles.chipTxt, libraryId === f.id && styles.chipTxtOn]}>{f.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {!picked && (
          <>
            <Text style={styles.label}>…or write one here: feature name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={Colors.textDim} />
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { minHeight: 70 }]} value={desc} onChangeText={setDesc} multiline textAlignVertical="top" placeholderTextColor={Colors.textDim} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Max HP bonus</Text><TextInput style={styles.input} value={maxHp} onChangeText={setMaxHp} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Initiative bonus</Text><TextInput style={styles.input} value={init} onChangeText={setInit} keyboardType="numeric" /></View>
            </View>
            <Text style={styles.label}>Limited-use pool (optional)</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 2 }]} value={poolName} onChangeText={setPoolName} placeholder="Pool name" placeholderTextColor={Colors.textDim} />
              <TextInput style={[styles.input, { flex: 1 }]} value={poolMax} onChangeText={setPoolMax} keyboardType="numeric" placeholder="Uses" placeholderTextColor={Colors.textDim} />
            </View>
            <View style={styles.chips}>
              {RECHARGES.map(([k, l]) => (
                <Pressable key={k} style={[styles.chip, poolRecharge === k && styles.chipOn]} onPress={() => setPoolRecharge(k)}>
                  <Text style={[styles.chipTxt, poolRecharge === k && styles.chipTxtOn]}>{l}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>Bonuses beyond these (ally-facing effects, spells, etc.) come from a stored homebrew feature picked above.</Text>
          </>
        )}

        <Text style={styles.label}>Note / reason (kept in the history)</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholderTextColor={Colors.textDim} />

        <View style={styles.row}>
          <Pressable style={[styles.btnGhost, { flex: 1 }]} onPress={onCancel}><Text style={styles.btnGhostTxt}>Cancel</Text></Pressable>
          <Pressable style={[styles.btn, { flex: 1 }, !canConfirm && { opacity: 0.4 }]} disabled={!canConfirm}
            onPress={() => onConfirm(grantFeatureBundle(entity, build(), rules))}>
            <Text style={styles.btnTxt}>{replacing ? 'Replace & Grant' : 'Grant'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  panel: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 1 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  hint: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16 },
  dim: { opacity: 0.6 },
  warn: { fontSize: FontSize.xs, color: Colors.gold, lineHeight: 16 },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, padding: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  revoke: { color: Colors.red, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtOn: { color: Colors.gold, fontWeight: FontWeight.bold },
  btn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  btnGhost: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  btnGhostTxt: { color: Colors.textSecondary },
});
