# MariTools — category inspiration + sidebar redesign

Impeccable **Operate** mode. Craft bar = finish level and interaction discipline, **not** layouts to copy. Campus Lab Manual (`DESIGN.md` + `maritools-redesign-spec.md`) stays the translation layer.

**Rule:** Steal hierarchy, density, state grammar, and task sequence. Do not steal palette swaps, card stacks, rounded SaaS chrome, or marketing hero patterns.

---

## Sidebar redesign (new)

The current sidebar is a flat six-link list. Redesign it as a **lab-manual table of contents** with grouped sections, clearer current-state, and mobile drawer — inspired by the best **tools sidebars**, not club marketing nav.

### Category leaders (sidebar chrome)

| Product | Why study it | Steal for MariTools sidebar |
|--------|----------------|-----------------------------|
| [Linear](https://linear.app) | Dense left rail, section grouping, keyboard-first, 36px rows | Group labels, tight row height, current item = fill + left accent, no icons required |
| [Notion](https://notion.so) | Workspace TOC, nested sections, scroll-independent nav | Three intent groups (Schedule / Courses / Student life), sticky TOC column |
| [Stripe Dashboard](https://dashboard.stripe.com) | Restrained operate UI, settings separated from daily tasks | Daily tools top; no billing/cart; global Account stays in **site header** |
| [VS Code](https://code.visualstudio.com) | Icon rail + labels optional | Optional **collapsed rail** (64px icons + tooltips) for power users on ≥1280px |
| [MDN / Docusaurus](https://developer.mozilla.org) | Documentation TOC | Ruled rows, section headers as labels not buttons |

### Proposed sidebar structure

```
MariTools                          ← Inter Tight wordmark → /tools

SCHEDULE                           ← section label (--mt-text-xs, steel, not uppercase parade)
  Schedule                         ← was "My schedule" in nav label stays "Schedule"
  Free Time

COURSES
  Semester
  Catalog

STUDENT LIFE
  Clubs
  Forum

─────────────────                  ← optional ruled footer, not a card
Back to club home →                ← quiet link to / (not Book Delivery)
```

**Not in sidebar:** Account, Sign up, term picker, initiative strip, Book Delivery, cart.

### Visual tokens (sidebar-specific)

| Token | Value | Notes |
|-------|-------|--------|
| `--mt-sidebar-w` | `15rem` (240px) | Expanded; matches spec |
| `--mt-sidebar-w-rail` | `4rem` (64px) | Collapsed icon+tooltip mode |
| `--mt-sidebar-section-gap` | `1.25rem` | Between groups |
| `--mt-nav-section-label` | `0.75rem / 600 / steel` | "Schedule", "Courses" |
| `--mt-nav-row-h` | `2.5rem` | Slightly tighter than today (Linear density) |
| Current row | `mist` or `blue-soft` fill + `3px` inset `--mt-blue` left bar | Two signals, not color alone |

### Interaction

- **Desktop (≥52rem):** Sticky TOC column, independent scroll if groups grow.
- **Collapse (≥80rem, optional v2):** Toggle at bottom of sidebar; persist in `localStorage`; tooltips on rail icons.
- **Mobile (&lt;52rem):** **Drawer** (not only a horizontal strip): sticky bar shows current tool + "MariTools menu" button; opens full-height `nav` overlay with same grouped list. Focus trap + Escape closes.

### Acceptance (sidebar)

- [ ] Three groups match `TOOL_SECTIONS` in `tools-nav.js`
- [ ] Current route: background + inset bar + `aria-current="page"`
- [ ] Account only in site header
- [ ] No Book Delivery / term / initiative chrome in sidebar
- [ ] Mobile drawer completes keyboard journey

---

## Per-tool category inspiration

### `/tools` — Tools home (app directory)

**Category:** Product hub / launcher (macOS Settings, Linear settings categories, Figma file browser list view)

| Reference | Steal |
|-----------|--------|
| Linear settings sidebar + list | Grouped destinations with **one factual summary line** per row |
| Apple System Settings | Section headers + ruled rows, no cards |
| GitHub repo **Settings** index | Flat linked index, arrow affordance |

**MariTools translation:** Keep `TOOL_SECTIONS` as three ruled bands on paper main (sidebar groups echoed in content for mobile-first). No icon grid.

---

### `/tools/schedule` — Paste → timetable → ICS

**Category:** Week timetable + import workflow

| Reference | Steal |
|-----------|--------|
| Google Calendar **week** view | Column alignment, time rail, block positioning |
| Fantastical / Cron | Clean week density without decoration |
| Printed **registrar timetable** | Ink rules, tabular times (Inter), overlap visible as conflict |
| Linear **calendar** (density) | No floating cards; blocks sit on grid |

**Steal:** Paste-then-preview sequence (like import preview in spreadsheet tools). Overlap = danger border + label, not color alone. Tutorial in `<details>`, not modal.

**Reject:** Full-month marketing calendars, gradient time blocks, round pill events.

---

### `/tools/free-time` — Multi-person availability

**Category:** Group scheduling / availability matrix

| Reference | Steal |
|-----------|--------|
| [When2meet](https://www.when2meet.com) | Multi-column paste, minimum duration, week result matrix |
| Cal.com **availability** editor | Duration presets as radios, not sliders |
| Google Calendar **Find a time** | Compare busy blocks (we show **free** gaps, inverse logic) |

**MariTools translation:** Reuse `MtWeekGrid` in **gap mode** — same geometry as schedule, different cell semantics (white + blue leading rule for free slots). Person pastes stacked like When2meet columns.

**Reject:** Avatar circles, heatmap gradients, social “invite friends” chrome.

---

### `/tools/semester` — Outline upload + review + contribute

**Category:** Document intake + human-in-the-loop review

| Reference | Steal |
|-----------|--------|
| TurboTax / multi-step **review** | Upload → extracted fields → confirm before submit |
| GitHub **PR review** | Editable rows, inline corrections, explicit “what will be shared” |
| Dropbox upload panel | Single file target, clear error for wrong type/size |
| Notion **import** feedback | “We couldn’t parse this” → manual fields, not dead end |

**MariTools translation:** Ruled review table for assessments/books. Auth gates inline (`Sign in` link), not modal. Catalog contribute = checkbox band with conditional required fields.

**Reject:** Wizard progress mascots, step circles, AI sparkle marketing.

---

### `/tools/catalog` — Course facts browse

**Category:** Library catalog / OPAC / course catalog

| Reference | Steal |
|-----------|--------|
| University **course catalog** (e.g. McGill, UBC public catalog) | Code + title + section + instructor row |
| WorldCat / library OPAC | Facet row (term + query), dense results |
| Stripe **Docs** list pages | Filter bar + ruled index, tabular-nums for codes |

**MariTools translation:** Term filter **on page only** (browse facet). Books subsection labeled **reference only** — link to title/ISBN text, never “Buy”.

**Reject:** Card grid of courses, star ratings, marketplace thumbnails.

---

### `/tools/clubs` — Org directory + submit

**Category:** Campus org directory / lightweight CRM list

| Reference | Steal |
|-----------|--------|
| MIT / campus **clubs** listings | Name, category, one-line description, external link |
| Yelp list (density only) | Filter + scanable rows, not photos-first |
| Airtable **gallery** as list view | Metadata line under title |

**MariTools translation:** Same `MtFilterRow` + `MtRuledList` as catalog. Submit panel = second ruled section when signed in.

**Reject:** Logo grids, Instagram-style tiles, join buttons on every row.

---

### `/tools/forum` — Thread index + compose

**Category:** Course forum / Q&A list

| Reference | Steal |
|-----------|--------|
| [Discourse](https://discourse.org) topic list | Title strong, meta quiet, category as text |
| Piazza (course Q&A) | Course tag visible in meta, not badge soup |
| Hacker News list | Single column, no avatars required |

**MariTools translation:** Ruled thread links. Compose = bottom panel on same page (Discourse “new topic” inline), not modal.

**Reject:** Reaction counts as primary UI, avatar stacks, ranking algorithms surfaced in chrome.

---

### `/tools/forum/[threadId]` — Thread read + reply

**Category:** Threaded discussion (read-heavy)

| Reference | Steal |
|-----------|--------|
| Discourse topic | Title + meta + prose measure ~68ch |
| GitHub issue thread | Linear replies, report as secondary action |
| MDN article + aside | Reading column discipline |

**MariTools translation:** Replies as ruled stack. Staff mod states as text labels, not colored badges.

---

### `/tools/account` — Identity + disclosure

**Category:** Account settings (minimal student app)

| Reference | Steal |
|-----------|--------|
| GitHub **Settings** → Profile | Single-column form bands |
| Google account security page | Primary CTA for OAuth, plain status text |
| Stripe account | Short errors, no provider jargon |

**MariTools translation:** Page in tools shell (sidebar still visible). NVIDIA disclosure = ruled expandable legal block.

**Reject:** Dashboard of account “features”, avatar upload hero.

---

## Cross-tool patterns (from impeccable Operate)

1. **One control vocabulary** across all tools (same button heights, focus rings, filter row).
2. **Skeleton rows** for list/grid loading — not center spinners.
3. **Empty states teach the task** (e.g. “Paste two Omnivox lists” not “Nothing here”).
4. **Errors beside the control** that caused them; page-level alert only when multi-field.
5. **Motion 120–220ms** for press, nav, drawer — no page-load choreography.

---

## Implementation note

Update `tools-nav.js` / `MtShell` to render **grouped sidebar** from `TOOL_SECTIONS` (not flat `TOOL_NAV_ITEMS` only). Home (`/tools`) can remain index-only on main; sidebar still shows all six tools in groups.

Preview: refresh `.artifacts/maritools-preview/index.html` to show grouped TOC sidebar.
