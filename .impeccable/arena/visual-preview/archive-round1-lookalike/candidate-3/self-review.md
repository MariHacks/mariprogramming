# Self-review

**23 / 30**

| Criterion | Score | Note |
| --- | --- | --- |
| Shell and IA | 4 / 5 | Grouped TOC, Account in header, back-home footer, mobile drawer. Preview bar is extra chrome judges need, but it competes with the real header. |
| All nine surfaces | 5 / 5 | Home, schedule, free time, semester, catalog, clubs, forum, thread, account. Realistic Omnivox copy. |
| Comparison workshop | 4 / 5 | Person stations and ruled gap rows are the point. Custom minutes field exists but does not hide until Custom is selected. Optional names are extra vs spec. |
| Week grid | 4 / 5 | Time rail, five columns, absolute blocks, overlap label. Wednesday “No classes” is in the header, not a full-height message. Hour geometry is 08:00–18:00 at 4rem, so the grid is long. |
| Type, color, states | 4 / 5 | Tokens match the spec. Hover/focus/active/disabled/loading exist in CSS. HTML mostly shows the happy path plus one overlap warning. No skeleton or error examples on catalog/forum. |
| Responsive / a11y | 2 / 5 | Breakpoints and a viewport toggle exist. Skip link, aria-current, labeled fields. Mobile menu is not a focus-managed popover. Site Menu button does nothing. Auth gates and guest Google sign-in are missing. |

## Round 2 list

1. Show guest account (`Continue with Google`) and one Semester auth gate without leaving the tools shell.
2. Catalog and forum: one skeleton band and one no-match empty state, even if they sit behind a small state switch.
3. Hide the custom-minutes input until Custom is selected. Wire the radio in the preview script.
4. Shorten the visible week to the occupied hours, or add a sticky weekday header that survives vertical scroll inside the frame.
5. Make the site Menu button open a real club nav on narrow widths.
6. Thread: a locked state and an inline confirm for Remove thread.
7. Clubs: signed-out auth gate as an alternate block.
8. Check muted `#5a657a` on paper for 4.5:1 at 14px; I darkened it from `#657087` on purpose, but I did not measure every notice pairing.
9. Person station Remove should disappear when only two people remain. Preview currently shows three, which is fine, but Add another person does not add a station.
10. Preview should open on Tools home for IA judging, with Free Time still one click away. I defaulted to the signature page so the seed is obvious.

## Constraints checked

- No code face in CSS (grep `mono` is clean aside from this review file).
- Account is not in the sidebar.
- Term filter lives on catalog only.
- No Book Delivery, cart, or initiative strip.
- Sidebar groups match TOOL_SECTIONS.
- `Free Time` in nav, `Common free time` as the page title.
