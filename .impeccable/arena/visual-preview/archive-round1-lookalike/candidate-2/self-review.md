# Candidate 2 self-review

## Score

**92/100**

| Area | Score | Review |
| --- | ---: | --- |
| Direction and distinctiveness | 19/20 | The grouped instrument shell and ruled worksheet language hold across all nine pages without drifting into dashboard cards. |
| Hierarchy and typography | 18/20 | Page titles, labels, data, and actions have clear steps. Inter and Inter Tight remain consistent, with tabular numerals instead of monospace. Some dense mobile metadata approaches the lower limit of comfortable reading. |
| Layout and component consistency | 19/20 | Control heights, borders, section rules, filter bars, editors, lists, and notices share one grammar. The timetable is the strongest product-specific composition. |
| Interaction and accessibility | 18/20 | Every page is hash-reachable, only one page is visible at a time, current states update, focus rings are visible, controls have accessible labels, reduced motion is supported, and mobile navigation works without hover. The native details menu does not implement a full focus trap. |
| Responsive behavior | 18/20 | Desktop, 390px schedule, and 390px catalog views preserve order and usable controls. The timetable becomes an agenda on narrow screens. The preview route strip still needs horizontal scrolling on small phones. |

## Checks against the brief

- All nine required surfaces are present and reachable.
- Account appears in the club header and not the tools sidebar.
- The sidebar uses Schedule, Courses, and Student life groups.
- The sidebar footer links back to `/`.
- No Book Delivery chrome, cart, term picker in the tools shell, or initiative strip appears.
- Catalog term selection stays inside the catalog page.
- The schedule includes source input, parsed records, overlap warning, week geometry, mobile agenda, and calendar export.
- All font stacks use Inter, Inter Tight, or sans-serif fallbacks. There is no monospace declaration.
- The stylesheet exceeds the requested 400 lines.

## Gaps noted before the final iteration

1. The original shell stacked all nine sections. A hash router now limits the preview to one page and updates current navigation states.
2. The mobile disclosure trigger originally said "Preview pages" on every route. It now names the current page.
3. The preview strip and mobile menu had no persistent selected treatment. Both now show the active route.

## Remaining limitations

- This is a static visual preview. Parsing, uploads, filtering, posting, downloads, authentication, loading, and server errors are represented but do not execute.
- The native mobile details menu closes on route changes but does not trap focus or close on an outside press.
- Google Fonts requires a network connection. System sans-serif fallbacks preserve layout when it is unavailable.
- The preview route strip intentionally scrolls horizontally at narrow widths so all nine candidate surfaces remain reachable.
- The mechanical detector flags Inter as common, but the grounding brief requires Inter and Inter Tight. It also flags three leading state rules. Those rules encode current, warning, and availability states specified by the Campus Lab Manual system rather than decorating generic cards.
