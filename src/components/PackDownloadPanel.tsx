// src/components/PackDownloadPanel.tsx
// Download a content pack from a link, or from a catalog of packs a publisher hosts (content/packDownload.ts). It only fetches the
// file and hands its text to the import screen, which validates it and asks the player to confirm exactly as for a file picked from
// the device, so a download is never installed by this panel.
import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { downloadText, parseCatalog, catalogStatus, checkPackUrl, CatalogStatus } from '../content/packDownload';
import { installedOfficialPacks } from '../content/officialPackService';
import { getMeta, setMeta } from '../db/appMetaRepo';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

const CATALOG_KEY = 'pack_catalog_url';

export function PackDownloadPanel({ onDownloaded, disabled }: { onDownloaded: (text: string, name: string | null) => Promise<void>; disabled?: boolean }) {
  const [url, setUrl] = useState('');
  const [catalogUrl, setCatalogUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [entries, setEntries] = useState<CatalogStatus[] | null>(null);

  useEffect(() => { void getMeta(CATALOG_KEY).then(v => { if (v) setCatalogUrl(v); }).catch(() => undefined); }, []);

  async function run<T>(label: string, work: () => Promise<T>): Promise<T | undefined> {
    setBusy(label); setMessage(null);
    try { return await work(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'The download failed.'); return undefined; }
    finally { setBusy(null); }
  }

  const fileName = (u: string) => decodeURIComponent(u.split('?')[0].split('/').pop() ?? '') || null;

  async function downloadOne(link: string, sha256?: string) {
    await run(link, async () => {
      const text = await downloadText(link, sha256 ? { expectedSha256: sha256 } : {});
      await onDownloaded(text, fileName(link));
    });
  }

  async function checkCatalog() {
    const found = await run('catalog', async () => {
      const text = await downloadText(catalogUrl);
      await setMeta(CATALOG_KEY, catalogUrl.trim());
      const catalog = parseCatalog(text, catalogUrl.trim());
      return catalogStatus(catalog, installedOfficialPacks().map(p => ({ id: p.manifest.id, version: p.manifest.version })));
    });
    if (found) { setEntries(found); if (found.length === 0) setMessage('That catalog lists no packs.'); }
  }

  const urlProblem = url.trim() ? checkPackUrl(url) : null;
  const catalogProblem = catalogUrl.trim() ? checkPackUrl(catalogUrl) : null;
  return (
    <View style={styles.box} testID="pack-download-panel">
      <Text style={styles.title}>DOWNLOAD A PACK</Text>
      <Text style={styles.body}>Paste a link to a pack file. It is checked and shown to you before anything is installed.</Text>
      <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="https://…/pack.grimoire-pack" placeholderTextColor={Colors.textDim}
        autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="pack-download-url" />
      {urlProblem && <Text style={styles.problem}>{urlProblem}</Text>}
      <Pressable style={[styles.btn, (!url.trim() || !!urlProblem || !!busy || disabled) && styles.off]} disabled={!url.trim() || !!urlProblem || !!busy || disabled}
        onPress={() => { void downloadOne(url); }} testID="pack-download-go">
        {busy === url ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnTxt}>Download</Text>}
      </Pressable>

      <Text style={[styles.title, { marginTop: Spacing.sm }]}>PACK CATALOG</Text>
      <Text style={styles.body}>A catalog is a list of packs a publisher hosts. Check it to see what is new and what has an update.</Text>
      <TextInput style={styles.input} value={catalogUrl} onChangeText={setCatalogUrl} placeholder="https://…/grimoire-packs.json" placeholderTextColor={Colors.textDim}
        autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="pack-catalog-url" />
      {catalogProblem && <Text style={styles.problem}>{catalogProblem}</Text>}
      <Pressable style={[styles.btnAlt, (!catalogUrl.trim() || !!catalogProblem || !!busy || disabled) && styles.off]} disabled={!catalogUrl.trim() || !!catalogProblem || !!busy || disabled}
        onPress={() => { void checkCatalog(); }} testID="pack-catalog-check">
        {busy === 'catalog' ? <ActivityIndicator color={Colors.gold} /> : <Text style={styles.btnAltTxt}>Check for packs and updates</Text>}
      </Pressable>
      {message && <Text style={styles.problem} testID="pack-download-message">{message}</Text>}
      {entries?.map(e => (
        <View key={`${e.id}@${e.version}`} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{e.name} <Text style={styles.ver}>v{e.version}</Text></Text>
            <Text style={styles.meta}>{e.status === 'new' ? 'Not installed' : e.status === 'update' ? 'Update available' : 'Up to date'} · {Math.round(e.size / 1024)} KB</Text>
          </View>
          {e.status !== 'installed' && (
            <Pressable style={[styles.get, !!busy && styles.off]} disabled={!!busy || disabled} onPress={() => { void downloadOne(e.url, e.sha256); }} testID={`pack-get-${e.id}`}>
              <Text style={styles.getTxt}>{e.status === 'update' ? 'Update' : 'Get'}</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.xs },
  title: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1 },
  body: { fontSize: FontSize.sm, color: Colors.textSecondary },
  input: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, padding: Spacing.sm },
  problem: { fontSize: FontSize.sm, color: Colors.red },
  btn: { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  btnAlt: { borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '88', padding: Spacing.sm, alignItems: 'center' },
  btnAltTxt: { color: Colors.gold, fontWeight: FontWeight.bold },
  off: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xs },
  name: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  ver: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.normal },
  meta: { fontSize: FontSize.xs, color: Colors.textDim },
  get: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  getTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
});
