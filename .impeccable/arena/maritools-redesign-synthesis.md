# MariTools redesign — Arena synthesis

**Artifact:** `.impeccable/briefs/maritools-redesign-spec.md`  
**Task:** Impeccable Operate-mode design spec for all `/tools` routes with shared vs page-specific tokens.

## Runners

| Candidate | CLI | Model | Output |
|-----------|-----|-------|--------|
| 1 | Codex | `gpt-5.6-sol` | Base (30/30) |
| 2 | Codex | `gpt-5.6-sol` | Alternate (29/30) |
| 3 | Grok | `grok-4.6` (`-p`, `--output-format plain`) | Alternate (26/30) |
| 4 | Grok | `grok-4.6` | Alternate (24/30) |

Cross-judge: Codex `gpt-5.6-sol` → `.impeccable/arena/maritools-cross-judge.md`

## Base

**Candidate 1** — most complete route coverage, explicit shared vs route token layers, no product contradictions, full `Mt*` component vocabulary.

## Grafts

| Source | Grafted | Rejected |
|--------|---------|----------|
| Candidate 3 | `--mt-main-max-*`, grid breakpoints, `MtWeekGrid` CSS geometry | Center-dot metadata separators |
| Candidate 2 | Semester 12-column field row, acceptance checklist | 12-column row totaling 14 cols without wrap rules; hard-coded 8 MB copy without server tie-in |
| Candidate 4 | — | Term-picker chrome copy; center-dot separators |

## Verification

- [x] All nine routes + shell listed in spec
- [x] Shared `--mt-*` scoped to tools shell; page-specific tokens named
- [x] Book Delivery independence, Account in header, no term picker in chrome
- [x] Implementation order with Schedule as first vertical-slice proof
- [x] Cross-judge scores recorded

## Next step

Implement per spec implementation order on `feat/impeccable-redesign` (foundation → schedule slice → browse pages).
