// Shows a hosted live session's 7-character room code plus a scannable QR
// encoding the same code, so a joiner can either type it or scan it instead
// of typing a raw LAN IP. The code only ever encodes the host's IP (see
// src/sync/discovery.ts) — the joiner always connects on SESSION_PORT.
import { View, Text, StyleSheet, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function RoomCodeCard({ code }: { code: string }) {
  return (
    <View style={s.wrap} testID="live-room-code-card">
      <Text style={s.label}>Room code</Text>
      <Text style={s.code} testID="live-room-code">{code}</Text>
      {Platform.OS !== 'web' && (
        <View style={s.qrWrap}>
          <QRCode value={code} size={140} />
        </View>
      )}
      <Text style={s.hint}>Others on this network can type this code or scan the QR to join.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1 },
  code: { fontSize: FontSize.xl, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 6 },
  qrWrap: { backgroundColor: '#fff', padding: Spacing.sm, borderRadius: Radius.md, marginVertical: Spacing.xs },
  hint: { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'center', maxWidth: 260 },
});
