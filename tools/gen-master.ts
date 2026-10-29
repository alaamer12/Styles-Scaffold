#!/usr/bin/env bun
/**
 * Generates styles-scaffold/master.html from styles.csv.
 *
 * The gallery is GENERATED rather than hand-written so the card list can never
 * drift from the 56 in-scope CSV rows. Card text is INLINED because Chromium
 * blocks fetch() on file:// — a JSON side-car would not load when you double-click
 * the file, and this artifact must work from disk with no server.
 *
 *   bun styles-scaffold/tools/gen-master.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(import.meta.path), '..');
const CSV = join(ROOT, '..', 'styles.csv');
const OUT = join(ROOT, 'master.html');
const IN_SCOPE = new Set(['General', 'Landing Page']);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

const rows = parseCsv(readFileSync(CSV, 'utf8'));
const head = rows[0];
const col = (n: string) => head.indexOf(n);

/** Keywords arrive as a prose list; the description reads better as a phrase. */
const gloss = (s: string) =>
  s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5).join(' · ');

const cards = rows.slice(1)
  .filter((r) => IN_SCOPE.has(r[col('Type')].trim()))
  .map((r) => ({
    id: r[col('Style ID')].trim(),
    name: r[col('Style Category')].trim(),
    desc: gloss(r[col('Keywords')]),
    best: r[col('Best For')].trim(),
    era: r[col('Era/Origin')].trim(),
    complexity: r[col('Complexity')].trim(),
    type: r[col('Type')].trim(),
  }))
  .filter((c) => c.id);

const present = cards.filter((c) => existsSync(join(ROOT, 'subagents', c.id + '.html'))).length;

/* Embedded JS below deliberately avoids template literals, so this file's own
   ${} interpolation cannot collide with the generated script's quoting. */
const JS = String.raw`
(function () {
  var DEV_W = 1440, DEV_H = 900;      // the width each style page was designed for
  var MAX_LIVE = 9;                  // live iframes at once; 56 would sink the tab
  var grid = document.getElementById('grid');
  var cards = [].slice.call(grid.querySelectorAll('.card'));
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── scale each preview to the card, never squeeze the page ──────────────
     The iframe keeps its true 1440px viewport and is transform-scaled down, so
     the thumbnail is the real layout rather than a reflowed miniature. */
  function fit() {
    for (var i = 0; i < cards.length; i++) {
      var box = cards[i].querySelector('.preview');
      if (!box) continue;
      var w = box.clientWidth;
      if (!w) continue;
      var s = w / DEV_W;
      box.style.height = Math.round(w * (DEV_H / DEV_W)) + 'px';
      var fr = box.querySelector('iframe');
      if (fr) fr.style.transform = 'scale(' + s + ')';
    }
  }

  /* ── materialise thumbnails near the viewport ────────────────────────────
     loading="lazy" on an <iframe> is unreliable in Safari, and a src-less
     iframe costs nothing, so documents are created and destroyed on demand. */
  var live = [];
  function mount(card) {
    var fr = card.querySelector('iframe');
    if (fr) return;
    var host = card.querySelector('.preview');
    if (!host || !card.getAttribute('data-src')) return;
    fr = document.createElement('iframe');
    fr.setAttribute('scrolling', 'no');
    fr.setAttribute('tabindex', '-1');
    fr.setAttribute('title', card.getAttribute('data-name') + ' preview');
    host.appendChild(fr);
    fr.src = card.getAttribute('data-src');
    card.classList.add('has-frame');
    fit();
    live.push(card);
  }
  function unmount(card) {
    var fr = card.querySelector('iframe');
    if (!fr) return;
    fr.removeAttribute('src');
    fr.remove();
    card.classList.remove('has-frame');
    var at = live.indexOf(card);
    if (at >= 0) live.splice(at, 1);
  }
  /* IntersectionObserver only fires when intersection CHANGES, and while nine
     iframe documents are loading its batches can go stale — a row scrolled into
     view then had no reason to be looked at again and sat on "loading preview".
     Re-run the reconciliation on scroll as well; sync() is idempotent. */
  var scrollQueued = false;
  addEventListener('scroll', function () {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () { scrollQueued = false; sync(); });
  }, { passive: true });

  /* Which cards are on screen right now, and which have a live document.
     Mounting is reconciled from these two sets rather than straight from the
     observer entries: handling "enter" before "leave" in the same batch meant a
     card arriving while the cap was full was skipped and then never retried, so
     a scrolled-into-view row could sit on "loading preview" forever. */
  var visible = [];
  function sync() {
    for (var i = live.length - 1; i >= 0; i--) {
      if (visible.indexOf(live[i]) < 0) unmount(live[i]);
    }
    /* Fill the cap by true visibility first. Sorting only by rect.top let cards
       sitting in the 250px pre-load band above the viewport take slots that
       on-screen cards needed, so a fully visible row could still read
       "loading preview". */
    visible.sort(function (a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      var ia = (ra.bottom > 0 && ra.top < innerHeight) ? 0 : 1;
      var ib = (rb.bottom > 0 && rb.top < innerHeight) ? 0 : 1;
      if (ia !== ib) return ia - ib;
      return ra.top - rb.top;
    });
    for (var j = 0; j < visible.length && live.length < MAX_LIVE; j++) mount(visible[j]);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var card = entries[i].target;
        var at = visible.indexOf(card);
        if (entries[i].isIntersecting && !card.hidden) { if (at < 0) visible.push(card); }
        else if (at >= 0) visible.splice(at, 1);
      }
      sync();
    }, { rootMargin: '250px 0px' });
    cards.forEach(function (c) { io.observe(c); });
  } else {
    cards.slice(0, MAX_LIVE).forEach(mount);
  }

  /* ── neighbour ripple ────────────────────────────────────────────────────
     ":hover ~ sibling" cannot express "the neighbours of this card" in a
     wrapping grid, so adjacency is measured from layout and the response is
     written back as per-card custom properties. */
  var adj = [];
  function buildAdjacency() {
    var rows = [], byTop = {};
    for (var i = 0; i < cards.length; i++) {
      var top = Math.round(cards[i].offsetTop / 4) * 4;   // tolerate subpixel drift
      if (!byTop[top]) { byTop[top] = []; rows.push(byTop[top]); }
      byTop[top].push(i);
    }
    adj = [];
    for (var i = 0; i < cards.length; i++) {
      var r = rows.filter(function (x) { return x.indexOf(i) >= 0; })[0];
      var idx = rows.indexOf(r), near = [];
      if (r.indexOf(i) > 0) near.push(r[r.indexOf(i) - 1]);
      if (r.indexOf(i) < r.length - 1) near.push(r[r.indexOf(i) + 1]);
      var col = r.indexOf(i);
      if (idx > 0) {
        var up = rows[idx - 1];
        if (up[Math.max(0, col - 1)] !== undefined) near.push(up[Math.max(0, col - 1)]);
        if (up[col + 1] !== undefined) near.push(up[col + 1]);
        if (up[col] !== undefined) near.push(up[col]);
      }
      if (idx < rows.length - 1) {
        var dn = rows[idx + 1];
        if (dn[Math.max(0, col - 1)] !== undefined) near.push(dn[Math.max(0, col - 1)]);
        if (dn[col + 1] !== undefined) near.push(dn[col + 1]);
        if (dn[col] !== undefined) near.push(dn[col]);
      }
      adj[i] = near.filter(function (n) { return n !== i; });
    }
  }
  function distances(from) {
    var d = [], q = [from];
    for (var i = 0; i < cards.length; i++) d[i] = Infinity;
    d[from] = 0;
    while (q.length) {
      var cur = q.shift();
      var nb = adj[cur] || [];
      for (var j = 0; j < nb.length; j++) {
        if (d[nb[j]] > d[cur] + 1) { d[nb[j]] = d[cur] + 1; q.push(nb[j]); }
      }
    }
    return d;
  }
  var pending = null, queued = false;
  function paint() {
    queued = false;
    var d = pending;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], st = d ? d[i] : null;
      c.style.setProperty('--w', st ? st.w : 0);
      c.style.setProperty('--dx', (st ? st.dx : 0) + 'px');
      c.style.setProperty('--dy', (st ? st.dy : 0) + 'px');
      c.style.setProperty('--dim', st ? st.dim : 0);
    }
  }
  function schedule(map) { pending = map; if (!queued) { queued = true; requestAnimationFrame(paint); } }
  function hover(src) {
    if (reduce) return;
    var a = src.getBoundingClientRect();
    var acx = a.left + a.width / 2, acy = a.top + a.height / 2;
    var d = distances(cards.indexOf(src)), map = [];
    for (var i = 0; i < cards.length; i++) {
      if (!isFinite(d[i])) { map[i] = { w: 0, dx: 0, dy: 0, dim: 1 }; continue; }
      var b = cards[i].getBoundingClientRect();
      var dx = (acx - (b.left + b.width / 2)), dy = (acy - (b.top + b.height / 2));
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      /* Explicit ring weights rather than an exponential decay: at LAMBDA 1.35 a
         card four hops away still sat at w=0.05, so the whole page shimmered and
         it read as a global hover rather than a neighbourhood. */
      var w = d[i] === 0 ? 1 : (d[i] === 1 ? 1 : (d[i] === 2 ? 0.35 : 0));
      var pull = d[i] === 0 ? 0 : (d[i] === 1 ? 10 : (d[i] === 2 ? 4 : 0));
      // Beyond the second ring a card recedes instead of reacting, so the
      // hovered one and its neighbours read as one connected surface.
      map[i] = { w: w, dx: (dx / len) * pull, dy: (dy / len) * pull, dim: d[i] > 2 ? 1 : 0 };
    }
    src.classList.add('is-focus');
    schedule(map);
  }
  function clear() {
    var src = grid.querySelector('.card.is-focus');
    if (src) src.classList.remove('is-focus');
    schedule(null);
  }
  for (var i = 0; i < cards.length; i++) {
    cards[i].addEventListener('pointerenter', function (e) { hover(e.currentTarget); });
    cards[i].addEventListener('pointerleave', clear);
    cards[i].addEventListener('focus', function (e) { hover(e.currentTarget); });
    cards[i].addEventListener('blur', clear);
  }

  /* ── filtering ─────────────────────────────────────────────────────────── */
  var q = document.getElementById('q'), chips = [].slice.call(document.querySelectorAll('.fam'));
  var fam = 'all';
  function apply() {
    var needle = (q.value || '').toLowerCase().trim();
    var shown = 0;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var hay = (c.getAttribute('data-name') + ' ' + c.getAttribute('data-desc') + ' ' + c.getAttribute('data-era')).toLowerCase();
      var ok = (fam === 'all' || c.getAttribute('data-family') === fam) && (!needle || hay.indexOf(needle) >= 0);
      c.hidden = !ok;
      var at = visible.indexOf(c);
      if (ok) {
        shown++;
        if (at < 0) visible.push(c);
      } else {
        if (at >= 0) visible.splice(at, 1);
        unmount(c);
      }
    }
    document.getElementById('count').textContent = shown;
    document.getElementById('empty').hidden = shown !== 0;
    sync();
    requestAnimationFrame(function () { buildAdjacency(); fit(); });
  }
  q.addEventListener('input', apply);
  chips.forEach(function (ch) {
    ch.addEventListener('click', function () {
      chips.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      ch.setAttribute('aria-pressed', 'true');
      fam = ch.getAttribute('data-family');
      apply();
    });
  });

  /* Layout changes reflow the grid, so adjacency is rebuilt with it. */
  if ('ResizeObserver' in window) {
    var raf = 0;
    new ResizeObserver(function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { buildAdjacency(); fit(); });
    }).observe(grid);
  }
  addEventListener('resize', function () { buildAdjacency(); fit(); });

  buildAdjacency();
  fit();
  apply();
  document.body.classList.add('ready');
})();
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fifty-six ways to render one page — Kyoto style gallery</title>
<meta name="description" content="The same Kyoto tour page, built 56 different ways from one design-style catalogue. Compare them side by side.">
<style>
  /* The gallery is intentionally quiet: warm paper, low contrast, no ornament.
     Fifty-six loud designs are displayed on it, so it must never compete. */
  :root {
    --paper: #fbf7f0;
    --paper-deep: #f3ece1;
    --ink: #2e2a26;
    --ink-soft: #6f6457;
    --line: #e5dbcb;
    --card: #fffdf9;
    --accent: #b4653f;
    --shadow: 24px 24px -18px rgba(46, 42, 38, .18);
    --gap: clamp(1rem, 2.2vw, 1.75rem);
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 16px; line-height: 1.6;
    background-image: radial-gradient(var(--line) 0.8px, transparent 0.8px);
    background-size: 22px 22px; background-attachment: fixed;
  }
  .shell { width: 100%; max-width: 1680px; margin-inline: auto; padding-inline: clamp(1rem, 3vw, 2.5rem); }

  header.masthead { padding-block: clamp(3rem, 7vw, 6rem) clamp(1.5rem, 3vw, 2.5rem); }
  .eyebrow {
    margin: 0 0 .9rem; font-size: .75rem; letter-spacing: .18em; text-transform: uppercase;
    color: var(--accent); font-weight: 600;
  }
  h1 {
    margin: 0; font-family: ui-serif, "Iowan Old Style", Georgia, serif; font-weight: 400;
    font-size: clamp(2rem, 5vw, 3.6rem); line-height: 1.08; letter-spacing: -.015em;
    max-width: 20ch;
  }
  h1 em { font-style: italic; color: var(--accent); }
  .sub { margin: 1.1rem 0 0; max-width: 62ch; color: var(--ink-soft); font-size: 1.0625rem; }
  .sub a { color: inherit; }

  .toolbar {
    position: sticky; top: 0; z-index: 30;
    display: flex; flex-wrap: wrap; align-items: center; gap: .75rem;
    padding-block: .85rem; margin-block-end: var(--gap);
    background: color-mix(in oklab, var(--paper) 88%, transparent);
    backdrop-filter: blur(8px);
    border-block-start: 1px solid var(--line);
    border-block-end: 1px solid var(--line);
  }
  .search {
    flex: 1 1 220px; min-width: 0; font: inherit; color: inherit;
    padding: .6rem .85rem; border: 1px solid var(--line); border-radius: 999px;
    background: var(--card);
  }
  .search:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .fams { display: flex; flex-wrap: wrap; gap: .4rem; }
  .fam {
    font: inherit; font-size: .8125rem; cursor: pointer;
    padding: .42rem .8rem; border-radius: 999px;
    border: 1px solid var(--line); background: transparent; color: var(--ink-soft);
  }
  .fam:hover { border-color: var(--accent); color: var(--ink); }
  .fam[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .tally { font-size: .8125rem; color: var(--ink-soft); white-space: nowrap; margin-inline-start: auto; }
  .tally b { color: var(--ink); font-weight: 600; }

  #grid {
    display: grid; gap: var(--gap); padding-block-end: 4rem;
    grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
  }
  @media (min-width: 1240px) { #grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

  /* The ripple arrives as --w (0..1 proximity to the hovered card) and a small
     pull vector toward it. Nothing here is hover-only, so keyboard focus works. */
  .card {
    position: relative; display: flex; flex-direction: column; gap: 0;
    margin: 0; text-decoration: none; color: inherit; border-radius: 14px;
    background: var(--card);
    border: 1px solid var(--line);
    box-shadow: 0 1px 0 rgba(46, 42, 38, .04);
    transform: translate3d(var(--dx, 0px), calc(var(--dy, 0px) - (var(--w, 0) * 6px)), 0)
               scale(calc(1 + .012 * var(--w, 0)));
    transition: box-shadow .32s ease, border-color .32s ease, transform .42s cubic-bezier(.22, 1, .36, 1), opacity .32s ease;
    opacity: calc(1 - .3 * (1 - min(1, var(--w, 0))) * var(--dim, 0));
    will-change: transform;
  }
  .card.is-focus { border-color: var(--accent); box-shadow: var(--shadow); }
  .card:has(:focus-visible) { border-color: var(--accent); box-shadow: var(--shadow); }
  .card[hidden] { display: none; }

  .preview {
    position: relative; overflow: hidden; aspect-ratio: 16 / 10;
    background: var(--paper-deep);
    border-radius: 13px 13px 0 0;
    border-block-end: 1px solid var(--line);
  }
  .preview::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(to bottom, transparent 62%, rgba(251, 247, 240, .9) 100%);
    opacity: .55; transition: opacity .32s ease;
  }
  .card.is-focus .preview::after { opacity: 0; }
  .preview iframe {
    position: absolute; top: 0; left: 0; width: 1440px; height: 900px;
    border: 0; transform-origin: top left; pointer-events: none;
    background: #fff;
  }
  .preview .pending {
    position: absolute; inset: 0; display: grid; place-content: center; gap: .35rem;
    font-size: .75rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft);
  }
  .card.has-frame .pending { display: none; }
  .body { padding: 1rem 1.15rem 1.2rem; display: flex; flex-direction: column; gap: .4rem; }
  .name { font-family: ui-serif, "Iowan Old Style", Georgia, serif; font-size: 1.1875rem; line-height: 1.25; margin: 0; }
  .desc { margin: 0; font-size: .8125rem; line-height: 1.55; color: var(--ink-soft); }
  .tags { display: flex; flex-wrap: wrap; gap: .3rem; margin-block-start: .35rem; }
  .tag {
    font-size: .6875rem; letter-spacing: .04em; padding: .18rem .5rem; border-radius: 999px;
    border: 1px solid var(--line); color: var(--ink-soft); background: var(--paper);
  }
  .open {
    display: inline-flex; align-items: center; gap: .35rem;
    margin-block-start: .6rem; font-size: .8125rem; font-weight: 600; color: var(--accent);
  }
  .open::after { content: "→"; transition: transform .3s ease; }
  .card.is-focus .open::after, .card:hover .open::after { transform: translateX(.25rem); }

  #empty { padding: 4rem 0; text-align: center; color: var(--ink-soft); }
  footer.colo { padding-block: 2.5rem 4rem; border-block-start: 1px solid var(--line); color: var(--ink-soft); font-size: .8125rem; }
  footer.colo p { margin: 0 0 .4rem; max-width: 78ch; }
  .noscript { padding: 1rem; border: 1px dashed var(--line); border-radius: 10px; color: var(--ink-soft); }
  @media (prefers-reduced-motion: reduce) {
    .card, .open::after, .preview::after { transition: none; }
    .card { transform: none; opacity: 1; }
  }
</style>
</head>
<body>
<div class="shell">

  <header class="masthead">
    <p class="eyebrow">One page · fifty-six interpretations</p>
    <h1>The same Kyoto tour, rendered in every style <em>we could find a specification for</em></h1>
    <p class="sub">
      Each card below is a <strong>live page</strong>, scaled down — not a screenshot. Every one of
      them contains identical wording and identical photographs, so the only thing changing from card
      to card is the design style. Built from the ${cards.length}-row General and Landing-Page section
      of <code>styles.csv</code>; each row was handed to an independent agent as its only brief.
    </p>
  </header>

  <div class="toolbar">
    <input id="q" class="search" type="search" aria-label="Filter designs by name, keyword or era" placeholder="Filter by name, keyword or era…" autocomplete="off">
    <div class="fams" role="group" aria-label="Filter by family">
      <button class="fam" data-family="all" aria-pressed="true">All</button>
      <button class="fam" data-family="General" aria-pressed="false">General</button>
      <button class="fam" data-family="Landing Page" aria-pressed="false">Landing page</button>
    </div>
    <p class="tally"><b><span id="count">${cards.length}</span></b> shown · ${present} built</p>
  </div>

  <div id="grid">
${cards.map((c) => `    <a class="card" href="subagents/${c.id}.html" target="_blank" rel="opener"
       data-src="subagents/${c.id}.html?thumb=1" data-name="${c.name.replace(/"/g, '&quot;')}"
       data-desc="${c.desc.replace(/"/g, '&quot;')}" data-era="${c.era.replace(/"/g, '&quot;')}"
       data-family="${c.type}">
      <span class="preview"><span class="pending">loading preview</span></span>
      <span class="body">
        <span class="name">${c.name}</span>
        <span class="desc">${c.desc}</span>
        <span class="tags"><span class="tag">${c.era}</span><span class="tag">${c.complexity}</span><span class="tag">${c.type}</span></span>
        <span class="open">Open full page</span>
      </span>
    </a>`).join('\n')}
    <p id="empty" hidden>Nothing matches that filter.</p>
  </div>

  <noscript><p class="noscript">The previews need JavaScript. Every design is still reachable directly from <code>subagents/</code>.</p></noscript>

  <footer class="colo">
    <p><strong>Why they are comparable.</strong> The content of all ${cards.length} pages is generated from one
    canonical skeleton, and a Playwright pass proves every page carries the same 91 strings, the same 12
    photographs and the same six sections at three screen widths, in both themes.</p>
    <p>Photographs are Wikimedia Commons files used under their original licences.</p>
  </footer>

</div>
<script>${JS}</script>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`master.html ← ${cards.length} styles (${present} with a built page) · ${(html.length / 1024).toFixed(0)} KB`);
