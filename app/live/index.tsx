// app/live/index.tsx
// Live Session hub. Chooses what this device does in a session; afterwards routes by capability.
// The actual form/status content lives in src/components/live/{LiveSessionStart,LiveSessionStatus}
// so it can render identically here and inline on the Campaigns page.
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useSessionRuntime } from '../../src/session/runtime';
import { primaryDestination, DESTINATION_PATH, capabilityLabel } from '../../src/session/routing';
import { LiveScreen } from '../../src/components/live/LiveUi';
import { LiveSessionStart } from '../../src/components/live/LiveSessionStart';
import { LiveSessionStatus } from '../../src/components/live/LiveSessionStatus';

export default function LiveHub() {
  const router = useRouter();
  const rt = useSessionRuntime();
  const wasIdle = useRef(rt.mode === 'idle');

  // Open the single relevant screen automatically the first time a role arrives.
  useEffect(() => {
    if (rt.mode === 'idle') { wasIdle.current = true; return; }
    if (wasIdle.current && rt.status === 'connected') {
      const dest = primaryDestination(rt.capabilities);
      if (dest) { wasIdle.current = false; router.push(DESTINATION_PATH[dest]); }
    }
  }, [rt.mode, rt.status, rt.capabilities, router]);

  if (rt.mode !== 'idle') {
    return (
      <LiveScreen title="Live Session" subtitle={capabilityLabel(rt.capabilities)} backTo="/(tabs)/campaigns">
        <LiveSessionStatus />
      </LiveScreen>
    );
  }

  return (
    <LiveScreen title="Live Session" subtitle="Host, DM and Player are separate roles" backTo="/(tabs)/campaigns">
      <LiveSessionStart />
    </LiveScreen>
  );
}
