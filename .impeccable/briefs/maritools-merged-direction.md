# MariTools — Merged visual direction (user-selected)

**Source feedback:** Arena Round 2 review (2026-08-25). Candidate 3 (Grok When2meet aesthetic) discarded entirely. Codex preferred for frontend craft.

## Component pedigree

| Surface | Base code | Adaptations |
|---------|-----------|-------------|
| **Site header** | **Keep production `SiteHeader.svelte`** (brand, About/Events/MariTools, socials, Sign up) | Do **not** invent arena header chrome. **Only redesign Account** properly: signed-out = clear Account / Continue with Google affordance; signed-in = compact identity (initials or name) + menu to Account / Sign out. Never put Account in the tools sidebar. |
| **Tools sidebar** | **Neither Round 2 sidebar** — design from scratch | Structure still follows `TOOL_SECTIONS` (Schedule / Courses / Student life) + Back to club home. Visual language must be new: reject C1 mist mini-panels, C2 dark ink rail + kbd parade, and C4 Linear clone. Aim for quiet Operate density that does not compete with the calendar. |
| **Schedule chrome** | C1 calendar grid + event blocks + now-line + conflict | Borrow **roomier canvas** spacing from C4; borrow **simple page utility top bar** from C2 image 5 (`Week of…` + Today + arrows + primary export) — this is **page chrome**, not the site header |
| **Schedule import** | C1 right drawer | First-ever Import click opens **tutorial overlay** (9 Omnivox steps from `tutorial-steps.js`). After dismiss, drawer opens with paste. Repeat Import skips overlay if `localStorage` flag set (Show tutorial again in drawer). |
| **Export** | Replace “Export .ics” | Primary: **Add to Google Calendar** (downloads `.ics` — Google’s supported import format; no OAuth required for v1). Quiet secondary: Download `.ics` for Apple/Outlook. |
| **Common free time** | Reuse C1 schedule calendar chrome | Right small column = board members / guest username / import / “Use my schedule”. **When2meet behaviors:** drag on grid to mark free/busy; multiple named boards; share link; no forced login. |
| **Semester** | C1 Extraction review sheet (image 2) | Name TBD (“Build your semester” placeholder). Multi-course list can open this sheet; C4 single-course detail informs the expanded state. |
| **Catalog** | C2 expandable rows (image 6) | In-row expand for assessments + book reference; no separate detail route required for browse. |
| **Forum list** | C2 Discourse dens (image 8) | Polish density, tabs, composer. |
| **Forum thread** | C2 thread reader (image 7) | Polish helpful-answer treatment; remove preview artifacts. |
| **Clubs** | Redesign | Use C2 club directory grammar (initials, focus, meeting rhythm, contact) — not C1’s weak clubs. |
| **Home / Account** | C1 structure | Quiet Operate home; Account stays header-linked. |

## Product decisions locked by this feedback

### Common free time → When2meet boards

1. Users can **create multiple boards** (each has a shareable URL).
2. On a board: import Omnivox **and/or** drag on the week grid to paint free vs busy.
3. **Save** persists availability; **common free** computes intersection of all members.
4. **No forced login.** Guests enter a **display name** in the right panel. Signed-in users may skip naming and optionally **pull from My schedule**.
5. Sync model for preview: show member list updating; copy-link control; “You’re editing as Guest · Maya”.

### Google Calendar export

- Primary CTA label: **Add to Google Calendar**.
- Mechanism: generate `.ics` (already in product) → download + optional open of Google Calendar. True auto-push via Google OAuth is **not** in this design pass.
- Secondary: Download `.ics`.

### Omnivox tutorial overlay

- Content source: `src/lib/maritools/tutorial-steps.js` (9 steps).
- Visual: full-screen overlay / modal with step rail, large illustration frame, title, body, Next / Back / Skip.
- Images: planned path `static/maritools/omnivox/step-N.webp` (not yet in repo). Preview uses labeled placeholder frames with step titles until assets land. Crop rule: never show student number / legal name.

## Anti-goals

- Do not use Candidate 3 layouts.
- Do not transplant Round 2 sidebars (C1 mist panels, C2 dark rail, C4 Linear rail) — redesign sidebar.
- Do not invent a new site header; keep production header except Account treatment.
- Do not keep “Export .ics” as the only/primary schedule CTA.
- Do not force Account for free-time boards.
- No monospace fonts. No Book Delivery chrome. No term picker in shell.

## Deliverable

High-fidelity static preview at:

`.impeccable/arena/visual-preview/merged/`

Files: `index.html`, `styles.css`, `rationale.md`, `MERGE.md` (this pedigree).

All 9+ surfaces including: home, schedule (+ tutorial overlay + google export), free-time boards (list + board editor with drag affordance), semester, catalog, clubs, forum, thread, account.
