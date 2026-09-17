// app/creation/subclass-detail.tsx
// Read-only subclass browser: Features (collapsible descriptions) + Progression
// (level → tappable feature links that jump to the Features tab). Mirrors the
// class-detail browse layers. Subclass selection itself happens through the
// class's subclass-unlock pending choice at the appropriate level, so this
// screen is purely informational — there's no "select" button here.
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSubclassEntryMerged, subclassFeaturesByLevel, subclassProgressionTable } from '../../src/content/subclasses/subclassBrowse';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { NonSrdBadge, isNonSrd } from '../../src/components/NonSrdBadge';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

export default function SubclassDetailScreen() {
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');
  const { classId, subclassId } = useLocalSearchParams<{ classId: string; subclassId: string }>();
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);

  const [browseLayer, setBrowseLayer] = useState<'progression' | 'features'>('features');
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const sub = classId && subclassId ? getSubclassEntryMerged(classId, subclassId, homebrewSubclasses) : null;

  useEffect(() => {
    if (!sub) safeGoBack();
  }, []);

  if (!sub) return null;

  function goToFeature(featureId: string) {
    setExpandedFeature(featureId);
    setBrowseLayer('features');
  }

  const featureRows = subclassFeaturesByLevel(sub.progression);
  const progRows    = subclassProgressionTable(sub.progression);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{sub.name}</Text>
        {!homebrewSubclasses.some(hs => hs.id === sub.id) && isNonSrd(sub.progression.srd) && <NonSrdBadge />}
      </View>
      <Text style={styles.subheading}>
        {sub.classId.charAt(0).toUpperCase() + sub.classId.slice(1)} subclass · unlocks at level {sub.unlockLevel}
      </Text>
      <View style={styles.divider} />

      {/* Layer tabs */}
      <View style={styles.layerTabs}>
        {([
          ['progression', 'Progression'],
          ['features', 'Features'],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.layerTab, browseLayer === key && styles.layerTabActive]}
            onPress={() => setBrowseLayer(key)}
          >
            <Text style={[styles.layerTabTxt, browseLayer === key && styles.layerTabTxtActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Features — collapsible descriptions */}
      {browseLayer === 'features' && (
        featureRows.length === 0 ? (
          <Text style={styles.emptyNote}>No features defined for this subclass yet.</Text>
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {featureRows.map(({ feature, level }) => {
              const open = expandedFeature === feature.id;
              return (
                <View key={feature.id} style={styles.featCard}>
                  <Pressable
                    style={styles.featCardHead}
                    onPress={() => setExpandedFeature(open ? null : feature.id)}
                  >
                    <Text style={styles.featCardName}>{feature.name}</Text>
                    <View style={styles.featLevelBadge}>
                      <Text style={styles.featLevelTxt}>Lv {level}</Text>
                    </View>
                    <Text style={styles.featCaret}>{open ? '▲' : '▼'}</Text>
                  </Pressable>
                  {open && (
                    <>
                      {feature.activation && (
                        <Text style={styles.featTag}>
                          {feature.activation.actionType === 'bonus_action' ? 'Bonus Action'
                            : feature.activation.actionType === 'reaction' ? 'Reaction'
                            : feature.activation.actionType === 'action' ? 'Action'
                            : 'Passive'}
                        </Text>
                      )}
                      <Text style={styles.featDesc}>{feature.description}</Text>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )
      )}

      {/* Progression — level → tappable feature links */}
      {browseLayer === 'progression' && (
        <>
          <Text style={styles.progHint}>Tap a feature to read its description.</Text>
          <View style={styles.progTable}>
            <View style={[styles.progRow, styles.progHeaderRow]}>
              <Text style={[styles.progLevelCell, styles.progHeaderTxt]}>Lv</Text>
              <Text style={[styles.progFeatCell, styles.progHeaderTxt]}>Features</Text>
            </View>
            {progRows.map(row => (
              <View key={row.level} style={styles.progRow}>
                <Text style={styles.progLevelCell}>{row.level}</Text>
                <View style={styles.progFeatCell}>
                  <View style={styles.progFeatWrap}>
                    {row.features.map((f, i) => (
                      <Pressable key={f.id} onPress={() => goToFeature(f.id)}>
                        <Text style={styles.progFeatLink}>
                          {f.name}{i < row.features.length - 1 ? ',' : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={styles.divider} />
      <View style={styles.noteCard}>
        <Text style={styles.noteTxt}>
          You'll choose your subclass during character creation or level-up, when
          your class reaches the level that unlocks it.
        </Text>
      </View>

      <Pressable style={styles.backBtn} onPress={safeGoBack}>
        <Text style={styles.backBtnTxt}>← Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headingRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center' },
  subheading:{ fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  divider:   { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },

  layerTabs: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md },
  layerTab: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  layerTabActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  layerTabTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  layerTabTxtActive: { color: Colors.gold },

  featCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: 4,
  },
  featCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featCardName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold, flex: 1 },
  featCaret: { fontSize: FontSize.xs, color: Colors.textDim, marginLeft: Spacing.sm },
  featLevelBadge: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 1,
  },
  featLevelTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  featTag: { fontSize: FontSize.xs, color: Colors.blue, fontWeight: FontWeight.bold },
  featDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  progTable: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden' },
  progRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, gap: Spacing.sm,
  },
  progHeaderRow: { backgroundColor: Colors.surfaceHigh },
  progHeaderTxt: { color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1 },
  progLevelCell: { width: 28, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  progFeatCell:  { flex: 1 },
  progHint: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic', marginBottom: Spacing.xs },
  progFeatWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  progFeatLink: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },

  noteCard: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  noteTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },

  backBtn: { marginTop: Spacing.lg, alignItems: 'center', paddingVertical: Spacing.sm },
  backBtnTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
