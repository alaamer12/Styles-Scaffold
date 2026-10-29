# ROOT — shared rules for all 56 style agents

Read this before your per-style brief. These are not suggestions; every agent
gets the same file and the same rules, and that is the only reason the 56
results are comparable.

## What this project is

`styles-scaffold/` renders **one identical web page** in **56 different design
styles**, so a human can compare styles visually. The Kyoto content is fixed and
shared. **Your style is the only variable.** If two style pages differ in wording,
photos or section order, the comparison is ruined — that is treated as a defect,
not a stylistic choice.

## Your one job

Copy `content/skeleton.html` to `subagents/<your-style-id>.html`, then rewrite its
**presentation layer** so the page embodies your assigned style. You are a
stylist working on a fixed manuscript, not an author.

## The skeleton is load-bearing — keep these intact

| Thing | Why |
|---|---|
| Every `data-tid` element and its text | 91 pinned strings are diffed against `content.manifest.json`. Rewriting copy is the #1 failure. |
| Every `data-slot` `<img>` + its `src` | 12 photos, all verified live. Same image in every page. |
| The 6 `<section>` ids in order — `hero` `highlights` `itinerary` `gallery` `reviews` `booking` | Structure the eye compares. |
| `#booking` control `name`/`id` values | Must stay present and keyboard-reachable. |
| The final `<script>` (theme + `?thumb=1` deferral) | The gallery depends on it. Put your JS in a **separate** script tag below it. |
| The `--c-*` colour tokens | Both themes must define the **same set**. Revalue freely; never drop or add on one side. |

You may restyle all of it — change every value, rule and layout. You may not
rename or remove the hooks above.

## Non-negotiables

1. **Responsive at three bands**, mobile-first: `375` (mobile), `768` (tablet),
   `1024`+ (desktop). **No horizontal scrolling at any of the three** — this is
   checked by machine and is the most common way a hand-written style fails.
2. **Both themes work.** `[data-theme="light"]` and `[data-theme="dark"]` must
   each paint the whole page. A dark theme that looks like light is a failure.
3. **Guard every animation.** Any `requestAnimationFrame`, canvas, WebGL, cursor
   trail or scroll loop must no-op when `window.STYLE_SCAFFOLD_THUMB` is true, and
   must respect `prefers-reduced-motion`. The gallery shows 56 live documents at
   once; an ungated loop makes it unusable.
4. **Keep a visible keyboard focus ring** on links, buttons and form controls.
5. **No build step, no framework, no bundler.** One self-contained HTML file that
   opens from `file://`. Inline `<style>` and `<script>` only.
   **No CSS/JS CDN.** The one exception: a Google Fonts `<link>` is allowed if
   typography is genuinely essential to your style — always with a local fallback
   stack in `font-family` so the page still renders correctly offline.
6. **Do not invent requirements.** If your style seems to need something these
   rules forbid, implement the closest legal version and report the tension in
   your receipt. Do not silently break a rule to win an argument.

## Safety — read this, it is the reason 56 agents can run at once

7. **You share this checkout with ~17 other agents.** Never run `rm`, `mv`,
   `git checkout`, `git reset`, `git clean`, or any delete. Write **only** your
   own file, `subagents/<your-id>.html`. `scratch/`, `content/`, `brief/`, `tools/`
   and every other style's file are read-only to you. If you create a temp file,
   leave it — deleting is not your call.
   *(A prior run deleted `scratch/`, destroying 295 files of unrelated work.)*
8. **Where your CSV row gives a value that is unusable, deviate minimally and say
   so.** Some rows list hexes that fail their own stated contrast requirement, or
   name a colour with no hex at all. Fix the value to the nearest thing that works
   and record it under `unresolved` — do not silently invent, and do not ship a
   broken literal.

9. **Respect the machine.** This box has 2 CPUs and ~1.9 GB free while ~8 agents
   run at once, and several pages crashed headless Chromium with a full-viewport
   `backdrop-filter` combined with `will-change` or many `position: fixed` layers.
   Blur what you must, but keep composited layers bounded (a handful, not dozens),
   and prefer a `box-shadow`/gradient over a page-wide blur where the style allows.
   If your own `verify.ts` run reports `Target crashed`, that is this rule, not bad
   luck — reduce layer count rather than retrying.

## Shape target

**700–1300 lines.** The shared body markup and canonical script are ~330 fixed
lines, so a real three-band × two-theme styling system lands near 1000. A 60-line
answer means the style was barely applied; a 2500-line answer means you stopped
editing and started performing.

See `brief/dom-contract.md` for exactly how far you may change the DOM.
