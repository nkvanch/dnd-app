// app/live/_layout.tsx
// Live session screens: Host, DM (Prepare + Live) and Player.
// No route-level role gate on purpose: each screen derives what it shows from the
// device's ACTUAL capabilities in the current session (see src/session/routing.ts).
// DM preparation (app/live/prepare.tsx) is deliberately reachable with no session at all.
import { Stack } from 'expo-router';

export default function LiveLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
