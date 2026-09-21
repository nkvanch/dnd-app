// app/homebrew/import-package.tsx
// HOMEBREW-PACKAGE-1: "Import Homebrew" — pick a .grimoire-pack file, see a
// full preview (metadata, contents, rulesets, dependency/version warnings,
// per-item conflicts) BEFORE anything is committed, resolve any conflicts
// (Keep Local / Replace / Import As Copy, with a bulk "apply to all"), then
// commit. Never mutates the library before the user explicitly confirms —
// same rule app/backup.tsx's own pickAndValidateBackup()/preview flow
// already established for personal backups.
import { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { makeHomebrewLookup } from '../../src/store/homebrewLookup';
import { pickAndValidatePackage, PackageImportPreview } from '../../src/io/packageIO';
import { planPackageImport, ConflictResolution, PackageConflict, flattenPackageContents } from '../../src/engine/packageConflicts';
import { removedPackItemRefs, stillReferencedRefs } from '../../src/engine/packDiagnostics';
import { groupPackContents, PACKAGE_TYPE_LABELS } from '../../src/engine/packageBuilder';
import { recordInstalledPack, loadInstalledPacks, InstalledPack, PackItemRef } from '../../src/db/packRegistryRepo';
import { loadAllEncounters } from '../../src/db/encounterRepo';
import { PreparedEncounter } from '../../src/engine/types';
import { RULESETS } from '../../src/content/rulesets';
import { Alert } from '../../src/utils/alert';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const KNOWN_RULESET_IDS = new Set(Object.keys(RULESETS));

export default function ImportPackageScreen() {
  const safeGoBack = useSafeGoBack('/(tabs)/homebrew');
  const homebrew = useHomebrewStore();
  const saveItems = useHomebrewStore(s => s.saveItems);
  const deleteHomebrewItem = useHomebrewStore(s => s.deleteItem);
  const characters = useCharacterStore(s => s.characters);

  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<PackageImportPreview | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map());
  const [committing, setCommitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  // HOMEBREW-PACKAGE-1 items 33/34: "importing a newer version of an
  // already-installed pack" detection. installedPacks/encounters are loaded
  // once up front so handlePick can check for a packageId match immediately
  // (rather than re-querying SQLite mid-flow); encounters are only needed
  // later, if the user actually chooses Update Pack, for the
  // still-referenced-content check.
  const [installedPacks, setInstalledPacks] = useState<InstalledPack[]>([]);
  const [encounters, setEncounters] = useState<PreparedEncounter[]>([]);
  useEffect(() => {
    loadInstalledPacks().then(setInstalledPacks).catch(e => console.error('[import-package] loadInstalledPacks failed:', e));
    loadAllEncounters().then(setEncounters).catch(e => console.error('[import-package] loadAllEncounters failed:', e));
  }, []);
  // The already-installed pack this import would UPDATE (same packageId),
  // or null for a genuinely new package. Set alongside `preview`, cleared
  // together with it. `updateChoice` gates which UI step is shown —
  // null means "ask the user" (only reachable when updateTarget is set).
  const [updateTarget, setUpdateTarget] = useState<InstalledPack | null>(null);
  const [updateChoice, setUpdateChoice] = useState<'update' | 'copy' | null>(null);

  async function handlePick() {
    setPicking(true);
    setResultMsg(null);
    try {
      const result = await pickAndValidatePackage(
        KNOWN_RULESET_IDS,
        makeHomebrewLookup(homebrew),
      );
      if (result) {
        setPreview(result);
        // Default every conflict to 'keep_local' — the safest default
        // (never silently overwrites existing content) until the player
        // explicitly picks otherwise, matching this feature's own "do not
        // silently overwrite" requirement.
        const initial = new Map<string, ConflictResolution>();
        for (const c of result.conflicts) initial.set(`${c.type}:${c.id}`, 'keep_local');
        setResolutions(initial);
        const match = result.pack.packageId ? installedPacks.find(p => p.id === result.pack.packageId) ?? null : null;
        setUpdateTarget(match);
        setUpdateChoice(match ? null : 'update'); // no real choice to make when there's nothing installed to update
      }
    } catch (e: any) {
      Alert.alert('That file couldn’t be imported', e?.message ?? 'Unknown error.');
    } finally {
      setPicking(false);
    }
  }

  function chooseUpdateMode(mode: 'update' | 'copy') {
    setUpdateChoice(mode);
    if (mode === 'update' && updateTarget && preview) {
      // Item 33/34: an intentional update should default to overwriting
      // THIS pack's own previously-installed content at the same id — the
      // per-item Keep/Replace/Copy dance is for genuinely unrelated
      // packages colliding, not for re-importing a newer version of a pack
      // you already have. Still fully overridable below, per item.
      const ownedKeys = new Set(updateTarget.itemRefs.map(r => `${r.type}:${r.id}`));
      setResolutions(prev => {
        const next = new Map(prev);
        for (const c of preview.conflicts) {
          const key = `${c.type}:${c.id}`;
          if (ownedKeys.has(key)) next.set(key, 'replace');
        }
        return next;
      });
    }
  }

  function setResolution(conflict: PackageConflict, resolution: ConflictResolution) {
    setResolutions(prev => new Map(prev).set(`${conflict.type}:${conflict.id}`, resolution));
  }
  function applyToAll(resolution: ConflictResolution) {
    if (!preview) return;
    const next = new Map<string, ConflictResolution>();
    for (const c of preview.conflicts) next.set(`${c.type}:${c.id}`, resolution);
    setResolutions(next);
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setCommitting(true);
    try {
      const { toSave } = planPackageImport(preview.pack, preview.conflicts, resolutions, preview.identical);
      // Item 33: "Install As Separate Copy" deliberately ignores the
      // incoming package's own packageId and registers under a fresh one —
      // ANY other case (a genuinely new package, or an intentional Update)
      // prefers the package's own packageId (item 15 provenance) so
      // re-importing the same package updates the same installed-pack
      // registration instead of creating an untracked duplicate.
      const packId = updateChoice === 'copy'
        ? `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        : (preview.pack.packageId ?? `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      const packName = preview.pack.name ?? preview.suggestedName;
      const packMeta = { packageVersion: preview.pack.packageVersion, author: preview.pack.author };
      // HOMEBREW-PACKAGE-1 item 14: genuinely ATOMIC — saveItems() wraps
      // every item in ONE SQLite transaction (contentCacheRepo.
      // saveHomebrewContentBatch), so this either fully commits or fully
      // rolls back with nothing partially written. Because of that, the
      // pack is registered ONCE, after every item has actually succeeded —
      // no more need for the previous "register incrementally in case of
      // partial failure" workaround, since partial failure inside the
      // batch can no longer happen (contrast: the plain personal-backup
      // flow in app/backup.tsx still uses the older sequential pattern,
      // since restoring characters+homebrew together isn't in this
      // feature's scope to change).
      await saveItems(toSave.map(entry => ({ type: entry.type, item: entry.item })));

      // Item 34: an Update Pack commit also has to reconcile what the NEW
      // package version dropped. "Removed" is computed against the
      // incoming package's own manifest (preview.pack.contents), not
      // against `toSave` — a Keep-Local resolution means the local edit
      // wins, not that the author removed the content from their package.
      let removalNote = '';
      if (updateChoice === 'update' && updateTarget) {
        const newRefs = (preview.pack.contents ?? flattenPackageContents(preview.pack.homebrew).map(c => ({ type: c.type, id: c.item.id })));
        const removed = removedPackItemRefs(updateTarget.itemRefs, newRefs);
        const kept = stillReferencedRefs(removed, installedPacks, homebrew, characters, encounters);
        const keptKeys = new Set(kept.map(r => `${r.type}:${r.id}`));
        const toDelete = removed.filter(r => !keptKeys.has(`${r.type}:${r.id}`));
        for (const ref of toDelete) await deleteHomebrewItem(ref.type, ref.id);
        if (kept.length > 0) {
          removalNote = ` ${kept.length} item${kept.length === 1 ? '' : 's'} dropped from this pack's new version ${kept.length === 1 ? 'was' : 'were'} kept because still in use.`;
        }
      }

      // Remember which entries the author picked and which were included automatically (from the manifest),
      // so the Packages view can keep telling them apart. Copies carry their original id's role.
      const roleByOriginal = new Map((preview.pack.contents ?? []).map(c => [`${c.type}:${c.id}`, c.included]));
      const itemRefs: PackItemRef[] = toSave.map(entry => {
        const included = roleByOriginal.get(`${entry.type}:${entry.originalId}`);
        return included ? { type: entry.type, id: entry.finalId, included } : { type: entry.type, id: entry.finalId };
      });
      await recordInstalledPack(packId, packName, itemRefs, packMeta);
      const copiedCount = toSave.filter(e => e.resolution === 'copy').length;
      const replacedCount = toSave.filter(e => e.resolution === 'replace').length;
      const keptLocalCount = preview.conflicts.length - copiedCount - replacedCount;
      const identicalCount = preview.identical.length;
      setResultMsg(
        `Imported ${toSave.length} item${toSave.length === 1 ? '' : 's'}` +
        (copiedCount > 0 ? `, ${copiedCount} as new copies` : '') +
        (replacedCount > 0 ? `, ${replacedCount} replaced` : '') +
        (keptLocalCount > 0 ? `, ${keptLocalCount} kept local (skipped)` : '') +
        (identicalCount > 0 ? `, ${identicalCount} already installed (skipped)` : '') + '.' + removalNote
      );
      setPreview(null);
      setResolutions(new Map());
      setUpdateTarget(null);
      setUpdateChoice(null);
      loadInstalledPacks().then(setInstalledPacks).catch(() => {});
    } catch (e: any) {
      // Atomic: a thrown error here means NOTHING was written — the
      // transaction rolled back, and recordInstalledPack (which only runs
      // after saveItems resolves) never ran either. The local library is
      // exactly as it was before this import was attempted.
      Alert.alert('Import failed — nothing was changed', e?.message ?? 'The package could not be imported. Your existing homebrew library is untouched.');
    } finally {
      setCommitting(false);
    }
  }

  function cancelImport() {
    setPreview(null);
    setResolutions(new Map());
    setUpdateTarget(null);
    setUpdateChoice(null);
  }

  const previewGroups = useMemo(() => groupPackContents(preview?.pack ?? {}), [preview]);
  const unsupportedRulesetIssues = preview?.validation.issues.filter(i => i.code === 'package_unsupported_ruleset') ?? [];
  const missingDependencyIssues = preview?.validation.issues.filter(i => i.code === 'package_missing_dependency') ?? [];
  const allResolved = preview ? preview.conflicts.every(c => resolutions.has(`${c.type}:${c.id}`)) : true;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={safeGoBack}><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.title}>Import Homebrew</Text>
        <View style={{ width: 60 }} />
      </View>

      {!preview && (
        <View style={styles.section}>
          <Text style={styles.body}>
            Pick a .grimoire-pack file exported from another device (or another
            player). You'll see everything it contains, its ruleset(s), and any
            conflicts with content you already have — before anything is added.
          </Text>
          <Pressable style={[styles.actionBtn, picking && styles.btnDisabled]} onPress={() => { void handlePick(); }} disabled={picking}>
            {picking ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.actionBtnTxt}>Choose Package File…</Text>}
          </Pressable>
          {resultMsg && (
            <View style={styles.resultBox}><Text style={styles.resultTxt}>✓ {resultMsg}</Text></View>
          )}
        </View>
      )}

      {preview && updateTarget && updateChoice === null && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⬆️ UPDATE AVAILABLE</Text>
          <Text style={styles.body}>
            "{updateTarget.name}" is already installed
            {updateTarget.packageVersion ? ` (v${updateTarget.packageVersion})` : ''}. You're importing
            {preview.pack.packageVersion ? ` v${preview.pack.packageVersion}` : ' a version'} of the same package.
          </Text>
          <View style={styles.btnRow}>
            <Pressable style={styles.cancelBtn} onPress={cancelImport}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.updateSecondaryBtn} onPress={() => chooseUpdateMode('copy')}>
              <Text style={styles.updateSecondaryTxt}>Install As Separate Copy</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={() => chooseUpdateMode('update')}>
              <Text style={styles.confirmTxt}>Update Pack</Text>
            </Pressable>
          </View>
        </View>
      )}

      {preview && updateChoice !== null && (
        <>
          <View style={styles.section}>
            {updateChoice === 'update' && (
              <Text style={styles.pkgMeta}>Updating installed pack "{updateTarget?.name}"</Text>
            )}
            <Text style={styles.pkgName}>{preview.pack.name ?? preview.suggestedName}</Text>
            {preview.pack.packageVersion && <Text style={styles.pkgMeta}>Version {preview.pack.packageVersion}</Text>}
            {preview.pack.author && <Text style={styles.pkgMeta}>By {preview.pack.author}</Text>}
            {preview.pack.description && <Text style={styles.pkgDesc}>{preview.pack.description}</Text>}
            {preview.pack.compatibleRulesets && preview.pack.compatibleRulesets.length > 0 && (
              <Text style={styles.pkgMeta}>Rulesets: {preview.pack.compatibleRulesets.join(', ')}</Text>
            )}
          </View>

          <View style={styles.section} testID="import-preview-contents">
            <Text style={styles.sectionTitle}>CONTENT ({previewGroups.counts.content})</Text>
            {previewGroups.counts.total === 0 ? (
              <Text style={styles.body}>{countTotal(preview)} homebrew item{countTotal(preview) === 1 ? '' : 's'}.</Text>
            ) : (
              previewGroups.content.map(g => (
                <View key={g.type}>
                  <Text style={styles.groupTitle}>{PACKAGE_TYPE_LABELS[g.type][g.entries.length === 1 ? 0 : 1]}</Text>
                  {g.entries.map(e => <Text key={`${e.type}:${e.id}`} style={styles.body}>• {e.name}</Text>)}
                </View>
              ))
            )}
            {previewGroups.counts.dependencies > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: Spacing.sm }]}>DEPENDENCIES ({previewGroups.counts.dependencies}) · INCLUDED AUTOMATICALLY</Text>
                {previewGroups.dependencies.map(g => (
                  <View key={g.type}>
                    <Text style={styles.groupTitle}>{PACKAGE_TYPE_LABELS[g.type][g.entries.length === 1 ? 0 : 1]}</Text>
                    {g.entries.map(e => <Text key={`${e.type}:${e.id}`} style={styles.body}>🔗 {e.name}</Text>)}
                  </View>
                ))}
              </>
            )}
          </View>

          {unsupportedRulesetIssues.length > 0 && (
            <View style={styles.warnSection}>
              <Text style={styles.warnTitle}>⚠️ Unsupported Rulesets</Text>
              {unsupportedRulesetIssues.map((i, idx) => <Text key={idx} style={styles.warnTxt}>{i.message}</Text>)}
            </View>
          )}
          {missingDependencyIssues.length > 0 && (
            <View style={styles.warnSection}>
              <Text style={styles.warnTitle}>⚠️ Possibly Missing Dependencies</Text>
              {missingDependencyIssues.map((i, idx) => <Text key={idx} style={styles.warnTxt}>{i.message}</Text>)}
            </View>
          )}

          {preview.identical.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ALREADY INSTALLED — IDENTICAL ({preview.identical.length})</Text>
              <Text style={styles.body}>
                These are already on this device with no differences — they'll be skipped automatically, no choice needed.
              </Text>
              {preview.identical.map(c => (
                <Text key={`${c.type}:${c.id}`} style={styles.body}>• {c.id} <Text style={styles.conflictType}>({c.type})</Text></Text>
              ))}
            </View>
          )}

          {preview.conflicts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CONFLICTS ({preview.conflicts.length})</Text>
              <Text style={styles.body}>
                These already exist on this device. Choose what to do with each — nothing is overwritten silently.
              </Text>
              <View style={styles.bulkRow}>
                <Text style={styles.bulkLabel}>Apply to all:</Text>
                <Pressable style={styles.bulkBtn} onPress={() => applyToAll('keep_local')}><Text style={styles.bulkBtnTxt}>Keep Local</Text></Pressable>
                <Pressable style={styles.bulkBtn} onPress={() => applyToAll('replace')}><Text style={styles.bulkBtnTxt}>Replace</Text></Pressable>
                <Pressable style={styles.bulkBtn} onPress={() => applyToAll('copy')}><Text style={styles.bulkBtnTxt}>Copy</Text></Pressable>
              </View>
              {preview.conflicts.map(c => {
                const key = `${c.type}:${c.id}`;
                const current = resolutions.get(key) ?? 'keep_local';
                return (
                  <View key={key} style={styles.conflictRow}>
                    <Text style={styles.conflictTitle}>{c.id} <Text style={styles.conflictType}>({c.type})</Text></Text>
                    <Text style={styles.conflictDetail}>Local: "{c.localName}"  →  Incoming: "{c.incomingName}"</Text>
                    <View style={styles.conflictBtnRow}>
                      {(['keep_local', 'replace', 'copy'] as ConflictResolution[]).map(r => (
                        <Pressable
                          key={r}
                          style={[styles.conflictBtn, current === r && styles.conflictBtnActive]}
                          onPress={() => setResolution(c, r)}
                        >
                          <Text style={[styles.conflictBtnTxt, current === r && styles.conflictBtnTxtActive]}>
                            {r === 'keep_local' ? 'Keep Local' : r === 'replace' ? 'Replace' : 'Import As Copy'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.btnRow}>
            <Pressable style={styles.cancelBtn} onPress={cancelImport} disabled={committing}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, (!allResolved || committing) && styles.btnDisabled]}
              disabled={!allResolved || committing}
              onPress={() => { void handleConfirmImport(); }}
            >
              {committing ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.confirmTxt} testID="import-confirm">{updateChoice === 'update' ? 'Update' : previewGroups.counts.total > 1 ? 'Import All' : 'Import'}</Text>}
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function countTotal(preview: PackageImportPreview): number {
  const hb = preview.pack.homebrew;
  if (!hb) return 0;
  return Object.values(hb).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.xl + 8 },
  back: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.xs,
  },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1 },
  groupTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDim, marginTop: Spacing.xs },
  body: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },

  pkgName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  pkgMeta: { fontSize: FontSize.xs, color: Colors.textSecondary },
  pkgDesc: { fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: Spacing.xs },

  warnSection: {
    backgroundColor: Colors.red + '15', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.red + '55',
    padding: Spacing.md, gap: 4,
  },
  warnTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.red },
  warnTxt: { fontSize: FontSize.xs, color: Colors.red, lineHeight: 16 },

  bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs, flexWrap: 'wrap' },
  bulkLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  bulkBtn: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  bulkBtnTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },

  conflictRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.sm, gap: 4 },
  conflictTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  conflictType: { color: Colors.textDim, fontWeight: FontWeight.normal },
  conflictDetail: { fontSize: FontSize.xs, color: Colors.textSecondary },
  conflictBtnRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 4, flexWrap: 'wrap' },
  conflictBtn: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  conflictBtnActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  conflictBtnTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  conflictBtnTxtActive: { color: Colors.gold },

  actionBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  actionBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  btnDisabled: { opacity: 0.5 },
  resultBox: { backgroundColor: Colors.green + '15', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.green + '55', padding: Spacing.sm },
  resultTxt: { color: Colors.green, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  confirmBtn: { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  updateSecondaryBtn: { flex: 2, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66', paddingVertical: Spacing.sm, alignItems: 'center' },
  updateSecondaryTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.xs },
});
