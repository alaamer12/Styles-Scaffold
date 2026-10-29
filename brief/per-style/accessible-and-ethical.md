# Sub-Agent Brief — Accessible & Ethical

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
Verbatim row `8` of `styles.csv`. This is your source of truth; where
it gives values, use them rather than inventing your own.

- **Keywords:** Accessible, inclusive interface, high contrast, large text (16px+), keyboard navigation, screen reader friendly, accessibility standards aware, focus state, semantic
- **Primary colours:** Measured high-contrast pairs (4.5:1 normal-text baseline; 7:1 enhanced target), simple primary, clear secondary, high luminosity (7:1+)
- **Secondary colours:** Symbol-based colors (not color-only), supporting patterns, inclusive combinations
- **Effects & animation:** Clear focus rings (3-4px), ARIA labels, skip links, responsive design, reduced motion, 44x44px touch targets
- **Best for:** Government, healthcare, education, inclusive products, large audience, legal compliance, public
- **Avoid for:** None - accessibility universal
- **Performance:** cost:low|drivers:none
- **Accessibility:** risk:low|requires:contrast-text-4.5,keyboard,visible-focus,reduced-motion
- **Mobile-friendly:** adaptable
- **Complexity:** Low
- **Framework compatibility:** css
- **Era / origin:** Universal
- **AI prompt keywords:** Design toward enhanced accessibility criteria; verify complete-page conformance. Include: high contrast (7:1+), large text (16px+), keyboard navigation, screen reader compatibility, focus states visible (3-4px ring), semantic HTML, ARIA labels, skip links, reduced motion support (prefers-reduced-motion), 44x44px touch targets.
- **CSS / technical keywords:** color-contrast: 7:1+, font-size: 16px+, outline: 3-4px on :focus-visible, aria-label, role attributes, @media (prefers-reduced-motion), touch-target: 44x44px, cursor: pointer
- **Design system variables:** --contrast-ratio: 7:1, --font-size-min: 16px, --focus-ring: 3-4px, --touch-target: 44x44px, --wcag-target: enhanced, --keyboard-accessible: true, --sr-test-required: true

**Implementation checklist (report against this in your receipt):**
- complete-page conformance tested against the chosen target
- 7:1+ contrast checked
- Keyboard navigation tested
- Screen reader tested
- Focus visible 3-4px
- Semantic HTML used
- Touch targets 44x44px

**Read the two fields above carefully — they are descriptive, not permissive.**
`Framework compatibility` lists what this style is usually built with in the wild.
**You may not use any of it.** No library, CDN or build step is available here
(ROOT.md §5), so a named technique like GSAP ScrollTrigger, SplitText, Three.js or
`model-viewer` must be reproduced with plain CSS and vanilla JS — IntersectionObserver
for scroll triggers, hand-written spans for split text, CSS `scroll-behavior` and
`@keyframes` for choreography. Name the effect, build it yourself.

**Differentiation — why you must not look like your siblings**
Accessibility AS the design language: very high contrast, large type, obvious focus rings, generous hit areas, clear reading rhythm, honest plain language, no motion that is not meaningful. Visible affordance everywhere.

**Starting point** — copy this file and rewrite its presentation layer:
`styles-scaffold/content/skeleton.html`
Its baseline CSS is deliberately plain so no page can look broken; it also carries
the canonical `--c-*` tokens, the three responsive bands, the theme toggle and the
`?thumb=1` image deferral. `content/content.manifest.json` lists the 91 pinned
strings and 12 image slots you must preserve.

## 2. Goal
Produce `styles-scaffold/subagents/accessible-and-ethical.html`: the canonical Kyoto page rendered unmistakably in the **Accessible & Ethical** style, responsive at 375/768/1440 with both themes fully painted and no horizontal overflow, with every Tier-0 string, image and section intact.

## 3. How

**Allowed tools / skills**
- Read the two brief files and the skeleton before editing.
- Write / Edit exactly one file: `subagents/accessible-and-ethical.html`.
- You may run `bun styles-scaffold/tools/verify.ts accessible-and-ethical` and iterate on it.

**Required process**
1. Read `brief/ROOT.md` and `brief/dom-contract.md`.
2. Read `content/skeleton.html` in full — especially its CSS custom properties and its final `<script>`.
3. Copy it to `subagents/accessible-and-ethical.html`.
4. Replace the presentation layer for your style: the `--c-*` token values, then
   typography, spacing scale, surfaces, edges, depth, borders, motion. Aim for the
   style's *mechanism*, not a decorative coat — pick the two or three techniques
   your row names as essential and commit to them fully.
5. Add style-appropriate Tier-2 decoration (`aria-hidden="true"` + `x-` class).
6. If you need interactive DOM your style genuinely requires, use the escape
   hatch: `data-x-control="accessible-and-ethical"`, additive only, declared on `<html data-dom-deviation="…">`.
7. Run the verifier. Fix everything it reports. Run it again. Ship only when it
   passes, or when the sole remaining reason is something the contract forbids.

**Hard boundaries**
- You may operate only inside `styles-scaffold/subagents/accessible-and-ethical.html`.
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
`bun styles-scaffold/tools/verify.ts accessible-and-ethical` is the proof — do NOT paste your
HTML, your CSS, tool output, or a narrative. Required lines:

1. file: <path> · <line count> lines · <KB>
2. style: <how you expressed the style in one line>
3. tier0: "91/91 strings, 12/12 images, 6 sections in order" (as you achieved it)
4. deviation: none | the exact data-dom-deviation value you declared
5. x-control: none | list of interactive nodes you added, and what each replaces
6. checklist: which of your style's Implementation Checklist items you met, and any you could not
7. self-check: the output of the verify command above, and whether you fixed what it flagged
8. unresolved: anything you had to guess, or a rule that fought the style
