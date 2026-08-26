// src/hooks/useSafeGoBack.ts
// A "← Back" button that blindly calls router.back() crashes with
// "GO_BACK was not handled by any navigator" whenever there's no screen
// behind it in the navigation stack — which happens whenever a screen was
// reached via router.replace() rather than router.push() (e.g. the
// onboarding flow's "Try Sample Character" → router.replace(`/sheet/${id}`),
// landing the user on the sheet screen with zero history behind it).
//
// This is a defensive, universal fix: check router.canGoBack() first, and
// fall back to a known-safe destination (the home tab) if there's nothing
// to go back to, instead of letting the crash happen.
import { useCallback } from 'react';
import { useRouter } from 'expo-router';

/**
 * Returns a safe replacement for `() => router.back()`. Falls back to
 * `/(tabs)` (or a custom `fallback` route) if there's no navigation history
 * to go back to.
 */
export function useSafeGoBack(fallback: string = '/(tabs)') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as any);
    }
  }, [router, fallback]);
}
