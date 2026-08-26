# Self-review

## Score: 24 / 30

### Direction fidelity: 8 / 10

The dotted spine, folio line, cool paper, and catalog/semester tables are the Quiet ledger idea, not a generic Campus Lab Manual restyle. The rail is actually narrow. Account is only in the site header. There is no term control in chrome, no Book Delivery, no initiative strip, no monospace.

Deductions: forum and account still read as ordinary operate forms with a ledger header glued on. The home index uses the same dots, which helps, but the spine never collapses to a true 4rem icon rail. Catalog is wide, which matches the seed, and slightly stretches the spec's 52rem index measure.

### Information design: 8 / 10

All nine surfaces are in one file and reachable from the select, the rail, and in-page links. Copy comes from `tools-nav.js`, the account disclosure, and the Omnivox tutorial, with sample records labeled. Schedule shows paste, overlap, week geometry, and export. Free time shows two people, a date override, and gap columns. Semester shows the three beats. Catalog textbooks stay reference-only.

Missing from this static cut: guest account, complete profile, signed-out composer gates, catalog no-match, loading skeletons on browse pages, locked thread, and a three-way timetable collision. Robotics and Film Society are invented preview clubs sitting next to the real Programming Club.

### Visual craft: 8 / 10

Type, rule weight, control height, focus, and reduced-motion are intentional. The week sheet has a time rail, hour and half-hour lines, and an overlap label that is not color alone. Phone width is both a breakpoint and a preview toggle. The Tuesday overlap blocks occupy the same column, so Programming I is partly covered after 10:00. Tablet widths between 40rem and the five-column minimum still need a visible scroll cue. A few semester headings use inline styles. The mobile drawer closes on Escape and outside press, but it is not the Popover API and does not return focus as carefully as the spec.

## Round 2

1. Split overlapping meetings in a day column (offset or shared gutter) and test three-way collisions.
2. Add a state switcher for empty, loading, error, locked thread, and guest account.
3. At 700–1024px, keep the week grid scrollable and mark that the sheet continues to the right.
4. Replace invented club rows or mark every non-Programming Club listing as sample-only in the row itself.
5. Drop inline styles. Give catalog fact tables a labeled definition layout below 40rem, not only a single stacked column.
6. Return focus to the tools menu button after the drawer closes, and inert the main column while it is open.
7. Show Save/Share confirmation next to those actions, not only the idle primary button.
