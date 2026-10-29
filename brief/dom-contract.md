# DOM contract — what you may and may not change

Three tiers, plus one escape hatch. The verifier enforces Tier 0 mechanically, so
this is not a courtesy.

## Tier 0 — immutable

Present, in this order, with unchanged text:

- the 6 section roots: `#hero` `#highlights` `#itinerary` `#gallery` `#reviews` `#booking`
- chrome: `#site-header`, `#site-footer`, `#theme-toggle`
- every `[data-tid]` node's normalised `textContent` (91 pinned strings)
- every `[data-slot]` image: its `src`, its `alt`, and that it actually loads
- `#booking` inputs/select/submit: their `name` and `id`, reachable by keyboard

Text comparison is on **normalised `textContent`**, so wrapping a headline in
per-letter `<span>`s is fine — the concatenation is what is checked. Editing the
words is not.

## Tier 1 — flexible

Anything *inside* a section: reorder children, re-grid them, promote a caption
above an image, turn the 7 day-cards into a timeline or a stack. Order of
sections themselves is fixed; order within them is yours.

## Tier 2 — free

Purely decorative additions: backdrop layers, noise, scanlines, ornaments, frame
chrome, gradient meshes, grain, guide lines. Unlimited — but each must carry
**both** `aria-hidden="true"` **and** a class beginning `x-`, so the checker can
tell decoration from content.

```html
<div class="x-grain" aria-hidden="true"></div>
```

**Carve-out — split text is not decoration.** If your style animates type
letter-by-letter or word-by-word, the wrapper spans are **Tier 0 markup**, not
Tier 2: do **not** put `aria-hidden` on them, because that deletes the page's
words from the accessibility tree. Rules for splitting:

- split **in JS at runtime**, not by hand in the markup — whitespace must come
  back as bare text nodes so normalised `textContent` is byte-identical;
- never duplicate the string elsewhere (a ticker or ghost copy of a headline
  would show the same text twice to a screen reader);
- the unsplit text must be what shows before JS runs and under reduced motion.

## The escape hatch — when your style genuinely needs new *interactive* DOM

Some styles cannot be expressed as CSS on this structure: a custom cursor needs a
tracking element, kinetic type needs wrapper nodes, a voice style wants a mic, a
3-D style wants a canvas host. You may add interactive DOM, under three conditions:

1. tag it `data-x-control="<your-style-id>"`;
2. it must be **additive** — the canonical control for that job still exists and
   is still tab-reachable. You may visually hide the booking button behind a
   summon gesture; you may not replace it with a mic and delete the button.
3. declare it on the root element:

```html
<html data-dom-deviation="cursor+voice">
```

Undeclared `data-x-control` nodes, or any Tier 0 breach, are scored as **drift**
and fail. A declared deviation that leaves every string and image intact is
recorded and **passes**. The declaration is what separates "the style needed it"
from "this agent went off script" — the checker still verifies content integrity
either way, so declaring costs you nothing and hiding it costs you the file.

## What the verifier actually runs

`bun styles-scaffold/tools/verify.ts <style-id>` → per file:

| Check | Failure it catches |
|---|---|
| 6 sections present, visible, in order | a collapsed or deleted section |
| 91 `data-tid` strings vs manifest | rewritten copy |
| 12 `data-slot` images loaded | a swapped or dead photo |
| `--c-*` token parity light↔dark | a token that can never flip, named exactly |
| both themes non-blank and different | a dark mode that did nothing |
| no horizontal overflow at 375 / 768 / 1440 | the common responsive break |
| animations stopped under reduced-motion, and `getAnimations() == 0` in `?thumb=1` | an ungated loop melting the gallery |
| thumbnail weight ≤ ~35 % of full weight | 56 cards each fetching 5 MB |

## Theme rule, deliberately simple

Both themes exist so a human can look at them. That is the whole requirement — no
style is exempt, and no mode is "not recommended" here. Initial theme follows
`prefers-color-scheme`; the toggle owns it from then on, and does not persist
(deliberately: 56 sibling iframes must not write to shared storage).
