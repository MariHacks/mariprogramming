# Homepage reference implementation report

## Scope

- Replaced `src/routes/+page.svelte` with the supplied editorial composition.
- Expanded `src/routes/home.page.test.js` with structural, semantic, destination, content-truth, and forbidden-copy checks.
- Did not change the shared header, footer, global tokens, public content model, or backend.

## Implemented composition

- Split hero with the exact three-line `Code. Collaborate. Create.` headline and the verified local MariHacks image.
- Four ruled activity columns for Peer Help, Workshops, Mini-Competitions, and MariHacks.
- Mini-Competitions is labelled `Coming Soon` and has no inactive or premature action.
- Ruled workshop archive with three real repository-backed workshops and no invented dates.
- Book Delivery launch notice with `Coming Soon`, a factual status link, and a typographic French and English books composition. It contains no fake course, teacher, price, cover, or order action.
- Four-destination Programming Hub band using direct, verified routes.
- Mobile stacks, a two-column tablet treatment, and the existing compact footer.

## Copy review

All new visible strings were reviewed with the Humanizer guidance. The page uses short factual copy and contains no em dash, en dash, middle-dot separator, decorative eyebrow, invented date, unsupported metric, or stale event claim.

## Motion audit

The animation-opportunity audit rejected hero entrances, section staggers, image drift, and animated archive rows. These elements are either frequently read or information dense, so motion would hinder scanning. The homepage adds no motion. It relies on the shell's existing disclosure and press feedback for functional state changes.

## 1024 by 1536 calibration

Measurements were taken from the rendered Chrome DOM and retained in `tmp/visual-review/homepage/measurements.json`.

| Element                     | Measured |                          Target | Result |
| --------------------------- | -------: | ------------------------------: | ------ |
| Header bottom               |    72 px |                           72 px | Pass   |
| Hero bottom                 |   613 px |                          613 px | Pass   |
| Activity bottom             |   861 px |                          861 px | Pass   |
| Archive and delivery bottom |  1286 px |                         1286 px | Pass   |
| Programming Hub bottom      |  1457 px |                         1457 px | Pass   |
| Footer height               |    80 px |                     about 79 px | Pass   |
| Hero copy width             |    47.4% | 47.4%, tolerance 45.9% to 48.9% | Pass   |
| Main inset                  | 47.09 px |                  46 px to 49 px | Pass   |
| Title size                  | 58.88 px |                  58 px to 60 px | Pass   |
| Title line height           | 61.53 px |                  60 px to 63 px | Pass   |
| Horizontal overflow         |     0 px |                            0 px | Pass   |

Chrome screenshots are retained at 320, 390, 768, 1024, and 1440 pixels under `tmp/visual-review/homepage/`. Every measured viewport has zero horizontal overflow. The 768 pixel review found activity and Programming Hub crowding in the first pass; both bands now use a two-column tablet layout.

The final screenshot and DOM measurement set was regenerated from the current source at `2026-08-13T11:00:09Z`. The rendered contract also checks the hero primary action and every Programming Hub link at all five widths. Each target is exactly 44 pixels high or taller.

## Verification

- Homepage tests: 9 of 9 passed.
- Full suite with coverage: 653 of 653 passed.
- Authored JavaScript coverage: 100% statements, branches, functions, and lines.
- `npm run check`: 0 errors and 0 warnings.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Impeccable detector: no findings.
- Rendered interactive-target contract: 44 pixels or taller at all five widths.

The implementation is ready for an independent visual and UX review.
