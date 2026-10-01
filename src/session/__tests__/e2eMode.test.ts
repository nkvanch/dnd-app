import fs from 'node:fs';
import path from 'node:path';

describe('the test-only E2E switch is not a production backdoor', () => {
  const OLD = process.env.EXPO_PUBLIC_E2E;
  afterEach(() => {
    if (OLD === undefined) delete process.env.EXPO_PUBLIC_E2E; else process.env.EXPO_PUBLIC_E2E = OLD;
    jest.resetModules();
  });

  it('is off unless EXPO_PUBLIC_E2E is exactly "1"', () => {
    for (const [value, expected] of [[undefined, false], ['', false], ['0', false], ['true', false], ['1', true]] as const) {
      jest.resetModules();
      if (value === undefined) delete process.env.EXPO_PUBLIC_E2E; else process.env.EXPO_PUBLIC_E2E = value;

      expect((require('../e2e') as { E2E_ENABLED: boolean }).E2E_ENABLED).toBe(expected);
    }
  });

  it('the release build scripts never set it', () => {
    const scripts = path.resolve(__dirname, '../../../scripts');
    for (const f of ['build-apk-local.ps1']) {
      expect(fs.readFileSync(path.join(scripts, f), 'utf8')).not.toMatch(/EXPO_PUBLIC_E2E/);
    }
    const eas = path.resolve(__dirname, '../../../eas.json');
    if (fs.existsSync(eas)) expect(fs.readFileSync(eas, 'utf8')).not.toMatch(/EXPO_PUBLIC_E2E/);
  });

  it('the fixtures screen and the hub link are guarded by the flag, and no fixture bypasses the Host\'s authorization', () => {
    const root = path.resolve(__dirname, '../../..');
    const screen = fs.readFileSync(path.join(root, 'app/live/e2e.tsx'), 'utf8');
    expect(screen).toMatch(/if \(!E2E_ENABLED\) return null;/);
    // The hub link lives in LiveSessionStart, the shared idle-state form rendered both by the
    // standalone /live route and inline on the Campaigns page — one guard covers both entry points.
    const hubEntry = fs.readFileSync(path.join(root, 'src/components/live/LiveSessionStart.tsx'), 'utf8');
    expect(hubEntry).toMatch(/E2E_ENABLED && </);
    // Nothing in the session core may read the flag: authorization must behave identically in test builds.
    for (const f of ['host.ts', 'peer.ts', 'roles.ts', 'state.ts', 'runtime.ts']) {
      expect(fs.readFileSync(path.join(root, 'src/session', f), 'utf8')).not.toMatch(/E2E_ENABLED|EXPO_PUBLIC_E2E/);
    }
  });
});
