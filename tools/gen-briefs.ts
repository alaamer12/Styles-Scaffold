#!/usr/bin/env bun
/**
 * Generates one brief per style from styles.csv.
 *
 * Each brief follows brief structure of the `subagent` skill — Context
 * (Root › Role › Domain) · Goal · How · Autonomy Bounds · Output Contract — and
 * carries ONLY the domain slice for that style. Shared rules are referenced,
 * never copied, so there is one home for each and a rule change cannot half
 * apply across 56 files.
 *
 *   bun styles-scaffold/tools/gen-briefs.ts
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(import.meta.path), '..');
const CSV = join(ROOT, '..', 'styles.csv');
const OUT = join(ROOT, 'brief', 'per-style');
const DIFF = JSON.parse(readFileSync(join(ROOT, 'brief', 'differentiation.json'), 'utf8'));
const IN_SCOPE = new Set(['General', 'Landing Page']);

/** Minimal RFC-4180 reader — the CSV has quoted fields containing commas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
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
const at = (name: string) => {
  const i = head.indexOf(name);
  if (i < 0) throw new Error(`styles.csv has no column "${name}"`);
  return i;
};

const AUTONOMY = `You are an executor, not a decision-maker.
- If a genuine choice appears, implement the closest legal option and describe the tension in your receipt. Do not stop and wait.
- Do not expand scope. Do not touch any file other than your own output file.
- Do not invent requirements, copy, sections, imagery, or product decisions.
- Do not "improve" the shared content, the skeleton, the manifest, or another style's file.`;

const RECEIPT = `Return AT MOST 10 short lines. The file on disk is the evidence and
\`bun styles-scaffold/tools/verify.ts ${'${id}'}\` is the proof — do NOT paste your
HTML, your CSS, tool output, or a narrative. Required lines:

1. file: <path> · <line count> lines · <KB>
2. style: <how you expressed the style in one line>
3. tier0: "91/91 strings, 12/12 images, 6 sections in order" (as you achieved it)
4. deviation: none | the exact data-dom-deviation value you declared
5. x-control: none | list of interactive nodes you added, and what each replaces
6. checklist: which of your style's Implementation Checklist items you met, and any you could not
7. self-check: the output of the verify command above, and whether you fixed what it flagged
8. unresolved: anything you had to guess, or a rule that fought the style`;

mkdirSync(OUT, { recursive: true });
for (const stale of ['README.md']) rmSync(join(OUT, stale), { force: true });

const made: { id: string; name: string; type: string }[] = [];
const warnings: string[] = [];

for (const r of rows.slice(1)) {
  const type = r[at('Type')].trim();
  if (!IN_SCOPE.has(type)) continue;
  const id = r[at('Style ID')].trim();
  const name = r[at('Style Category')].trim();
  if (!id) { warnings.push(`row without Style ID: ${name}`); continue; }

  const lever = (DIFF[id] || '').trim();
  if (!lever && !id.startsWith('_')) warnings.push(`no differentiation lever for ${id}`);

  const spec = [
    ['Keywords', 'Keywords'],
    ['Primary colours', 'Primary Colors'],
    ['Secondary colours', 'Secondary Colors'],
    ['Effects & animation', 'Effects & Animation'],
    ['Best for', 'Best For'],
    ['Avoid for', 'Do Not Use For'],
    ['Performance', 'Performance'],
    ['Accessibility', 'Accessibility'],
    ['Mobile-friendly', 'Mobile-Friendly'],
    ['Complexity', 'Complexity'],
    ['Framework compatibility', 'Framework Compatibility'],
    ['Era / origin', 'Era/Origin'],
    ['AI prompt keywords', 'AI Prompt Keywords'],
    ['CSS / technical keywords', 'CSS/Technical Keywords'],
    ['Design system variables', 'Design System Variables'],
  ].map(([label, col]) => `- **${label}:** ${r[at(col)].trim() || '—'}`).join('\n');

  const checklist = r[at('Implementation Checklist')].trim();

  writeFileSync(join(OUT, `${id}.md`), `# Sub-Agent Brief — ${name}

## 1. Context

### Root
Read these two files **before** you write anything; they bind every one of the 56
agents equally and are not reproduced here:

- \`styles-scaffold/brief/ROOT.md\` — shared non-negotiables
- \`styles-scaffold/brief/dom-contract.md\` — exactly what you may change

### Role
You are one of 56 style agents. Each of you receives the same Kyoto page and a
different design style. Your pages will be displayed side by side as live
thumbnails in \`styles-scaffold/master.html\`, so your work is judged by eye
against 55 siblings — including several styles close to yours.

A style here is not a mood to hint at. It is a set of decisions — surface, depth,
edge, colour, type scale, motion, spacing, ornament — that a viewer should be able
to name from the screen alone, at thumbnail size, in under a second.

### Domain — your style specification
Verbatim row \`${r[at('No')]}\` of \`styles.csv\`. This is your source of truth; where
it gives values, use them rather than inventing your own.

${spec}

**Implementation checklist (report against this in your receipt):**
${checklist.split(', ☐').map((s) => `- ${s.replace(/^☐\s*/, '').trim()}`).join('\n')}

**Read the two fields above carefully — they are descriptive, not permissive.**
\`Framework compatibility\` lists what this style is usually built with in the wild.
**You may not use any of it.** No library, CDN or build step is available here
(ROOT.md §5), so a named technique like GSAP ScrollTrigger, SplitText, Three.js or
\`model-viewer\` must be reproduced with plain CSS and vanilla JS — IntersectionObserver
for scroll triggers, hand-written spans for split text, CSS \`scroll-behavior\` and
\`@keyframes\` for choreography. Name the effect, build it yourself.

**Differentiation — why you must not look like your siblings**
${lever || '_No twin assigned; render this style faithfully._'}

**Starting point** — copy this file and rewrite its presentation layer:
\`styles-scaffold/content/skeleton.html\`
Its baseline CSS is deliberately plain so no page can look broken; it also carries
the canonical \`--c-*\` tokens, the three responsive bands, the theme toggle and the
\`?thumb=1\` image deferral. \`content/content.manifest.json\` lists the 91 pinned
strings and 12 image slots you must preserve.

## 2. Goal
Produce \`styles-scaffold/subagents/${id}.html\`: the canonical Kyoto page rendered unmistakably in the **${name}** style, responsive at 375/768/1440 with both themes fully painted and no horizontal overflow, with every Tier-0 string, image and section intact.

## 3. How

**Allowed tools / skills**
- Read the two brief files and the skeleton before editing.
- Write / Edit exactly one file: \`subagents/${id}.html\`.
- You may run \`bun styles-scaffold/tools/verify.ts ${id}\` and iterate on it.

**Required process**
1. Read \`brief/ROOT.md\` and \`brief/dom-contract.md\`.
2. Read \`content/skeleton.html\` in full — especially its CSS custom properties and its final \`<script>\`.
3. Copy it to \`subagents/${id}.html\`.
4. Replace the presentation layer for your style: the \`--c-*\` token values, then
   typography, spacing scale, surfaces, edges, depth, borders, motion. Aim for the
   style's *mechanism*, not a decorative coat — pick the two or three techniques
   your row names as essential and commit to them fully.
5. Add style-appropriate Tier-2 decoration (\`aria-hidden="true"\` + \`x-\` class).
6. If you need interactive DOM your style genuinely requires, use the escape
   hatch: \`data-x-control="${id}"\`, additive only, declared on \`<html data-dom-deviation="…">\`.
7. Run the verifier. Fix everything it reports. Run it again. Ship only when it
   passes, or when the sole remaining reason is something the contract forbids.

**Hard boundaries**
- You may operate only inside \`styles-scaffold/subagents/${id}.html\`.
- **Never run \`rm\`, \`mv\`, \`git checkout\`, \`git reset\`, \`git clean\` or any delete.** You
  share this checkout with ~17 sibling agents; \`scratch/\` and every directory above
  are read-only to you. Leave any temp file you create — deleting is not your call.
- Never edit the skeleton, manifest, briefs, tooling, another style's file, or \`styles.csv\`.
- No frameworks, no build step, no CSS/JS CDN, no new images, no new copy.
- Do not add a \`<script>\` that runs ungated in \`?thumb=1\` mode.

## 4. Autonomy Bounds
${AUTONOMY}

## 5. Output Contract
${RECEIPT.replace('${id}', id)}
`);
  made.push({ id, name, type });
}

writeFileSync(join(ROOT, 'brief', 'styles.index.json'), JSON.stringify(made, null, 2) + '\n');
console.log(`wrote ${made.length} briefs → styles-scaffold/brief/per-style/`);
if (warnings.length) {
  console.log('\nwarnings:');
  for (const w of warnings) console.log('  · ' + w);
}
