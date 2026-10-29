#!/usr/bin/env bun
/**
 * Verifies generated style pages against the canonical manifest.
 *
 * Reads the files on disk and judges them independently of what any agent
 * claimed. Two design notes worth keeping:
 *
 *  · It compares COMPUTED STYLES, not screenshots. If a dark theme fails to
 *    flip, a pixel diff can tell you the page looks the same; this tells you
 *    `--c-bg` never changed. Screenshots are still written, purely for the eye.
 *  · Motion is judged via Document.getAnimations(), which is exact where a
 *    frame-diff would be timing-dependent.
 *
 *   bun styles-scaffold/tools/verify.ts                     # every generated page
 *   bun styles-scaffold/tools/verify.ts glassmorphism …      # named style ids
 *   bun styles-scaffold/tools/verify.ts --skeleton           # the reference itself
 */
import { chromium, type Page } from 'playwright';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(import.meta.path), '..');
const SUB = join(ROOT, 'subagents');
const SHOTS = join(ROOT, 'shots');
const LEDGER = join(ROOT, 'verify-manifest.jsonl');
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'content', 'content.manifest.json'), 'utf8'));

/** Desktop page size — the master scales an iframe of exactly this. */
const VIEWPORTS = { mobile: 375, tablet: 768, desktop: 1440 } as const;
const SECTIONS: string[] = MANIFEST.sections;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const rel = (p: string) => p.replace(ROOT + '/', '');

// ── colour helpers (WCAG relative luminance) ────────────────────────────────
function parseColor(c: string): [number, number, number, number] {
  const m = c.match(/-?[\d.]+/g);
  if (!m) return [0, 0, 0, 1];
  const [r, g, b, a] = m.map(Number);
  return [r ?? 255, g ?? 255, b ?? 255, a === undefined ? 1 : a];
}
function luminance(c: string) {
  const [r, g, b] = parseColor(c);
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ── in-page probe: one evaluate() collects everything we need ───────────────
const PROBE = () => {
  const px = (el: Element) => {
    const b = (el as HTMLElement).getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), t: Math.round(b.top) };
  };
  const sections = [...document.querySelectorAll('main > section[id], section[id]')].map((s) => ({
    id: s.id, ...px(s), hidden: getComputedStyle(s).visibility === 'hidden' || getComputedStyle(s).display === 'none',
  }));
  const texts = [...document.querySelectorAll('[data-tid]')].map((e) => ({
    tid: e.getAttribute('data-tid') as string,
    text: (e.textContent || '').replace(/\s+/g, ' ').trim(),
  }));
  const images = [...document.querySelectorAll('img[data-slot]')].map((e) => {
    const i = e as HTMLImageElement;
    return { slot: i.getAttribute('data-slot'), complete: i.complete, natural: i.naturalWidth, src: i.getAttribute('src') || '' };
  });
  const controls = [...document.querySelectorAll('#booking input[name], #booking select[name], #booking button')].map((e) => ({
    name: e.getAttribute('name') || e.getAttribute('id') || e.tagName,
    box: (e as HTMLElement).getBoundingClientRect().width,
  }));
  // Signature of painted colours, sampled across the document.
  const sampled: { bg: string; fg: string }[] = [];
  for (const el of [...document.querySelectorAll('body, main > section, .card, figure, h1, h2, h3, p, .btn, input, select, summary')].slice(0, 200)) {
    const cs = getComputedStyle(el);
    sampled.push({ bg: cs.backgroundColor, fg: cs.color });
  }
  const widest = Math.max(0, ...[...document.querySelectorAll('body *')].map((e) => (e as HTMLElement).getBoundingClientRect().right));
  return {
    docWidth: document.documentElement.scrollWidth,
    winWidth: window.innerWidth,
    widest: Math.round(widest),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    sections, texts, images, controls, sampled,
    anims: document.getAnimations().filter((a: Animation) => a.playState === 'running').length,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    htmlTheme: document.documentElement.getAttribute('data-theme'),
    distinctColors: new Set(sampled.flatMap((s) => [s.bg, s.fg])).size,
    painted: sections.filter((s: any) => s.h > 40 && !s.hidden).length,
  };
};
async function probe(page: Page) {
  return (await page.evaluate(PROBE)) as any;
}

function themeSignature(p: any) {
  return p.sampled.map((s: any) => `${s.bg}|${s.fg}`).join(';');
}

/** Every --c-* custom property defined for light vs dark, read from the source. */
function tokenParity(html: string) {
  const propsIn = (sel: RegExp) => {
    const out = new Set<string>();
    for (const m of html.matchAll(sel)) {
      for (const p of m[1].matchAll(/(--c-[\w-]+)\s*:/g)) out.add(p[1]);
    }
    return out;
  };
  const light = new Set([...propsIn(/(?::root|\[data-theme=["']?light["']?\])\s*\{([^}]*)\}/g)]);
  const dark = propsIn(/\[data-theme=["']?dark["']?\]\s*\{([^}]*)\}/g);
  const missingInDark = [...light].filter((t) => !dark.has(t));
  const missingInLight = [...dark].filter((t) => !light.has(t));
  return { light: light.size, dark: dark.size, missingInDark, missingInLight };
}

/** Screenshots are opt-in: 56 pages × 4 full-page PNGs measured 552 MB, which is
 *  more weight than the entire gallery it documents. master.html is the review
 *  surface; --shots exists for when you need to look at one page in isolation. */
const WANT_SHOTS = process.argv.includes('--shots');
const SHOT_DIR = join(ROOT, 'shots');
async function shoot(page: Page, name: string) {
  if (!WANT_SHOTS) return;
  if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: join(SHOT_DIR, name), fullPage: true }).catch(() => {});
}

async function verifyFile(page: Page, id: string, path: string) {
  const reasons: string[] = [];
  const notes: string[] = [];
  const html = readFileSync(path, 'utf8');
  const url = 'file://' + path;

  // Weight of the real page load, measured on this page; thumbnail weight is
  // measured separately below in its own cacheless context.
  const weight = { full: 0, thumb: 0 };
  page.removeAllListeners('response');
  page.on('response', async (r) => {
    try { weight.full += (await r.body()).length; } catch { /* opaque/redirect */ }
  });

  // ── desktop, light, motion allowed ──
  await page.setViewportSize({ width: VIEWPORTS.desktop, height: 900 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle').catch(() => {});
  const d = await probe(page);

  // 1 · structure
  const order = d.sections.map((s: any) => s.id).filter((s: string) => SECTIONS.includes(s));
  if (JSON.stringify(order) !== JSON.stringify(SECTIONS)) {
    reasons.push(`sections ${JSON.stringify(order)} != ${JSON.stringify(SECTIONS)}`);
  }
  for (const s of d.sections) {
    if (!SECTIONS.includes(s.id)) continue;
    if (s.hidden) reasons.push(`#${s.id} hidden`);
    else if (s.h < 40) reasons.push(`#${s.id} collapsed to ${s.h}px`);
    else if (s.w < VIEWPORTS.desktop * 0.5) notes.push(`#${s.id} narrow (${s.w}px)`);
  }

  // 2 · text integrity — the check that makes "same content" provable
  const pinned: Record<string, string> = {};
  for (const [tid, v] of Object.entries(MANIFEST.text as Record<string, any>)) if (!v.mutable) pinned[tid] = v.value;
  const found = new Map<string, string>();
  for (const t of d.texts) found.set(t.tid, norm(t.text));
  const missingTids = Object.keys(pinned).filter((t) => !found.has(t));
  if (missingTids.length) reasons.push(`missing data-tid ×${missingTids.length}: ${missingTids.slice(0, 4).join(', ')}`);
  const changed = Object.entries(pinned).filter(([t, v]) => found.has(t) && found.get(t) !== v);
  if (changed.length) reasons.push(`REWRITTEN COPY ×${changed.length}: ${changed.slice(0, 3).map(([t, v]) => `${t} ("${found.get(t)?.slice(0, 28)}" ≠ "${v.slice(0, 28)}")`).join(' | ')}`);

  // 3 · images are checked AFTER the scroll-through below, not here. Chromium
  //     does not fetch loading="lazy" images until they approach the viewport
  //     (~3000px of runway), so probing at first paint reported perfectly good
  //     photos as "did not load" on any tall page and pushed agents to force
  //     loading="eager" just to pass. See `light`/`darkP` below.

  // 4 · token parity (catches a theme that can never flip)
  const par = tokenParity(html);
  if (par.light === 0 || par.dark === 0) reasons.push(`token sets empty (light=${par.light} dark=${par.dark})`);
  if (par.missingInDark.length) reasons.push(`tokens never defined for dark: ${par.missingInDark.join(', ')}`);
  if (par.missingInLight.length) notes.push(`only in dark: ${par.missingInLight.join(', ')}`);

  // 5 · both themes render, and are actually different.
  /* Transitions are frozen for the theme comparison. Without this, sampling
     computed colours shortly after a flip caught pages mid-fade, which pushed
     agents into avoiding load-time transitions altogether. Reloading later in
     this run clears the injection, so the motion checks below are unaffected. */
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });

  /* fullPage screenshots do not scroll, so below-the-fold loading="lazy" photos
     never fetch and the capture shows blank boxes that the page itself renders
     fine. Trigger them before capturing, then return to the top. */
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.6;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 180));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 250));
    window.scrollTo(0, 0);
  });
  /* Give the fetches the scroll just triggered time to land before any capture;
     without this, fullPage shots showed blank tiles below the fold even though
     every image was genuinely in place. */
  await page.waitForLoadState('networkidle').catch(() => {});

  const setTheme = async (m: 'light' | 'dark') => {
    await page.evaluate((mode: string) => document.documentElement.setAttribute('data-theme', mode), m);
    await page.waitForTimeout(40);
    return probe(page);
  };
  const light = await setTheme('light');
  await shoot(page, `${id}-1440-light.png`);
  const darkP = await setTheme('dark');
  await shoot(page, `${id}-1440-dark.png`);

  for (const [name, p] of [['light', light], ['dark', darkP]] as const) {
    if (p.docWidth > VIEWPORTS.desktop + 1) reasons.push(`${name}@desktop horizontal overflow ${p.docWidth}>${p.winWidth}`);
    if (p.painted < SECTIONS.length) reasons.push(`${name}: only ${p.painted}/${SECTIONS.length} sections painted`);
    if (p.distinctColors < 3) reasons.push(`${name} renders in ${p.distinctColors} distinct colours — blank, or a theme that never applied`);
  }
  if (themeSignature(light) === themeSignature(darkP)) {
    reasons.push('dark theme is a no-op — every sampled colour identical to light');
  } else {
    const dl = Math.abs(luminance(light.bodyBg) - luminance(darkP.bodyBg));
    if (dl < 0.08) notes.push(`themes barely differ (body-luminance Δ${dl.toFixed(3)})`);
  }

  // 3 (deferred) · images arrived, judged from the post-scroll probe so lazy
  //     loading has had its chance to fetch.
  let bySlot = new Map(light.images.map((i: any) => [i.slot, i]));
  const missing = () => (MANIFEST.imageSlots as any[]).filter((want) => {
    const got = bySlot.get(want.slot);
    return !got || !got.complete || got.natural === 0;
  });
  /* One failed CDN fetch is not a page defect — a sibling saw "train never
     loaded" on a run that passed untouched seconds later. Re-request once and
     wait on the real decode before condemning anything. */
  if (missing().length) {
    await page.evaluate((slots: string[]) => Promise.all(slots.map((s) => new Promise<void>((resolve) => {
      const img = document.querySelector(`img[data-slot="${s}"]`) as HTMLImageElement | null;
      if (!img) return resolve();
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      const src = img.getAttribute('src');
      img.removeAttribute('src');
      img.setAttribute('src', src as string);
      setTimeout(done, 12000);
    }))), missing().map((m: any) => m.slot));
    bySlot = new Map((await probe(page)).images.map((i: any) => [i.slot, i]));
  }
  for (const want of MANIFEST.imageSlots as any[]) {
    const got = bySlot.get(want.slot);
    if (!got) { reasons.push(`missing image slot ${want.slot}`); continue; }
    if (norm(got.src) !== norm(want.src)) reasons.push(`${want.slot} src changed`);
  }
  const stillMissing = missing();
  if (stillMissing.length) {
    notes.push(`${stillMissing.length} photo(s) unloaded after retry: ${stillMissing.map((m: any) => m.slot).join(', ')} — usually a Wikimedia timeout on a loaded box, not the page`);
  }

  // 6 · responsive bands: no sideways scroll, all sections still painted
  for (const band of ['mobile', 'tablet'] as const) {
    const w = VIEWPORTS[band];
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(120);
    const p = await probe(page);
    if (p.overflowX) reasons.push(`${band}(${w}) horizontal overflow: doc ${p.docWidth} > win ${p.winWidth}, widest child right=${p.widest}`);
    const painted = p.sections.filter((s: any) => SECTIONS.includes(s.id) && !s.hidden && s.h > 40).length;
    if (painted < SECTIONS.length) reasons.push(`${band}(${w}): ${painted}/${SECTIONS.length} sections painted`);
    if (band === 'mobile') {
      const small = p.controls.filter((c: any) => c.box > 0 && c.box < 44);
      if (small.length) notes.push(`${small.length} booking control(s) under 44px on mobile`);
      await shoot(page, `${id}-375-${p.htmlTheme}.png`);
    }
  }
  await page.setViewportSize({ width: VIEWPORTS.desktop, height: 900 });

  // 7 · motion: present when allowed, absent when the user asked for calm
  const motion = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'load' });
  const rm = await probe(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  if (rm.anims > 0) reasons.push(`${rm.anims} animation(s) still running under prefers-reduced-motion`);
  if (motion === 0) notes.push('no running animation at sample time — expected for static styles, worth a look if yours is motion-led');

  /* 8 · thumbnail run mode must be markedly cheaper — 56 of these load at once.
     Measured in a FRESH page, because browser.newPage() gives a new context and
     therefore no HTTP cache. Reusing the page above would report ~0 KB purely
     from warm cache and quietly pass a page that defers nothing. */
  const thumbPage = await page.context().browser()!.newPage();
  thumbPage.setDefaultTimeout(30000);
  let thumbBytes = 0;
  thumbPage.on('response', async (r) => {
    try { thumbBytes += (await r.body()).length; } catch { /* opaque */ }
  });
  await thumbPage.goto(url + '?thumb=1', { waitUntil: 'load' });
  await thumbPage.waitForLoadState('networkidle').catch(() => {});
  const t = await probe(thumbPage);
  await thumbPage.close();

  const kb = (n: number) => Math.round(n / 1024);
  if (t.htmlTheme === null) notes.push('?thumb=1 did not set data-thumb');
  if (t.anims > 0) reasons.push(`${t.anims} animation(s) running in ?thumb=1 mode`);
  // The preview must still show real photography, or the gallery is blank cards.
  const heroLoaded = t.images.some((i: any) => i.slot === 'temple' && i.complete && i.natural > 0);
  if (!heroLoaded) reasons.push('hero image missing in ?thumb=1 — card would preview blank');
  const deferred = t.images.filter((i: any) => i.slot !== 'temple' && (i.natural === 0 || i.src.startsWith('data:'))).length;
  if (deferred < 8) reasons.push(`only ${deferred}/11 photos deferred in ?thumb=1; gallery will fetch ${kb(t.images.length * 400)} KB per card`);
  /* Thumbnail bytes are RECORDED, not gated. A ratio gate here looked
     reasonable but failed unpredictably: full-mode weight swung 1.8–5.7 MB
     between identical runs as Wikimedia served different derived sizes and as
     lazy fetching raced networkidle, so a compliant page failed ~1 run in 5.
     The deterministic signal is the deferral check above — it is structural,
     so it cannot flake. */
  weight.thumb = thumbBytes;

  return {
    id, pass: reasons.length === 0, reasons, notes,
    kbFull: kb(weight.full),
    kbThumb: kb(weight.thumb),
    pinnedChecked: Object.keys(pinned).length,
    tokens: { light: par.light, dark: par.dark },
    motionAnims: motion,
    declared: await page.evaluate(() => document.documentElement.getAttribute('data-dom-deviation')),
    xControls: await page.evaluate(() => document.querySelectorAll('[data-x-control]').length),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const targets: [string, string][] = [];
  if (args[0] === '--skeleton') targets.push(['_skeleton', join(ROOT, 'content', 'skeleton.html')]);
  else {
    const ids = args.filter((a) => !a.startsWith('--'));
    const all = ids.length
      ? ids
      : readdirSync(SUB).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''));
    for (const id of all) {
      const p = join(SUB, `${id}.html`);
      if (existsSync(p)) targets.push([id, p]);
      else console.log(`SKIP  ${id} — no file yet`);
    }
  }
  if (!targets.length) { console.log('nothing to verify'); return; }

  const browser = await chromium.launch();
  const rows: any[] = [];
  for (const [id, path] of targets) {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    try {
      const r = await verifyFile(page, id, path);
      rows.push(r);
      const mark = r.pass ? (r.notes.length ? 'OK~ ' : 'OK  ') : 'FAIL';
      console.log(`${mark} ${id.padEnd(36)} full ${String(r.kbFull).padStart(4)} KB · thumb ${String(r.kbThumb).padStart(4)} KB · ${r.pinnedChecked} strings${r.declared ? ` · deviation=${r.declared}` : ''}`);
      for (const x of r.reasons) console.log(`       · ${x}`);
      for (const x of r.notes) console.log(`       ~ ${x}`);
    } catch (e) {
      rows.push({ id, pass: false, reasons: [`crashed: ${(e as Error).message}`], notes: [] });
      console.log(`FAIL ${id}\n       · crashed: ${(e as Error).message}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();

  writeFileSync(LEDGER, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const bad = rows.filter((r) => !r.pass).length;
  console.log(`\n${rows.length - bad}/${rows.length} pass  ·  ${bad} fail  ·  ledger → ${rel(LEDGER)}`);
  if (bad) process.exit(1);
}

main();
