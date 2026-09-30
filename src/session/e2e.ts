// ============================================================================
// FILE: src/session/e2e.ts
// TEST-ONLY switch for deterministic Android automation.
// Enabled ONLY when the app is built with EXPO_PUBLIC_E2E=1 (Expo inlines it at
// build time). Production builds leave it unset, so every guard below is false and
// the fixture entry points do nothing. It adds convenience (deterministic fixtures,
// no file pickers/QR), never a way around role authorization: the Host still enforces
// every capability check for E2E builds exactly as in production.
// ============================================================================
export const E2E_ENABLED: boolean = process.env.EXPO_PUBLIC_E2E === '1';
