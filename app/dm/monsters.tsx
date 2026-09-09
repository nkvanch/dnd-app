// app/dm/monsters.tsx
// Monster library — browse SRD monsters, preview stat blocks, spawn into encounter.
import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCombatStore }   from '../../src/store/combatStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { spawnMonster }     from '../../src/engine/monsterFactory';
import { MonsterTemplate }  from '../../src/content/monsters/types';
import { mergeMonsterIndex } from '../../src/content/contentResolution';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

function crLabel(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25)  return '1/4';
  if (cr === 0.5)   return '1/2';
  return String(cr);
}

// ── Monster preview modal ─────────────────────────────────────────────────────

function MonsterPreview({ template, onSpawn, onClose }: {
  template: MonsterTemplate;
  onSpawn: () => void;
  onClose: () => void;
}) {
  const ABILITIES = ['str','dex','con','int','wis','cha'] as const;
  const modStr = (score: number) => {
    const m = Math.floor((score - 10) / 2);
    return `${score} (${m >= 0 ? '+' : ''}${m})`;
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.previewSheet} onPress={e => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <Text style={styles.monsterName}>{template.name}</Text>
            <Text style={styles.monsterType}>
              {template.size} {template.type}, {template.alignment}
            </Text>

            <View style={styles.divider} />

            {/* Core stats */}
            <Text style={styles.statLine}><Text style={styles.statKey}>AC:</Text> {template.ac.value} ({template.ac.source})</Text>
            <Text style={styles.statLine}><Text style={styles.statKey}>HP:</Text> {template.hp.average} ({template.hp.dice})</Text>
            <Text style={styles.statLine}><Text style={styles.statKey}>Speed:</Text> {template.speed} ft</Text>
            <Text style={styles.statLine}><Text style={styles.statKey}>CR:</Text> {crLabel(template.cr)}</Text>

            <View style={styles.divider} />

            {/* Ability scores */}
            <View style={styles.abilityRow}>
              {ABILITIES.map(a => (
                <View key={a} style={styles.abilityBox}>
                  <Text style={styles.abilityLabel}>{a.toUpperCase()}</Text>
                  <Text style={styles.abilityVal}>{modStr(template.stats[a])}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Senses / Languages */}
            {template.senses.length > 0 && (
              <Text style={styles.statLine}><Text style={styles.statKey}>Senses:</Text> {template.senses.join(', ')}</Text>
            )}
            {template.languages.length > 0 && (
              <Text style={styles.statLine}><Text style={styles.statKey}>Languages:</Text> {template.languages.join(', ')}</Text>
            )}

            {/* Features */}
            {template.features.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.featuresTitle}>ACTIONS & TRAITS</Text>
                {template.features.map(f => (
                  <View key={f.id} style={styles.featureBlock}>
                    <Text style={styles.featureName}>{f.name}.</Text>
                    <Text style={styles.featureDesc}> {f.description}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          <Pressable style={styles.spawnBtn} onPress={onSpawn}>
            <Text style={styles.spawnBtnTxt}>⚔️ Spawn in Encounter</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Monsters Screen ───────────────────────────────────────────────────────────

export default function MonstersScreen() {
  const router       = useRouter();
  const safeGoBack   = useSafeGoBack('/(tabs)');
  const rules        = useCharacterStore(s => s.rules);
  const addEntity    = useCombatStore(s => s.updateEntity);
  const inCombat     = useCombatStore(s => s.combat.active);

  const [search,   setSearch]   = useState('');
  const [crMin,    setCrMin]    = useState('');
  const [crMax,    setCrMax]    = useState('');
  const [preview,  setPreview]  = useState<MonsterTemplate | null>(null);

  const homebrewMonsters = useHomebrewStore(s => s.monsters);
  // mergeMonsterIndex dedups by id, homebrew wins — extracted to
  // contentResolution.ts once a second consumer needed it (preparedEncounter.ts).
  const allTemplates = useMemo(() => mergeMonsterIndex(homebrewMonsters), [homebrewMonsters]);

  const filtered = useMemo(() => {
    return allTemplates.filter(t => {
      const matchName = t.name.toLowerCase().includes(search.toLowerCase()) ||
                        t.type.toLowerCase().includes(search.toLowerCase());
      const min = parseFloat(crMin);
      const max = parseFloat(crMax);
      const matchCr = (isNaN(min) || t.cr >= min) && (isNaN(max) || t.cr <= max);
      return matchName && matchCr;
    });
  }, [allTemplates, search, crMin, crMax]);

  function handleSpawn(template: MonsterTemplate) {
    const monster = spawnMonster(template, rules);
    // Add to combat entities
    useCombatStore.setState(s => ({
      entities: s.entities.some(e => e.id === monster.id)
        ? s.entities
        : [...s.entities, monster],
    }));
    setPreview(null);
    if (inCombat) {
      safeGoBack();
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Monster Library</Text>
      </View>

      {/* Filter row */}
      <View style={styles.filters}>
        <TextInput
          style={[styles.filterInput, { flex: 2 }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or type…"
          placeholderTextColor={Colors.textDim}
        />
        <TextInput
          style={styles.filterInput}
          value={crMin}
          onChangeText={setCrMin}
          placeholder="CR min"
          placeholderTextColor={Colors.textDim}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={styles.filterInput}
          value={crMax}
          onChangeText={setCrMax}
          placeholder="CR max"
          placeholderTextColor={Colors.textDim}
          keyboardType="decimal-pad"
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {filtered.map(t => (
          <Pressable key={t.id} style={styles.monsterRow} onPress={() => setPreview(t)}>
            <View>
              <Text style={styles.rowName}>{t.name}</Text>
              <Text style={styles.rowType}>{t.size} {t.type}</Text>
            </View>
            <View style={styles.rowRight}>
              <View style={styles.crBadge}>
                <Text style={styles.crTxt}>CR {crLabel(t.cr)}</Text>
              </View>
              <Text style={styles.hpTxt}>{t.hp.average} HP</Text>
            </View>
          </Pressable>
        ))}
        {filtered.length === 0 && (
          <Text style={styles.emptyTxt}>No monsters match your filters.</Text>
        )}
      </ScrollView>

      {preview && (
        <MonsterPreview
          template={preview}
          onSpawn={() => handleSpawn(preview)}
          onClose={() => setPreview(null)}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.surfaceHigh,
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  filters: { flexDirection: 'row', gap: Spacing.xs, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh },
  filterInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.sm,
  },

  scroll:  { flex: 1 },
  content: { padding: Spacing.sm, gap: Spacing.xs, paddingBottom: Spacing.xxl },

  monsterRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  rowName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowType:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  rowRight:  { alignItems: 'flex-end', gap: 4 },
  crBadge: {
    backgroundColor: Colors.red + '33', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.red + '66',
  },
  crTxt:    { fontSize: FontSize.xs, color: Colors.red, fontWeight: FontWeight.bold },
  hpTxt:    { fontSize: FontSize.xs, color: Colors.textDim },
  emptyTxt: { color: Colors.textDim, textAlign: 'center', padding: Spacing.xl },

  // Preview modal
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  previewSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, maxHeight: '80%',
  },
  monsterName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  monsterType: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  statLine:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  statKey:     { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  abilityRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  abilityBox:  { alignItems: 'center' },
  abilityLabel:{ fontSize: FontSize.xs, color: Colors.textSecondary },
  abilityVal:  { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  featuresTitle:{ fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2, marginBottom: Spacing.xs },
  featureBlock: { marginBottom: Spacing.xs },
  featureName:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featureDesc:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  spawnBtn: {
    backgroundColor: Colors.red, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  spawnBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  closeBtn:    { alignItems: 'center', padding: Spacing.sm },
  closeTxt:    { color: Colors.textSecondary, fontSize: FontSize.md },
});
