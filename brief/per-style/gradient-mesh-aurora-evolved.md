# Sub-Agent Brief — Gradient Mesh / Aurora Evolved

## 1. Context

### Root
Read these two files **before** you write anything; they bind every one of the 56
agents equally and are not reproduced here:

- `styles-scaffold/brief/ROOT.md` — shared non-negotiables
- `styles-scaffold/brief/dom-contract.md` — exactly what you may change

### Role
You are one of 56 style agents. Each of you receives the same Kyoto page and a
different design style. Your pages will be displayed side by side as live
thumbnails in `styles-scaffold/master.html`, so your work is judged by eye
against 55 siblings — including several styles close to yours.

A style here is not a mood to hint at. It is a set of decisions — surface, depth,
edge, colour, type scale, motion, spacing, ornament — that a viewer should be able
to name from the screen alone, at thumbnail size, in under a second.

### Domain — your style specification
Verbatim row `65` of `styles.csv`. This is your source of truth; where
it gives values, use them rather than inventing your own.

- **Keywords:** Complex gradients, mesh gradients, multi-color blend, aurora effect, flowing colors, iridescent, holographic, prismatic
- **Primary colours:** Multi-stop gradients: Cyan #00FFFF, Magenta #FF00FF, Yellow #FFFF00, Blue #0066FF, Green #00FF66
- **Secondary colours:** Complementary mesh points, smooth color transitions, iridescent overlays, chromatic shifts
- **Effects & animation:** CSS mesh-gradient (experimental), SVG gradients, canvas gradients, smooth color morphing, flowing animation
- **Best for:** Hero sections, backgrounds, creative brands, music platforms, fashion, lifestyle, premium products
- **Avoid for:** Data interfaces, text-heavy content, accessibility-critical, conservative brands
- **Performance:** cost:low|drivers:none
- **Accessibility:** risk:conditional|requires:contrast-text-4.5,keyboard,visible-focus,reduced-motion
- **Mobile-friendly:** adaptable
- **Complexity:** Medium
- **Framework compatibility:** css|svg|canvas
- **Era / origin:** 2025+ Gradient Evolution
- **AI prompt keywords:** Design with gradient mesh aurora effect. Use: multi-color mesh gradients, flowing color transitions, aurora/northern lights feel, iridescent overlays, holographic shimmer, prismatic effects, smooth color morphing.
- **CSS / technical keywords:** background: conic-gradient or mesh (SVG), animation: gradient flow (background-position), filter: hue-rotate for shimmer, mix-blend-mode: screen, canvas for complex mesh, multiple gradient layers
- **Design system variables:** --mesh-color-1: #00FFFF, --mesh-color-2: #FF00FF, --mesh-color-3: #FFFF00, --mesh-color-4: #00FF66, --flow-duration: 10s, --shimmer-intensity: 0.3

**Implementation checklist (report against this in your receipt):**
- Mesh gradient visible
- Colors flow smoothly
- Aurora effect achieved
- Performance acceptable
- Text remains readable
- Mobile renders ok

**Read the two fields above carefully — they are descriptive, not permissive.**
`Framework compatibility` lists what this style is usually built with in the wild.
**You may not use any of it.** No library, CDN or build step is available here
(ROOT.md §5), so a named technique like GSAP ScrollTrigger, SplitText, Three.js or
`model-viewer` must be reproduced with plain CSS and vanilla JS — IntersectionObserver
for scroll triggers, hand-written spans for split text, CSS `scroll-behavior` and
`@keyframes` for choreography. Name the effect, build it yourself.

**Differentiation — why you must not look like your siblings**
A still, printed gradient mesh — soft airbrushed colour transitions baked into surfaces, no animation, treated like a physical printed backdrop. Distinguished from aurora-ui by being motionless and by the mesh being part of the surface, not floating behind it.

**Starting point** — copy this file and rewrite its presentation layer:
`styles-scaffold/content/skeleton.html`
Its baseline CSS is deliberately plain so no page can look broken; it also carries
the canonical `--c-*` tokens, the three responsive bands, the theme toggle and the
`?thumb=1` image deferral. `content/content.manifest.json` lists the 91 pinned
strings and 12 image slots you must preserve.

## 2. Goal
Produce `styles-scaffold/subagents/gradient-mesh-aurora-evolved.html`: the canonical Kyoto page rendered unmistakably in the **Gradient Mesh / Aurora Evolved** style, responsive at 375/768/1440 with both themes fully painted and no horizontal overflow, with every Tier-0 string, image and section intact.

## 3. How

**Allowed tools / skills**
- Read the two brief files and the skeleton before editing.
- Write / Edit exactly one file: `subagents/gradient-mesh-aurora-evolved.html`.
- You may run `bun styles-scaffold/tools/verify.ts gradient-mesh-aurora-evolved` and iterate on it.

**Required process**
1. Read `brief/ROOT.md` and `brief/dom-contract.md`.
2. Read `content/skeleton.html` in full — especially its CSS custom properties and its final `<script>`.
3. Copy it to `subagents/gradient-mesh-aurora-evolved.html`.
4. Replace the presentation layer for your style: the `--c-*` token values, then
   typography, spacing scale, surfaces, edges, depth, borders, motion. Aim for the
   style's *mechanism*, not a decorative coat — pick the two or three techniques
   your row names as essential and commit to them fully.
5. Add style-appropriate Tier-2 decoration (`aria-hidden="true"` + `x-` class).
6. If you need interactive DOM your style genuinely requires, use the escape
   hatch: `data-x-control="gradient-mesh-aurora-evolved"`, additive only, declared on `<html data-dom-deviation="…">`.
7. Run the verifier. Fix everything it reports. Run it again. Ship only when it
   passes, or when the sole remaining reason is something the contract forbids.

**Hard boundaries**
- You may operate only inside `styles-scaffold/subagents/gradient-mesh-aurora-evolved.html`.
- **Never run `rm`, `mv`, `git checkout`, `git reset`, `git clean` or any delete.** You
  share this checkout with ~17 sibling agents; `scratch/` and every directory above
  are read-only to you. Leave any temp file you create — deleting is not your call.
- Never edit the skeleton, manifest, briefs, tooling, another style's file, or `styles.csv`.
- No frameworks, no build step, no CSS/JS CDN, no new images, no new copy.
- Do not add a `<script>` that runs ungated in `?thumb=1` mode.

## 4. Autonomy Bounds
You are an executor, not a decision-maker.
- If a genuine choice appears, implement the closest legal option and describe the tension in your receipt. Do not stop and wait.
- Do not expand scope. Do not touch any file other than your own output file.
- Do not invent requirements, copy, sections, imagery, or product decisions.
- Do not "improve" the shared content, the skeleton, the manifest, or another style's file.

## 5. Output Contract
Return AT MOST 10 short lines. The file on disk is the evidence and
`bun styles-scaffold/tools/verify.ts gradient-mesh-aurora-evolved` is the proof — do NOT paste your
HTML, your CSS, tool output, or a narrative. Required lines:

1. file: <path> · <line count> lines · <KB>
2. style: <how you expressed the style in one line>
3. tier0: "91/91 strings, 12/12 images, 6 sections in order" (as you achieved it)
4. deviation: none | the exact data-dom-deviation value you declared
5. x-control: none | list of interactive nodes you added, and what each replaces
6. checklist: which of your style's Implementation Checklist items you met, and any you could not
7. self-check: the output of the verify command above, and whether you fixed what it flagged
8. unresolved: anything you had to guess, or a rule that fought the style
