// ============================================================================
// FILE: src/components/QrScannerModal.tsx
// Generic 7-character room-code QR scanner, shared by the legacy campaign
// sync (Campaigns tab join flow) and the live-session join flow. Only
// validates the code SHAPE (7 alphanumeric chars) — callers decide what to
// do with it (legacy sync port vs. session port).
// ============================================================================
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Colors, Radius, FontWeight } from '../theme';

export function QrScannerModal({
  visible, onScan, onClose, hint = "Point at the DM's QR code",
}: { visible: boolean; onScan: (code: string) => void; onClose: () => void; hint?: string }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) void requestPermission();
    if (!visible) setScanned(false);
  }, [visible, permission?.granted, requestPermission]);

  function handleBarcode(result: BarcodeScanningResult) {
    if (scanned) return;
    const raw = result.data?.trim().toUpperCase() ?? '';
    if (/^[0-9A-Z]{7}$/.test(raw)) { setScanned(true); onScan(raw); }
  }

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        {!permission?.granted ? (
          <View style={s.center}>
            <Text style={s.permTxt}>Camera permission required to scan QR codes.</Text>
            <Pressable style={s.permBtn} onPress={() => { void requestPermission(); }}>
              <Text style={s.permBtnTxt}>Grant Permission</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView style={s.camera} facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcode} />
            <View style={s.overlay}>
              <View style={s.frame} />
              <Text style={s.hint}>{hint}</Text>
            </View>
          </>
        )}
        <Pressable style={s.closeBtn} onPress={onClose} testID="qr-scanner-cancel">
          <Text style={s.closeTxt}>✕ Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera:    { flex: 1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permTxt:   { color: '#fff', textAlign: 'center', fontSize: 16 },
  permBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnTxt:{ color: Colors.bg, fontWeight: FontWeight.bold, fontSize: 16 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame:   { width: 220, height: 220, borderWidth: 3, borderColor: Colors.gold, borderRadius: Radius.lg },
  hint:    { color: '#fff', marginTop: 20, fontSize: 14, textAlign: 'center' },
  closeBtn:{ position: 'absolute', top: 52, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 12 },
  closeTxt:{ color: '#fff', fontWeight: FontWeight.bold, fontSize: 16 },
});
