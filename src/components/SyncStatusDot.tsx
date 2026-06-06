// ============================================================================
// FILE: src/components/SyncStatusDot.tsx
// Small coloured dot shown in sheet/DM headers while a campaign is active.
//   Green  → connected to DM server (or IS the server)
//   Red    → session active but currently disconnected / reconnecting
//   Hidden → offline (no active campaign)
// ============================================================================
import { View, StyleSheet } from 'react-native';
import { useSyncStore } from '../store/syncStore';

export function SyncStatusDot() {
  const { connected, role } = useSyncStore(s => s.status);

  // Don't render anything when the app is not in a campaign
  if (role === 'offline') return null;

  return (
    <View style={[styles.dot, connected ? styles.green : styles.red]} />
  );
}

const styles = StyleSheet.create({
  dot:   { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  green: { backgroundColor: '#4ade80' },
  red:   { backgroundColor: '#f87171' },
});
