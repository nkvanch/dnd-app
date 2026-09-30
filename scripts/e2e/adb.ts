// adb + uiautomator driver for unattended Android E2E. Used instead of Maestro on devices where
// Maestro's own driver APK cannot be installed without a human tap (e.g. HyperOS "Install via USB").
// Elements are addressed by React Native testID (uiautomator resource-id), visible text or content-desc.
import { execFileSync, spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type Sel = { id?: string; text?: string; desc?: string; textContains?: string };

type UiNode = { id: string; text: string; desc: string; clickable: boolean; x1: number; y1: number; x2: number; y2: number };

const FIXED_CHROME = /^(tab-|live-back$)/;
const SAFE_TOP = 480;      // well below the app header (elements hugging the header edge do not reliably take taps)
const SAFE_BOTTOM = 2080;  // above the 3-button navigation bar (taps there hit Home/Back/Recents)

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

function decode(s: string): string {
  return s.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

export class Phone {
  readonly serial: string;
  private recorder: ChildProcess | null = null;
  private recordName = '';
  private segments = 0;
  private recording = false;
  readonly log: string[] = [];
  private lastSwipeAt = 0;

  constructor(serial?: string, private readonly appId = 'com.nkvanch.grimoire') {
    this.serial = serial ?? Phone.firstDevice();
  }

  static firstDevice(): string {
    const out = execFileSync('adb', ['devices']).toString().split(/\r?\n/).slice(1).filter(l => /\tdevice$/.test(l));
    if (out.length === 0) throw new Error('no authorized adb device');
    return out[0].split('\t')[0];
  }

  private adb(args: string[], opts: { input?: string } = {}): string {
    return execFileSync('adb', ['-s', this.serial, ...args], { input: opts.input, maxBuffer: 1 << 26 }).toString();
  }
  sh(cmd: string): string { return this.adb(['shell', cmd]); }
  note(msg: string): void { this.log.push(`${new Date().toISOString()} ${msg}`); }

  // ── App lifecycle ──────────────────────────────────────────────────────────
  async launch(stop = true): Promise<void> {
    if (stop) this.adb(['shell', 'am', 'force-stop', this.appId]);
    this.adb(['shell', 'monkey', '-p', this.appId, '-c', 'android.intent.category.LAUNCHER', '1']);
    await sleep(4500);
    this.note('launched app');
  }
  stopApp(): void { this.adb(['shell', 'am', 'force-stop', this.appId]); this.note('force-stopped app'); }
  back(): void { this.adb(['shell', 'input', 'keyevent', '4']); }

  // ── UI hierarchy ───────────────────────────────────────────────────────────
  dump(): UiNode[] {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        this.adb(['shell', 'uiautomator', 'dump', '/sdcard/e2e-ui.xml']);
        const xml = this.adb(['exec-out', 'cat', '/sdcard/e2e-ui.xml']);
        const nodes: UiNode[] = [];
        const re = /<node [^>]*?\/?>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(xml))) {
          const a = m[0];
          const attr = (n: string): string => { const r = new RegExp(`\\s${n}="([^"]*)"`).exec(a); return r ? decode(r[1]) : ''; };
          const b = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(a);
          if (!b) continue;
          nodes.push({ id: attr('resource-id'), text: attr('text'), desc: attr('content-desc'), clickable: attr('clickable') === 'true',
            x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4] });
        }
        return nodes;
      } catch { /* the dump can race with a screen transition; retry */ }
    }
    return [];
  }

  private matches(n: UiNode, s: Sel): boolean {
    if (s.id !== undefined && n.id !== s.id) return false;
    if (s.text !== undefined && n.text !== s.text && n.desc !== s.text) return false;
    if (s.desc !== undefined && n.desc !== s.desc) return false;
    if (s.textContains !== undefined) { const q = s.textContains.toLowerCase(); if (!n.text.toLowerCase().includes(q) && !n.desc.toLowerCase().includes(q)) return false; }
    return true;
  }

  find(s: Sel): UiNode | undefined {
    const hits = this.dump().filter(n => this.matches(n, s));
    return hits.find(n => n.clickable) ?? hits[0];
  }

  allText(): string {
    return this.dump().map(n => `${n.text} ${n.desc}`).join('\n');
  }

  visible(s: Sel): boolean { return this.find(s) !== undefined; }

  async waitFor(s: Sel, timeoutMs = 15000): Promise<UiNode> {
    const start = Date.now();
    for (;;) {
      const n = this.find(s);
      if (n) return n;
      if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${JSON.stringify(s)}\n--- screen ---\n${this.allText().slice(0, 1500)}`);
      await sleep(400);
    }
  }

  async waitGone(s: Sel, timeoutMs = 15000): Promise<void> {
    const start = Date.now();
    while (this.find(s)) {
      if (Date.now() - start > timeoutMs) throw new Error(`still visible after ${timeoutMs}ms: ${JSON.stringify(s)}`);
      await sleep(400);
    }
  }

  /**
   * Finds an element anywhere in the current scroll view (off-screen nodes are absent from the
   * uiautomator tree, so this scrolls to discover them) and leaves it inside the safe tap band.
   */
  async scrollTo(s: Sel, timeoutMs = 25000, forTap = true): Promise<UiNode> {
    const start = Date.now();
    let stuck = 0;
    let lastSig = '';
    let jumped = false;
    let nudgedAt = -1;
    while (Date.now() - start < timeoutMs) {
      const nodes = this.dump();
      const n = nodes.filter(x => this.matches(x, s)).sort((p, q) => Number(q.clickable) - Number(p.clickable))[0];
      if (n && FIXED_CHROME.test(s.id ?? '')) return n;        // tab bar / header buttons never scroll
      if (n && !forTap && (n.y1 + n.y2) / 2 >= 230 && (n.y1 + n.y2) / 2 <= 2250) return n;      // assertions only need it on screen
      if (n) {
        const cy = (n.y1 + n.y2) / 2;
        if (cy >= SAFE_TOP && cy <= SAFE_BOTTOM) {
          // A fling from an earlier swipe can still be moving: only accept a position that holds still.
          if (Date.now() - this.lastSwipeAt > 2500) return n;
          await sleep(350);
          const again = this.dump().filter(x => this.matches(x, s)).sort((p, q) => Number(q.clickable) - Number(p.clickable))[0];
          if (again && Math.abs(again.y1 - n.y1) <= 2 && Math.abs(again.x1 - n.x1) <= 2) return again;
          continue;
        }
        // outside the preferred band: nudge it in. If the page cannot scroll (position unchanged), accept
        // anything that is still on screen and clear of the header / navigation bar.
        if (nudgedAt === n.y1 && cy >= 230 && cy <= 2250) return n;
        nudgedAt = n.y1;
        this.swipe(cy > SAFE_BOTTOM ? 'down' : 'up', Math.min(1300, Math.max(400, Math.abs(cy - 1200) - 300)));
        await sleep(900);
        continue;
      }
      // Not on this screen. First fling to the top once, then scan downwards a page at a time until the bottom.
      if (!jumped) {
        jumped = true;
        for (let k = 0; k < 4; k++) { this.swipe('up', 1600, 120); await sleep(250); }
        await sleep(900);
        lastSig = '';
        continue;
      }
      const sig = nodes.map(x => `${x.id}|${x.text}|${x.y1}`).join(';');
      if (sig === lastSig) { stuck += 1; if (stuck >= 2) break; } else { stuck = 0; }
      lastSig = sig;
      this.swipe('down', 900);
      await sleep(900);
    }
    throw new Error(`could not find ${JSON.stringify(s)} on screen or by scrolling
--- screen ---
${this.allText().replace(/\s+/g, ' ').slice(0, 1200)}`);
  }

  /** dir 'down' = reveal content further down the page (finger moves up). */
  swipe(dir: 'down' | 'up', distance = 700, durationMs = 350): void {
    this.lastSwipeAt = Date.now();
    const mid = 1300;
    const from = dir === 'down' ? mid + distance / 2 : mid - distance / 2;
    const to = dir === 'down' ? mid - distance / 2 : mid + distance / 2;
    this.adb(['shell', 'input', 'swipe', '540', String(Math.round(from)), '540', String(Math.round(to)), String(durationMs)]);
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async tap(s: Sel, opts: { timeout?: number } = {}): Promise<void> {
    const n = await this.scrollTo(s, opts.timeout ?? 25000);
    const x = Math.round((n.x1 + n.x2) / 2);
    const y = Math.round((n.y1 + n.y2) / 2);
    this.adb(['shell', 'input', 'tap', String(x), String(y)]);
    this.note(`tap ${JSON.stringify(s)} @${x},${y}`);
    await sleep(600);
  }

  /** Taps `s` until `expect` appears (a tap can be swallowed while the screen is re-rendering). */
  async tapUntil(s: Sel, expect: Sel, attempts = 4): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      await this.tap(s);
      await sleep(700);
      if (this.find(expect)) return;
      this.note(`tap ${JSON.stringify(s)} did not produce ${JSON.stringify(expect)}; retry ${i + 1}`);
    }
    await this.waitFor(expect, 4000);
  }

  async typeInto(s: Sel, text: string, opts: { clear?: boolean } = {}): Promise<void> {
    await this.tap(s);
    if (opts.clear !== false) {
      this.adb(['shell', 'input', 'keyevent', 'KEYCODE_MOVE_END']);
      this.adb(['shell', 'input', 'keyevent', ...Array(60).fill('KEYCODE_DEL')]);
    }
    if (text) this.adb(['shell', 'input', 'text', text.replace(/ /g, '%s').replace(/([&|;()<>'"\\$~*?#`])/g, '\\$1')]);
    await sleep(300);
    await this.hideKeyboard();
  }

  async hideKeyboard(): Promise<void> {
    const shown = /mInputShown=true/.test(this.sh('dumpsys input_method | grep mInputShown'));
    if (shown) { this.back(); await sleep(500); }
  }

  async assertVisible(s: Sel, timeout = 12000): Promise<void> {
    await this.waitFor(s, timeout);
    this.note(`assert visible ${JSON.stringify(s)}`);
  }

  /** Asserts the element exists in the current scroll view (scrolling to find it). */
  async assertPresent(s: Sel, timeout = 25000): Promise<void> {
    await this.scrollTo(s, timeout, false);
    this.note(`assert present ${JSON.stringify(s)}`);
  }

  async assertGone(s: Sel, timeout = 8000): Promise<void> {
    await this.waitGone(s, timeout);
    this.note(`assert gone ${JSON.stringify(s)}`);
  }

  async assertText(fragment: string, timeout = 12000): Promise<void> {
    await this.waitFor({ textContains: fragment }, timeout);
    this.note(`assert text "${fragment}"`);
  }

  /** Text of the node directly below the node whose text is `label` (stat blocks: label above value). */
  textBelow(label: string): string | null {
    const nodes = this.dump();
    const l = nodes.find(n => n.text === label);
    if (!l) return null;
    const cands = nodes.filter(n => n.text && n.y1 >= l.y2 - 4 && Math.abs((n.x1 + n.x2) / 2 - (l.x1 + l.x2) / 2) < 90 && n !== l);
    cands.sort((a, b) => a.y1 - b.y1);
    return cands[0]?.text ?? null;
  }

  /** Chip state is exposed as "(selected)" in the accessibility label. */
  async chipSelected(id: string): Promise<boolean> {
    const n = await this.scrollTo({ id });
    return n.desc.endsWith('(selected)');
  }

  async setChip(id: string, on: boolean): Promise<void> {
    if ((await this.chipSelected(id)) !== on) await this.tap({ id });
  }

  async pause(ms: number): Promise<void> { await sleep(ms); }

  // ── Evidence ───────────────────────────────────────────────────────────────
  screenshot(file: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const buf = execFileSync('adb', ['-s', this.serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 1 << 28 });
    fs.writeFileSync(file, buf);
  }

  saveHierarchy(file: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.adb(['shell', 'uiautomator', 'dump', '/sdcard/e2e-ui.xml']);
    fs.writeFileSync(file, this.adb(['exec-out', 'cat', '/sdcard/e2e-ui.xml']));
  }

  logcat(file: string, lines = 800): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, this.adb(['logcat', '-d', '-t', String(lines)]));
  }

  /**
   * Records the screen in consecutive real-time segments (`screenrecord` stops at 3 minutes per file). Segments
   * are never edited or re-timed: part1, part2, ... play back to back.
   */
  startRecording(name: string): void {
    this.recordName = name;
    this.segments = 0;
    this.recording = true;
    this.nextSegment();
  }

  private nextSegment(): void {
    if (!this.recording) return;
    const n = ++this.segments;
    const remote = `/sdcard/${this.recordName}-part${n}.mp4`;
    this.sh(`rm -f ${remote}`);
    const child = spawn('adb', ['-s', this.serial, 'shell', 'screenrecord', '--size', '720x1600', '--bit-rate', '6000000', '--time-limit', '170', remote], { stdio: 'ignore' });
    this.recorder = child;
    child.on('exit', () => { if (this.recording && this.recorder === child) this.nextSegment(); });
  }

  /** Stops recording and pulls every segment; returns the local file paths (single segment keeps `outFile` as is). */
  async stopRecording(outFile: string): Promise<string[]> {
    if (!this.recorder) return [];
    this.recording = false;
    try { this.adb(['shell', 'pkill', '-2', 'screenrecord']); } catch { /* already finished */ }
    await sleep(2500);
    this.recorder = null;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const out: string[] = [];
    for (let n = 1; n <= this.segments; n++) {
      const remote = `/sdcard/${this.recordName}-part${n}.mp4`;
      const local = this.segments === 1 ? outFile : outFile.replace(/\.mp4$/, `-part${n}.mp4`);
      this.adb(['pull', remote, local]);
      this.sh(`rm -f ${remote}`);
      out.push(local);
    }
    return out;
  }
}
