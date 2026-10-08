#!/usr/bin/env node
// EAS runs this in its disposable checkout after dependencies are installed.
// It materializes public-only build inputs before Metro starts.
import { spawnSync } from 'node:child_process';

if (process.env.EXPO_PUBLIC_SRD_ONLY !== 'true') process.exit(0);
const tsx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const script of ['scripts/generate-public-content-snapshot.ts', 'scripts/generate-content-db.mjs']) {
  const result = spawnSync(tsx, ['tsx', script], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
