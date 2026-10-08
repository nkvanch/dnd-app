// app/dm/encounters.tsx
// Encounter Library — persistent DM-authored PreparedEncounter records.
// Create/edit/duplicate/delete/archive/search/filter, optionally associated
// with a campaign. Deliberately separate from the live combat screen
// (app/dm/encounter.tsx), which owns runtime ActiveEncounter state — see
// PreparedEncounter's own doc comment in engine/types.ts.
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Alert } from '../../src/utils/alert';
import { useEncounterStore } from '../../src/store/encounterStore';
import { useCampaignStore } from '../../src/store/campaignStore';
import { PreparedEncounter, EncounterStatus } from '../../src/engine/types';
import { activeSession } from '../../src/engine/session';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const STATUS_FILTERS: { id: EncounterStatus | 'all'; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'draft',     label: 'Draft' },
  { id: 'ready',     label: 'Ready' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived',  label: 'Archived' },
];

const STATUS_COLOR: Record<EncounterStatus, string> = {
  draft: Colors.textDim, ready: Colors.green, completed: Colors.gold, archived: Colors.textDim,
};

function EncounterCard({ encounter, onOpen, onStart, onDuplicate, onArchiveToggle, onDelete }: {
  encounter: PreparedEncounter;
  onOpen: () => void;
  onStart: () => void;
  onDuplicate: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const combatantCount = encounter.combatants.reduce((sum, c) => sum + Math.max(1, c.quantity), 0);
  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>{encounter.name || 'Untitled Encounter'}</Text>
        <View style={[styles.statusChip, { borderColor: STATUS_COLOR[encounter.status] }]}>
          <Text style={[styles.statusChipTxt, { color: STATUS_COLOR[encounter.status] }]}>
            {encounter.status}
          </Text>
        </View>
      </View>
      {!!encounter.description && (
        <Text style={styles.cardDesc} numberOfLines={2}>{encounter.description}</Text>
      )}
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMeta}>
          {combatantCount} combatant{combatantCount !== 1 ? 's' : ''}
          {encounter.waves.length > 0 ? ` · ${encounter.waves.length} wave${encounter.waves.length !== 1 ? 's' : ''}` : ''}
        </Text>
        {encounter.location ? <Text style={styles.cardMeta}> · {encounter.location}</Text> : null}
      </View>
      {encounter.tags.length > 0 && (
        <View style={styles.tagRow}>
          {encounter.tags.map(t => (
            <View key={t} style={styles.tag}><Text style={styles.tagTxt}>{t}</Text></View>
          ))}
        </View>
      )}
      <View style={styles.cardActions}>
        <Pressable style={styles.cardActionBtn} onPress={onStart} hitSlop={6}>
          <Text style={[styles.cardActionTxt, { color: Colors.gold }]}>▶ Start</Text>
        </Pressable>
        <Pressable style={styles.cardActionBtn} onPress={onDuplicate} hitSlop={6}>
          <Text style={styles.cardActionTxt}>⧉ Duplicate</Text>
        </Pressable>
        <Pressable style={styles.cardActionBtn} onPress={onArchiveToggle} hitSlop={6}>
          <Text style={styles.cardActionTxt}>{encounter.status === 'archived' ? '↩ Unarchive' : '🗄 Archive'}</Text>
        </Pressable>
        <Pressable style={styles.cardActionBtn} onPress={onDelete} hitSlop={6}>
          <Text style={[styles.cardActionTxt, { color: Colors.red }]}>🗑 Delete</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function EncounterLibraryScreen() {
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/dm/dashboard');
  const encounters = useEncounterStore(s => s.encounters);
  const createEncounter = useEncounterStore(s => s.createEncounter);
  const duplicateEncounter = useEncounterStore(s => s.duplicateEncounter);
  const setStatus = useEncounterStore(s => s.setEncounterStatus);
  const deleteEncounter = useEncounterStore(s => s.deleteEncounterPermanently);
  const activeCampaign = useCampaignStore(s => s.activeCampaign);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EncounterStatus | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return encounters.filter(e => {
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchesSearch = !q
        || e.name.toLowerCase().includes(q)
        || (e.description ?? '').toLowerCase().includes(q)
        || e.tags.some(t => t.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [encounters, search, statusFilter]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const session = activeCampaign ? activeSession(activeCampaign) : null;
    const encounter = await createEncounter(trimmed, activeCampaign?.id, session?.id);
    setNewName(''); setCreating(false);
    router.push({ pathname: '/dm/encounter-builder', params: { id: encounter.id } } as any);
  }

  function confirmDelete(encounter: PreparedEncounter) {
    Alert.alert('Delete Encounter', `Permanently delete "${encounter.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void deleteEncounter(encounter.id); } },
    ]);
  }

  return (
    <View style={styles.screen}>
      {/* ENCOUNTER-LIB-HEADER-1: "+ New Encounter" used to be its own
          full-width block below the toolbar (header + toolbar + newBtn
          stacked to ~184px before any card rendered). Folding it into the
          header's own right-side slot (previously an empty spacer) removes
          that whole block in the normal (non-creating) state — same
          legible header, no typography changes, less dead space above the
          list. */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Encounter Library</Text>
        {creating
          ? <View style={{ width: 60 }} />
          : (
            <Pressable style={styles.newBtnCompact} onPress={() => setCreating(true)}>
              <Text style={styles.newBtnCompactTxt}>+ New</Text>
            </Pressable>
          )}
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search encounters…"
          placeholderTextColor={Colors.textDim}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {STATUS_FILTERS.map(f => (
            <Pressable
              key={f.id}
              style={[styles.filterChip, statusFilter === f.id && styles.filterChipActive]}
              onPress={() => setStatusFilter(f.id)}
            >
              <Text style={[styles.filterChipTxt, statusFilter === f.id && styles.filterChipTxtActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {creating && (
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Encounter name…"
            placeholderTextColor={Colors.textDim}
            autoFocus
            onSubmitEditing={() => { void handleCreate(); }}
          />
          <Pressable style={styles.createGo} onPress={() => { void handleCreate(); }}>
            <Text style={styles.createGoTxt}>Create</Text>
          </Pressable>
          <Pressable style={styles.createCancel} onPress={() => { setCreating(false); setNewName(''); }}>
            <Text style={styles.createCancelTxt}>Cancel</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {filtered.length === 0 ? (
          <Text style={styles.emptyTxt}>
            {encounters.length === 0
              ? 'No prepared encounters yet. Create one to plan combat ahead of the table.'
              : 'No encounters match your search/filter.'}
          </Text>
        ) : (
          filtered.map(encounter => (
            <EncounterCard
              key={encounter.id}
              encounter={encounter}
              onOpen={() => router.push({ pathname: '/dm/encounter-builder', params: { id: encounter.id } } as any)}
              onStart={() => router.push({ pathname: '/dm/encounter', params: { preparedId: encounter.id } } as any)}
              onDuplicate={() => { void duplicateEncounter(encounter.id); }}
              onArchiveToggle={() => { void setStatus(encounter.id, encounter.status === 'archived' ? 'draft' : 'archived'); }}
              onDelete={() => confirmDelete(encounter)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surfaceHigh,
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  backTxt: { color: Colors.gold, fontSize: FontSize.md },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  toolbar: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.xs },
  search: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  filterRow: { gap: Spacing.xs, paddingVertical: Spacing.xs },
  filterChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filterChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterChipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filterChipTxtActive: { color: Colors.bg },
  newBtnCompact: {
    backgroundColor: Colors.gold, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  newBtnCompactTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  createRow: { flexDirection: 'row', gap: Spacing.xs, marginHorizontal: Spacing.md, marginTop: Spacing.sm },
  createInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  createGo: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  createGoTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  createCancel: { paddingHorizontal: Spacing.sm, justifyContent: 'center' },
  createCancelTxt: { color: Colors.textDim },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  emptyTxt: { color: Colors.textDim, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xl, lineHeight: 20 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs },
  cardName: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statusChip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusChipTxt: { fontSize: 10, fontWeight: FontWeight.bold, textTransform: 'uppercase' },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  cardMetaRow: { flexDirection: 'row' },
  cardMeta: { fontSize: FontSize.xs, color: Colors.textDim },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { backgroundColor: Colors.bg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.border },
  tagTxt: { fontSize: 10, color: Colors.textSecondary },
  cardActions: { flexDirection: 'row', gap: Spacing.md, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 6 },
  cardActionBtn: { padding: 2 },
  cardActionTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
});
