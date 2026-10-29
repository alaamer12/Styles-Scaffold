#!/usr/bin/env bun
/**
 * Derives content/content.manifest.json from content/skeleton.html.
 *
 * The manifest is GENERATED, never hand-written: a second authored copy of the
 * same strings is a drift bug waiting to happen, and this file is the thing all
 * 56 verifier runs compare against.
 *
 *   bun styles-scaffold/tools/gen-manifest.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SKELETON = join(dirname(import.meta.path), '..', 'content', 'skeleton.html');
const OUT = join(dirname(SKELETON), 'content.manifest.json');

/** Text the canonical runtime script rewrites at load, so it can't be pinned. */
const MUTABLE = new Set(['theme.label']);

const SECTIONS = ['hero', 'highlights', 'itinerary', 'gallery', 'reviews', 'booking'];

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Decode only the entities actually used in the copy, for stable comparison. */
const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

const html = readFileSync(SKELETON, 'utf8');

// ── text nodes: every element whose data-tid wraps plain text only ──────────
const texts: Record<string, { value: string; tag: string; mutable?: boolean }> = {};
for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*?)\bdata-tid="([^"]+)"[^>]*>([^<]*)</g)) {
  const [, tag, , tid, raw] = m;
  texts[tid] = { tag, value: norm(decode(raw)), ...(MUTABLE.has(tid) ? { mutable: true } : {}) };
}

// ── images: every <img> with a data-slot ────────────────────────────────────
type Img = { slot: string; src: string; alt: string; lazy: boolean };
const images: Img[] = [];
for (const m of html.matchAll(/<img\b([^>]*)>/g)) {
  const attrs = m[1];
  const get = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? '';
  const slot = get('data-slot');
  if (!slot) continue;
  images.push({ slot, src: get('src'), alt: norm(decode(get('alt'))), lazy: /\bloading="lazy"/.test(attrs) });
}

// ── structure ───────────────────────────────────────────────────────────────
const foundSections = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
const chrome = [...html.matchAll(/<(?:header|footer)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
const controls = [...html.matchAll(/<input\b[^>]*\bname="([^"]+)"/g)]
  .map((m) => m[1])
  .concat([...html.matchAll(/<select\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]));

// ── integrity guards on the generator itself ────────────────────────────────
const problems: string[] = [];
if (JSON.stringify(foundSections) !== JSON.stringify(SECTIONS)) {
  problems.push(`section order ${JSON.stringify(foundSections)} != ${JSON.stringify(SECTIONS)}`);
}
const tids = Object.keys(texts);
const dupTid = tids.filter((t, i) => tids.indexOf(t) !== i);
if (dupTid.length) problems.push(`duplicate data-tid: ${[...new Set(dupTid)].join(', ')}`);
const slots = images.map((i) => i.slot);
if (new Set(slots).size !== slots.length) problems.push('duplicate data-slot');
if (slots.length !== 12) problems.push(`expected 12 image slots, found ${slots.length}`);
// An <img src> without loading=lazy will be fetched by every thumbnail iframe.
const eager = images.filter((i) => !i.lazy).map((i) => i.slot);
if (eager.length !== 1 || eager[0] !== 'temple') problems.push(`hero must be the only eager image, got: ${eager.join(', ') || 'none'}`);
const noAlt = images.filter((i) => !i.alt).map((i) => i.slot);
if (noAlt.length) problems.push(`images missing alt: ${noAlt.join(', ')}`);

writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedFrom: 'content/skeleton.html',
      title: 'Kyoto in Seven Days',
      sections: SECTIONS,
      chrome,
      formControls: [...new Set(controls)].sort(),
      imageSlots: images,
      text: texts,
    },
    null,
    2,
  ) + '\n',
);

console.log(`sections   ${foundSections.join(' › ')}`);
console.log(`text nodes ${tids.length}  (pinned ${tids.filter((t) => !MUTABLE.has(t)).length}, mutable ${MUTABLE.size})`);
console.log(`images     ${images.length} slots, ${eager.join(',') || 'none'} eager`);
console.log(`controls   ${[...new Set(controls)].sort().join(', ')}`);
if (problems.length) {
  console.error('\nMANIFEST PROBLEMS:');
  for (const p of problems) console.error('  · ' + p);
  process.exit(1);
}
console.log(`\n→ ${OUT.replace(process.cwd() + '/', '')}`);
