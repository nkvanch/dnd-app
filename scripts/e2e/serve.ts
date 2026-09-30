// Long-running Node table with an HTTP control port (localhost:7799) so an orchestrator (or a human
// debugging) can drive the non-phone roles while Maestro drives the phone.
//   npx tsx scripts/e2e/serve.ts --policy manual --players alice:Alice,bob:Bob [--proxy 7744]
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { NodeTable, HOST_PORT } from './table';
import { FaultProxy } from './nodeTransport';
import { CharacterChange } from '../../src/session/types';

const args = process.argv.slice(2);
const opt = (name: string, dflt = ''): string => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };

async function main(): Promise<void> {
  const policy = (opt('policy', 'manual') as 'manual' | 'auto-first' | 'never');
  const players = opt('players', '').split(',').filter(Boolean).map(s => s.split(':'));
  const proxyPort = opt('proxy') ? Number(opt('proxy')) : null;
  const nodeDm = opt('node-dm') === 'true';
  const t = new NodeTable({ dmPolicy: policy, hostCaps: opt('host-caps') === 'dm' ? ['dm'] : [] });
  await t.startHost();
  if (proxyPort) { t.proxy = new FaultProxy(proxyPort, '127.0.0.1', HOST_PORT); await t.proxy.start(); }
  for (const [id, name] of players) await t.addPlayer(id, name ?? id);
  if (nodeDm) {
    const dm = await t.addNodeDm();
    await dm.peer.selectCampaign('camp-auto');
  }
  if (opt('auto-approve') === 'true') {
    // Simulates the Host user tapping "Approve as DM" on the Host screen, a couple of seconds after the request.
    setInterval(() => {
      for (const p of Object.values(t.state().participants)) {
        if (p.requestedDm && !p.capabilities.includes('dm')) {
          setTimeout(() => { try { t.hostPeer.assignCapabilities(p.id, [...p.capabilities.filter(c => c !== 'host'), 'dm']); } catch { /* raced */ } }, 1500);
        }
      }
    }, 700);
  }
  const responder = opt('auto-respond'); // e.g. "alice:modify:2"
  if (responder) {
    const [who, decision, amount] = responder.split(':');
    setInterval(() => {
      const p = t.players.get(who);
      const req = p?.peer.pendingRequests()[0];
      if (p && req && p.peer.status === 'connected' && !p.character.applied.includes(req.id) && !(p as unknown as { busy?: boolean }).busy) {
        (p as unknown as { busy?: boolean }).busy = true;
        setTimeout(() => {
          try {
            const modified = decision === 'modify' ? req.original.map(c => ({ ...c, delta: Number(amount) })) : undefined;
            p.peer.respond(req.id, decision as 'accept' | 'reject' | 'modify', modified ? { modified } : {});
          } finally { (p as unknown as { busy?: boolean }).busy = false; }
        }, 2500);
      }
    }, 800);
  }
  try { execFileSync('adb', ['reverse', `tcp:${HOST_PORT}`, `tcp:${proxyPort ?? HOST_PORT}`]); } catch { /* adb optional */ }
  try { if (proxyPort) execFileSync('adb', ['reverse', `tcp:${proxyPort}`, `tcp:${proxyPort}`]); } catch { /* optional */ }

  const json = (res: http.ServerResponse, body: unknown, code = 200) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body, null, 1));
  };

  http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const q = (k: string) => u.searchParams.get(k) ?? '';
    const parts = u.pathname.split('/').filter(Boolean);
    void (async () => {
      try {
        switch (parts[0]) {
          case 'state': return json(res, t.state());
          case 'view': { const p = t.players.get(q('who')); return json(res, p ? p.peer.view : (q('who') === 'host' ? t.hostPeer.view : null)); }
          case 'wire': { const p = t.players.get(q('who')); return json(res, p ? p.wire.received : []); }
          case 'checks': return json(res, { failures: t.failures, checks: t.checks });
          case 'approve': { const id = q('id'); return json(res, { op: t.hostPeer.assignCapabilities(id, [...(t.state().participants[id]?.capabilities.filter(c => c !== 'host') ?? []), 'dm']) }); }
          case 'respond': {
            const p = t.players.get(q('who'))!;
            const modified = q('amount') ? ([{ ...(JSON.parse(q('kind') || '{"kind":"exhaustion"}')), delta: Number(q('amount')) }] as CharacterChange[]) : undefined;
            const req = p.peer.pendingRequests()[0];
            if (!req) return json(res, { error: 'no pending request' }, 409);
            return json(res, { op: p.peer.respond(req.id, q('decision') as 'accept' | 'reject' | 'modify', modified ? { modified } : {}), request: req.id });
          }
          case 'disconnect': t.players.get(q('who'))?.peer.disconnect(); return json(res, { ok: true });
          case 'connect': await t.players.get(q('who'))?.peer.connect(); return json(res, { ok: true });
          case 'sever': t.proxy?.sever(); return json(res, { live: t.proxy?.liveConnections ?? 0 });
          case 'block': t.proxy?.block(q('on') === '1'); return json(res, { blocked: t.proxy?.blocked });
          case 'dm': {
            const dm = t.dm!.peer;
            switch (parts[1]) {
              case 'activate': return json(res, { op: await dm.activateEncounter('camp-auto', 'enc-bridge') });
              case 'apply': return json(res, await dm.applyPreparedEffect('camp-auto', q('fx'), q('targets').split(',')));
              case 'request': return json(res, await dm.requestChangeFromTemplate('camp-auto', 'tpl-exh', q('target')));
              case 'end': return json(res, { op: dm.endEffect(q('effect'), q('app') || undefined) });
              case 'due': return json(res, { op: dm.markDue(q('app')) });
              case 'disconnect': dm.disconnect(); return json(res, { ok: true });
              case 'connect': await dm.connect(); return json(res, { ok: true });
              default: return json(res, { error: 'unknown dm cmd' }, 404);
            }
          }
          case 'quit': json(res, { ok: true }); await t.stop(); process.exit(t.failures.length ? 1 : 0); return;
          default: return json(res, { error: 'unknown' }, 404);
        }
      } catch (e) {
        return json(res, { error: (e as Error).message }, 500);
      }
    })();
  }).listen(7799, '127.0.0.1', () => console.log(`table ready: host :${HOST_PORT}${proxyPort ? ` via proxy :${proxyPort}` : ''}, control :7799`));
}

void main();
