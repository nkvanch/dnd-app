// src/utils/alert.ts
// Cross-platform drop-in for React Native's Alert.alert.
//
// react-native-web's Alert.alert is a COMPLETE no-op — see
// node_modules/react-native-web/src/exports/Alert/index.js, which is
// literally `static alert() {}`. Every dialog in this app (informational
// "Save failed"/"Validation Errors" messages AND confirm-style Delete/
// Discard/End/Remove prompts) silently vanished on web with no fallback —
// not just the multi-button ones. This shim keeps the exact same call
// signature so every existing call site works unchanged; only the import
// needs to switch from 'react-native' to here.
//
// Every confirm-style call site in this codebase follows the same shape:
// a 'cancel'-style button first (no onPress, just dismiss) and one action
// button second — so mapping to window.confirm's binary OK/Cancel is a
// faithful translation, not a lossy approximation, for everything this
// app actually calls. A hypothetical 3+-button alert would still degrade
// reasonably (cancel vs. "the other button"), just not distinguish among
// multiple non-cancel options — none exist in this codebase today.
import { Alert as RNAlert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const cancelBtn = buttons.find(b => b.style === 'cancel') ?? buttons[0];
  const actionBtn = buttons.find(b => b !== cancelBtn) ?? buttons[buttons.length - 1];
  if (window.confirm(text)) {
    actionBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}

export const Alert = { alert };
