# Merge map

- Candidate 1: weekly calendar geometry, exact event fills, padding, radius, shadow, small typography, conflict treatment, lane positioning, now-line, Omnivox drawer, and Semester extraction review.
- Candidate 2: expandable catalog rows and details, flat club directory rows, forum index and composer, thread reader, and helpful-answer treatment. These indexes now sit directly in the main pane without an outer page frame.
- Candidate 4: calendar width and roomier working-canvas proportions only.
- New in merged: mutually exclusive Sign up and Account header states, the quiet tools sidebar and mobile drawer, working free-time drag painting, a flat account page, a club detail page, and a Google Calendar export popup that keeps both `.ics` downloads inside the popup.
- Omnivox tutorial: all nine steps match `src/lib/maritools/tutorial-steps.js`. The wired `step-01.webp` through `step-09.webp` assets are placeholders pending capture. Until those files exist, failed images stay hidden and the labeled HTML mock frame remains visible.
- Round 2 polish: restored Candidate 2's catalog, club, forum, and thread rules; linked every club row to the detail view; added catalog pagination; simplified the sidebar selection; and removed conflicting index CSS.
- CSS consolidation (2026-08-26): merged the late flat-index override block into primary rules; fixed calendar event color bars (`border-left` instead of clipped inset shadows); aligned flat page padding/margins for catalog, clubs, forum, boards, and account; scoped account avatar styles away from forum avatars; removed duplicate tutorial-frame rules.
- Detector exception: Inter and Inter Tight remain because they are the established production design-system fonts and the brief forbids inventing a new visual world. No monospace font is used.
