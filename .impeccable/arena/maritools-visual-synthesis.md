# MariTools visual preview — Arena synthesis

**Artifact:** `.impeccable/arena/visual-preview/` (hub + 4 candidates)  
**Frame:** `.impeccable/arena/maritools-visual-arena-frame.md`

## Runners

| Candidate | CLI | Model | Direction | CSS lines | Round 2 |
|-----------|-----|-------|-----------|-----------|---------|
| 1 | Codex | gpt-5.6-sol | Campus Lab Manual | ~2700 | Polished (Codex) |
| 2 | Codex | gpt-5.6-sol | Linear instrument | ~2040 | Pending |
| 3 | Grok | grok-4.6 | Comparison workshop | ~2066 | Pending |
| 4 | Grok | grok-4.6 | Quiet ledger | ~1803 | Pending |

Cross-judge: Codex → `.impeccable/arena/maritools-visual-cross-judge.md`

## View

- **Arena hub:** http://127.0.0.1:8765/
- **Candidate previews:** `candidate-{1-4}/index.html` (surface picker inside each)

## Visual review

Playwright captures: `screenshots/round-1-post-build/` (schedule, catalog, forum × desktop + mobile per candidate)

## Process completed

1. Frame + grounding + rubric
2. Round 1 parallel build (2 Codex + 2 Grok)
3. Screenshot review all four
4. Round 2 polish candidate 1 from self-review
5. Cross-judge scores

## Next

- Round 2 polish candidates 2–4 from self-review gaps
- Implement chosen base in `src/routes/tools/`
