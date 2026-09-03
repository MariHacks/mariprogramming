# MariTools visual preview — Arena frame

**Goal:** High-effort static HTML/CSS previews of MariTools redesign — not markdown specs, not one-shot placeholders.

**Deliverable:** Four distinct design directions as browsable previews with all 9 surfaces + shell.

## Rubric (30 points)

| Criterion | 10 | 7 | 4 | 0 |
|-----------|----|----|----|---|
| **Craft & polish** | Impeccable operate density: typography scale, spacing rhythm, contrast, states, no card soup | Good but generic SaaS | Rough / placeholder | Broken |
| **Coverage** | All 9 routes + grouped sidebar + site header; realistic copy | Missing 1–2 surfaces | Missing 3+ | Shell only |
| **Direction** | Own visual world; memorable; fits Student Technical Journal | Derivative but coherent | Conflicts with constraints | Wrong product |
| **Constraints** | No mono; Account in header; no term picker in chrome; no Book Delivery; tabular-nums for codes/times | One violation | Multiple violations | Ignored |

**Blocking:** monospace anywhere, Book Delivery chrome, term picker in shell, Account in sidebar.

## Process

1. **Round 1 — Build:** 2 Codex + 2 Grok agents produce full preview in assigned candidate dir.
2. **Visual review:** Playwright screenshots at 1440×900 (schedule, catalog, forum) + 390×844 mobile.
3. **Round 2 — Iterate:** Each agent receives screenshot paths + critique; must polish HTML/CSS (not rewrite from scratch unless broken).
4. **Cross-judge:** Codex scores all four post-iteration previews; pick base + grafts.
5. **Arena hub:** `index.html` links to all four candidates side-by-side.

## Paths

| Path | Purpose |
|------|---------|
| `.impeccable/arena/visual-preview/candidate-{1-4}/` | Candidate preview roots |
| `.impeccable/arena/visual-preview/screenshots/` | Round screenshots |
| `/tmp/arena-maritools-visual/` | Prompts, logs, grounding |

## Candidate seeds (distinct worlds)

| ID | Runner | Seed direction |
|----|--------|----------------|
| 1 | Codex gpt-5.6-sol | **Campus Lab Manual** — grouped TOC sidebar, mist/paper, registrar week grid |
| 2 | Codex gpt-5.6-sol | **Linear instrument** — flat rail, cool minimal, Stripe-docs list density |
| 3 | Grok grok-4.6 | **Comparison workshop** — When2meet clarity, multi-schedule paste, gap results |
| 4 | Grok grok-4.6 | **Quiet ledger** — warm paper option within no-beige rule, wide main, dot-nav rail |

Each candidate must interpret its seed fully — not three tabs of the same skin.
