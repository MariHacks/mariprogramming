# MariTools visual preview cross-judge

The rubric names four 10-point criteria but asks for a 30-point total. I scored all four, then normalized the 40-point raw score to 30.

| Candidate | Craft /10 | Coverage /10 | Direction /10 | Constraints /10 | Raw /40 | Score /30 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1. Codex Campus Lab Manual | 9.5 | 10 | 9.5 | 10 | 39 | **29.3** |
| 2. Codex Linear instrument | 8 | 10 | 8 | 7 | 33 | **24.8** |
| 3. Grok Comparison workshop | 7.5 | 9 | 9.5 | 10 | 36 | **27.0** |
| 4. Grok Quiet ledger | 7 | 9 | 9.5 | 10 | 35.5 | **26.6** |

## Base pick

Pick **Candidate 1, Campus Lab Manual**.

It has the best complete system, not just the best signature screen. The grouped table-of-contents sidebar, numbered task phases, ruled records, restrained blue, and registrar timetable stay coherent across all nine routes. Desktop density is controlled, and its mobile layouts preserve the hierarchy instead of merely stacking the desktop page.

Candidate 1 also carries the least implementation debt. Its preview exposes empty, loading, error, locked, and signed-out states. The three-course collision remains legible, confirmations sit next to the actions that caused them, and the MariTools mobile menu handles focus, Escape, outside click, and focus return. No other candidate combines that coverage with equal visual finish.

The 0.7 deduction is real. The separate global site `Menu` button is dead on mobile while the global nav, including Account and Sign up, is hidden. Fix that before adopting the preview as the production base.

## Grafts

- **From Candidate 3:** take the Common free time workbench. Its numbered `Person N schedule` stations, minimum-gap radio row, optional date, and weekday gap ledger make schedule comparison feel like a purpose-built tool. Use that interaction inside Candidate 1's shell.

- **From Candidate 4:** take the semantic ledger tables and hanging numeric columns for Semester assessments and dense catalog facts. The folio-style local breadcrumb can also sharpen route orientation. Keep Candidate 1's grouped sidebar; Candidate 4's dotted spine is memorable but weaker as the main navigation.

- **From Candidate 2:** take the schedule-side `What gets read` explanation and the explicit `Clear filters` action in the catalog. Both answer practical questions at the point of use without adding another panel system.

## Blocking issues

- **Candidate 1:** the mobile global site `Menu` has no target or handler. At widths where `.site-nav` disappears, Account, Sign up, About, and Events become unreachable. The MariTools menu itself is well implemented; the defect is the separate club navigation.

- **Candidate 2:** hard rubric blocker. `Account` appears inside `nav[aria-label="Mobile MariTools navigation"]`. Account must remain in the site header, not MariTools navigation. The self-review's constraint claim is incorrect on mobile.

- **Candidate 3:** the mobile global `Menu` points to a missing panel and has no working handler, so the hidden club navigation is unreachable. Route focus also scrolls the global header out of the captured first viewport. Alternate guest, auth-gate, loading, error, and locked states remain absent.

- **Candidate 4:** the Sign up control renders dark text on an ink background because the general site-nav link rule wins over the button color. The mobile global header wraps into an oversized block, and overlapping timetable meetings cover one another. Fix those before reusing its shell or timetable.

All four avoid monospace, Book Delivery chrome, and a shell-level term picker. Candidates 1, 3, and 4 keep Account out of the MariTools sidebar. Candidate 2 fails that constraint in its mobile tools menu.
