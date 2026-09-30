// Runs one or more Android E2E flows against the connected phone, with an optional Node table
// (Host / DM / Players on the PC over real TCP). Captures evidence for every run.
//   npx tsx scripts/e2e/run.ts dm-prepare-offline [--record]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Phone } from './adb';
import { NodeTable, HOST_PORT } from './table';
import { FaultProxy } from './nodeTransport';
import { Flow, FlowCtx, TableSpec } from './flows/common';
import { dmPrepareOffline } from './flows/dmPrepareOffline';
import { dmLive } from './flows/dmLive';
import { hostOnly } from './flows/hostOnly';
import { playerPhone } from './flows/playerPhone';
import { taterDm } from './flows/taterDm';
import { hostPlusDm } from './flows/hostPlusDm';

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'artifacts', 'host-dm-rework', 'e2e');

const FLOWS: Flow[] = [dmPrepareOffline, dmLive, hostOnly, hostPlusDm, playerPhone, taterDm];

async function runFlow(flow: Flow, record: boolean): Promise<boolean> {
  const dir = path.join(OUT, flow.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const phone = new Phone();
  const steps: string[] = [];
  let table = null as NodeTable | null;
  let ok = true;
  let recording = false;
  const videos: string[] = [];
  let error = '';
  const started = Date.now();

  const bringUp = async (spec: TableSpec): Promise<NodeTable> => {
    if (table) await table.stop();
    const t = new NodeTable({ dmPolicy: spec.policy, hostCaps: spec.hostCaps, sessionId: spec.sessionId, remote: spec.remote });
    await t.startHost();
    if (spec.proxyPort) { t.proxy = new FaultProxy(spec.proxyPort, '127.0.0.1', HOST_PORT); await t.proxy.start(); }
    for (const [id, name] of spec.players ?? []) await t.addPlayer(id, name);
    if (spec.nodeDm) { const dm = await t.addNodeDm(); await dm.peer.selectCampaign('camp-auto'); }
    if (spec.remote) execFileSync('adb', ['-s', phone.serial, 'forward', `tcp:${HOST_PORT}`, `tcp:${HOST_PORT}`]);
    else execFileSync('adb', ['-s', phone.serial, 'reverse', `tcp:${HOST_PORT}`, `tcp:${spec.proxyPort ?? HOST_PORT}`]);
    table = t;
    return t;
  };

  const ctx: FlowCtx = {
    phone, get table() { return table; }, startTable: bringUp,
    startRecording() { if (record && !recording) { phone.startRecording(flow.name); recording = true; steps.push(`RECORDING started at +${Math.round((Date.now() - started) / 1000)}s`); } },
    check(cond, what) { steps.push(`${cond ? 'CHECK ok' : 'CHECK FAIL'}: ${what}`); if (!cond) throw new Error(`check failed: ${what}`); },
    step(msg) { steps.push(`STEP: ${msg}`); console.log(`  - ${msg}`); },
  };

  try {
    if (flow.table) await bringUp(flow.table);
    await flow.run(ctx);
    phone.screenshot(path.join(dir, 'final.png'));
  } catch (e) {
    ok = false;
    error = (e as Error).stack ?? String(e);
    try {
      phone.screenshot(path.join(dir, 'failure.png'));
      phone.saveHierarchy(path.join(dir, 'failure-hierarchy.xml'));
      phone.logcat(path.join(dir, 'logcat.txt'));
      if (table) {
        fs.writeFileSync(path.join(dir, 'host-state.json'), JSON.stringify(table.state(), null, 1));
        fs.writeFileSync(path.join(dir, 'participants-roles.json'), JSON.stringify(Object.values(table.state().participants).map(p => ({ id: p.id, caps: p.capabilities, connected: p.connected })), null, 1));
        fs.writeFileSync(path.join(dir, 'pending-requests.json'), JSON.stringify(Object.values(table.state().requests).filter(r => r.status === 'PENDING'), null, 1));
        fs.writeFileSync(path.join(dir, 'active-effects.json'), JSON.stringify(table.state().effects, null, 1));
        if (table.proxy) fs.writeFileSync(path.join(dir, 'protocol-log.txt'), `--- phone -> host ---
${table.proxy.fromPhone.join('')}
--- host -> phone ---
${table.proxy.toPhone.join('')}`);
        fs.writeFileSync(path.join(dir, 'revisions.json'), JSON.stringify({ hostRevision: table.state().revision }, null, 1));
      }
    } catch { /* evidence capture must never mask the real failure */ }
  } finally {
    if (recording) { try { videos.push(...(await phone.stopRecording(path.join(dir, `${flow.name}.mp4`)))); } catch { /* best effort */ } }
    if (table) await table.stop();
    if (flow.table || table) {
      for (const a of [['reverse', '--remove'], ['forward', '--remove']]) { try { execFileSync('adb', ['-s', phone.serial, a[0], a[1], `tcp:${HOST_PORT}`], { stdio: 'ignore' }); } catch { /* not set */ } }
    }
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({
    flow: flow.name, description: flow.description, pass: ok, seconds, videos: videos.map(v => path.basename(v)), error, steps, phoneLog: phone.log,
    tableChecks: table ? table.checks : [],
  }, null, 1));
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${flow.name}  (${seconds}s)${ok ? '' : `\n${error}`}`);
  return ok;
}

async function main(): Promise<void> {
  const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const record = process.argv.includes('--record');
  const selected = names.length ? FLOWS.filter(f => names.includes(f.name)) : FLOWS;
  if (selected.length === 0) { console.error(`unknown flow(s); known: ${FLOWS.map(f => f.name).join(', ')}`); process.exit(2); }
  let allOk = true;
  for (const f of selected) { console.log(`\n== ${f.name}: ${f.description}`); if (!(await runFlow(f, record))) allOk = false; }
  process.exit(allOk ? 0 : 1);
}

void main();
