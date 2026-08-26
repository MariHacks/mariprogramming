# Candidate 1 self-review, round 2

## Score: 29 / 30

### Direction fidelity: 9.5 / 10

The polish pass keeps the Campus Lab Manual direction intact. The grouped TOC, cool paper and mist surfaces, ruled records, rare electric blue, and registrar-style week remain the organizing language across all nine routes. Account stays in the site header. The catalog alone owns the term filter. No Book Delivery navigation or commerce behavior appears.

The preview bar still adds a strip that production would not need. Its new state control earns the space for review, but it remains artifact chrome rather than product chrome.

### Information design and task clarity: 9.8 / 10

The state picker now exposes an empty catalog, schedule parsing, an outline error with recovery, a locked thread, and a signed-out account. Each choice opens the relevant route instead of showing a detached demonstration. Build schedule and Share to catalog now confirm beside the action. Account and MariTools current states also switch correctly in the site header.

The schedule warning and timetable now describe and display a three-course collision. The staggered blocks keep each course identifiable, and the mobile day list includes the same conflict.

### Visual craft and responsiveness: 9.7 / 10

Desktop, mobile, 820-pixel tablet, and 680-pixel compact layouts were reviewed. Compact tablets get a right-edge "More days" cue that disappears at the end of the horizontal scroll. Catalog rows between 640 and 700 pixels have more vertical room, while narrower rows add labels for author and ISBN. Mobile forum rows now use a clear title, category, course, and arrow order.

The mobile tools menu behaves as a dialog: focus moves inside on open, loops in both directions, returns to the trigger on Escape, closes on outside click, and prevents background scrolling. Focus rings include the keyboard-scrollable timetable. Controls keep the shared height token.

The remaining production concern is font delivery. This standalone preview preconnects to Google Fonts; the shipping app should follow the repository's self-hosting or font-loading policy.

## Round-two verification

- Desktop and mobile pages render without horizontal document overflow.
- The tablet timetable cue is visible before scrolling and fades at the right edge.
- Empty, loading, error, locked, and signed-out state views all render from the state picker.
- Both action confirmations appear after their buttons are used.
- The tools menu passes forward and reverse focus-loop, Escape-return, and outside-click checks.
- `styles.css` contains neither `mono` nor `monospace`.
