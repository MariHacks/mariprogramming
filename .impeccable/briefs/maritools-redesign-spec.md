# MariTools redesign specification

## Scope and mode

This specification covers the shared `/tools` shell and every page below it:

- `/tools`
- `/tools/schedule`
- `/tools/free-time`
- `/tools/semester`
- `/tools/catalog`
- `/tools/clubs`
- `/tools/forum`
- `/tools/forum/[threadId]`
- `/tools/account`

The mode is Operate. A student arrives with a concrete campus task and should reach the first meaningful control without crossing a marketing panel. The design inherits the parent site's cool paper, ink, electric-blue signal, typography, and ruled editorial discipline. Inside MariTools, those ingredients become denser, quieter, and more instrument-like.

MariTools remains independent from Book Delivery. The tools shell contains no cart, purchase action, fulfillment copy, `/books` link, bookstore styling, or initiative strip. Textbooks in the course catalog are factual references only.

## Direction contract

### Thesis

**Campus Lab Manual:** MariTools turns awkward campus source material into structured information students can check, use, and optionally share. The interface should resemble a well-kept registrar binder crossed with a modern lab worksheet: a stable index at the left, numbered or ruled work areas at the right, and exact notation for course codes, dates, rooms, and times.

The interface does not pretend that student data is playful. Its character comes from alignment, useful density, and the moment pasted text resolves into a clean timetable.

### Its own world

MariTools belongs to these familiar student artifacts:

- Registrar timetables with fixed weekday columns and tabular times.
- Course-outline worksheets with fields that can be corrected before submission.
- Lab manuals with a persistent contents index and clearly separated procedures.
- Library finding aids with terse metadata, ruled lists, and reliable filters.

It does not borrow from developer terminals, neon dashboards, arcade interfaces, social-media feeds, or school-spirit posters. Roboto Mono marks literal identifiers and time data only. It never becomes a decorative voice.

### Story

Every task follows the same five-beat sequence when the product behavior supports it:

1. **Orient:** page title, one factual sentence, and any privacy or eligibility fact needed before acting.
2. **Supply:** paste, upload, filter, compose, or sign in.
3. **Check:** show parsed or returned data in a format that exposes mistakes.
4. **Act:** export, share, submit, post, or continue browsing.
5. **Confirm:** place success or failure next to the action that caused it.

Pages omit beats that do not apply. The directory page is only an orientation and routing page. Browsing pages open with filters and results, not an artificial setup step.

### First viewport

At a 1440 by 900 viewport, the existing 4.5rem site header remains intact. Beneath it, the MariTools shell begins immediately.

- The left 15rem sidebar shows the MariTools wordmark, three small section labels, and six route links. It uses a mist background and a 1px right rule.
- The main pane starts 2rem from the shell boundary. Its page header occupies no more than 7rem of vertical space.
- On task pages, the first working control begins within the first viewport. On `/tools/schedule`, the Omnivox help disclosure and the top of the paste field are visible. On browse pages, the filters and at least the first result row or empty state are visible.
- No route opens with an illustration, statistic strip, oversized display heading, promotional paragraph, or summary cards.

At 1024 by 768, the same sidebar remains, reduced to 13.5rem. At widths below 48rem, it becomes a compact tools navigation bar directly below the site header. The current route remains visible without opening the menu.

### Form

The visual form is a flat worksheet:

- Paper main pane, mist index pane, ink text, blue only for current state, primary action, links, and focus.
- Horizontal rules group records and steps. Background panels are reserved for notices, selected items, and loading placeholders.
- Controls share one height, radius, border weight, label treatment, focus ring, and disabled treatment.
- Page headings use Inter Tight because they connect MariTools to the parent publication. All labels, navigation, controls, records, and body text use Inter.
- Roboto Mono is limited to course codes, section numbers, ISBNs, dates in machine format, time ranges, room identifiers, and pasted Omnivox source text.
- Static content never casts a shadow. Only the mobile navigation popover may use a shadow because it sits above the page.

## Shared custom properties

Define MariTools properties on `.mt-shell` so they can refine the parent system without changing public club or Book Delivery pages. Values are exact unless a responsive override is listed.

| Property | Value | Use |
| --- | --- | --- |
| `--mt-paper` | `#f8fafc` | Main background; aliases parent cool paper |
| `--mt-surface` | `#ffffff` | Inputs, menus, and selected editable rows |
| `--mt-mist` | `#edf1f6` | Sidebar, subdued grouping, static skeletons |
| `--mt-ink` | `#061431` | Headings and high-emphasis labels |
| `--mt-text` | `#17213a` | Body and control text |
| `--mt-muted` | `#657087` | Descriptions and secondary metadata; minimum 4.5:1 on paper must be verified |
| `--mt-blue` | `#0b4cf4` | Primary action, current route, links, focus |
| `--mt-blue-soft` | `#e7efff` | Selected row and informational notice background |
| `--mt-danger` | `#b4233b` | Error text and invalid borders |
| `--mt-danger-soft` | `#fff0f2` | Error notice background |
| `--mt-warning` | `#8a4b08` | Recoverable parse warnings |
| `--mt-warning-soft` | `#fff6df` | Warning notice background |
| `--mt-success` | `#17653a` | Confirmed save, post, publish, or export status |
| `--mt-success-soft` | `#eaf7ef` | Success notice background |
| `--mt-rule` | `rgb(6 20 49 / 18%)` | Default 1px rules |
| `--mt-rule-strong` | `rgb(6 20 49 / 42%)` | Inputs, table headers, major boundaries |
| `--mt-font-ui` | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | All operational UI |
| `--mt-font-heading` | `"Inter Tight", Inter, sans-serif` | Page h1 and shell brand only |
| `--mt-font-mono` | `"Roboto Mono", "SFMono-Regular", Consolas, monospace` | Literal identifiers and time data only |
| `--mt-text-xs` | `0.75rem` | Supporting metadata, table annotations |
| `--mt-text-sm` | `0.875rem` | Labels, navigation, buttons, table cells |
| `--mt-text-base` | `1rem` | Body and input text |
| `--mt-text-lg` | `1.125rem` | Lead sentence, record title |
| `--mt-text-xl` | `1.375rem` | Section heading where a visible step begins |
| `--mt-text-page` | `2rem` | Desktop and tablet h1; fixed Operate size |
| `--mt-text-page-mobile` | `1.75rem` | h1 below 48rem |
| `--mt-leading-tight` | `1.15` | h1 and compact headings |
| `--mt-leading-ui` | `1.4` | Labels, controls, metadata |
| `--mt-leading-body` | `1.6` | Explanatory text and posts |
| `--mt-space-1` | `0.25rem` | Tight inline separation |
| `--mt-space-2` | `0.5rem` | Label to control, metadata gaps |
| `--mt-space-3` | `0.75rem` | Compact row padding |
| `--mt-space-4` | `1rem` | Standard gap and row padding |
| `--mt-space-5` | `1.5rem` | Section internal spacing |
| `--mt-space-6` | `2rem` | Page and major section spacing |
| `--mt-space-8` | `3rem` | Maximum desktop separation between task phases |
| `--mt-radius` | `0.25rem` | Every field, button, notice, and menu corner |
| `--mt-control-h` | `2.75rem` | Button, text input, and select minimum height |
| `--mt-control-h-touch` | `3rem` | Control minimum below 48rem |
| `--mt-focus-w` | `3px` | Focus outline width |
| `--mt-focus-offset` | `2px` | Focus outline offset |
| `--mt-page-max` | `76rem` | Main content maximum width |
| `--mt-reading-max` | `52ch` | Intro and explanatory copy measure |
| `--mt-form-max` | `44rem` | Single-column upload, account, and compose forms |
| `--mt-sidebar-w` | `15rem` | Desktop sidebar width at 80rem and above |
| `--mt-sidebar-w-compact` | `13.5rem` | Sidebar width from 48rem to 79.99rem |
| `--mt-main-max-wide` | `72rem` | Schedule and free-time main column |
| `--mt-main-max-index` | `52rem` | Home, catalog, clubs, forum list |
| `--mt-main-max-form` | `42rem` | Semester, account, compose, thread |
| `--mt-grid-row-h` | `2.5rem` | Height of one 30-minute timetable row |
| `--mt-grid-time-col` | `3.5rem` | Sticky time rail width |
| `--mt-bp-rail` | `52rem` | Sidebar becomes top rail below this |
| `--mt-bp-grid` | `64rem` | Full five-day grid at and above this |
| `--mt-page-gutter` | `2rem` | Main pane inline padding at 80rem and above |
| `--mt-page-gutter-compact` | `1.5rem` | Main pane inline padding from 48rem to 79.99rem |
| `--mt-page-gutter-mobile` | `1rem` | Main pane inline padding below 48rem |
| `--mt-nav-row-h` | `2.75rem` | Sidebar route row |
| `--mt-table-row-min` | `3rem` | Data and directory row minimum |
| `--mt-grid-min-col` | `10.5rem` | Minimum desktop weekday column before horizontal scrolling |
| `--mt-time-rail` | `4.5rem` | Timetable time-label rail |
| `--mt-schedule-hour` | `4rem` | Vertical height for one timetable hour |
| `--mt-free-slot-row` | `2.5rem` | Free-time matrix slot row minimum |
| `--mt-press-distance` | `1px` | Pointer-down translation |
| `--mt-motion-press` | `120ms` | Press feedback |
| `--mt-motion-fast` | `160ms` | Hover, focus-adjacent, disclosure |
| `--mt-motion-state` | `220ms` | Inline state insertion and mobile menu |
| `--mt-ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | All MariTools transitions |
| `--mt-popover-z` | `40` | Tools mobile navigation above content and below critical site overlays |

Do not use the parent fluid heading tokens inside MariTools. Page and section typography remains fixed. Responsive changes alter structure and spacing, not type continuously.

## Shell

### Desktop and tablet

`.mt-shell` is a two-column grid below the existing site header. Use `15rem minmax(0, 1fr)` at 80rem and above, and `13.5rem minmax(0, 1fr)` from 48rem to 79.99rem. It fills the viewport height remaining after the site header and footer but may grow with content.

The sidebar is `position: sticky; top: 0` only if the site header is not sticky. If the site header becomes sticky, use its measured CSS custom property as the sidebar top. The sidebar must never slide under the header. Its background is `--mt-mist`; its right edge has a 1px `--mt-rule` border. Padding is 1.5rem top, 1rem inline, and 2rem bottom.

The brand link reads `MariTools`, uses Inter Tight at 1.125rem/1.15 and weight 680, and occupies 2.75rem minimum height. It returns to `/tools`.

Navigation is grouped visually without adding routes:

- `Plan`: Schedule, Free Time
- `Courses`: Semester, Catalog
- `Community`: Clubs, Forum

Group labels use Inter at 0.75rem, weight 650, sentence case, muted color, and 1rem top margin after the first group. Do not use all caps or letter spacing. Each link is a 2.75rem row with 0.75rem inline padding. The current route uses ink text, a white background, and a 3px blue inset rule on its leading edge. Hover uses white at 65% opacity. Focus uses the global blue outline. The Forum link remains current on a thread route.

The sidebar contains no Account link, term selector, auto-term badge, Programming Club credit, initiative strip, cart, Book Delivery link, or promotional callout.

The main pane has `min-width: 0`, paper background, and no inner shadow. Each page uses the shared page frame with maximum width 76rem, inline margins auto, and page padding `2rem 2rem 3rem`. Pages narrower than the maximum remain aligned to the shell edge rather than centered as narrow cards.

### Existing site header

Keep the existing Programming Club header and its Account and Sign up actions. `MariTools` may remain the single club-navigation entry that leads to `/tools`; do not add a second MariTools link elsewhere in that header. On any `/tools/account` path, Account receives `aria-current="page"`. On every other tools route, Account is neutral. Sign up remains the club registration action and must not be relabeled as MariTools sign-in.

### Mobile tools navigation

Below 48rem, the sidebar becomes a 3rem-high sticky subheader directly below the site header. It contains:

- A left-aligned `MariTools` home link.
- A right-aligned disclosure button whose visible label is the current route, for example `Schedule`, followed by a down chevron.

The disclosure opens a full-width anchored popover below the subheader. Use the Popover API or a portal/fixed layer so no overflow ancestor clips it. The panel has white background, 1px strong top and bottom rules, and a single `0 0.75rem 1.5rem rgb(6 20 49 / 14%)` shadow. It lists the same three groups and six links in source order. Account is not duplicated there. Escape closes the panel and returns focus to the button. Route change and outside press close it. Closed links are removed from keyboard order. The current link has `aria-current="page"`.

At widths below 24rem, the disclosure button may show `Tools` instead of the current route only when the two labels would collide. Its accessible name remains `Open MariTools navigation, current page: [route]`.

## Shared page anatomy

Every route uses these vertical regions in order:

1. `MtPageHeader`
2. Optional `MtNoticeStack`
3. Primary task or filters
4. Result or review content
5. Secondary contribution or moderation area

`MtPageHeader` has a 2rem h1, then a single paragraph at 1rem with a 52ch maximum. Gap between h1 and copy is 0.5rem. The header ends 1.5rem before the first task control. Do not add eyebrows, route numbers, decorative rules, or action buttons unless the page has one unambiguous global action.

Major sections start with a 1px rule and 1.5rem top padding. Section headings use 1.125rem/1.3 at weight 680. A workflow step heading may use `01`, `02`, or `03` in mono at 0.75rem only when the page has multiple sequential steps. Browse pages do not use step numbers.

## Shared component inventory

All components use the `Mt` prefix. They should own their complete state vocabulary so route files do not restyle controls independently.

| Component | Contract and states |
| --- | --- |
| `MtShell` | Desktop sidebar, mobile tools subheader, current-route resolution, skip target, and main frame. Accepts route groups and pathname. |
| `MtSidebarNav` | Renders the three labels and six links. States: default, hover, focus-visible, current. |
| `MtMobileNav` | Anchored popover with focus return, Escape/outside close, current route, and no clipped overlay. |
| `MtPageHeader` | Required title and optional one-paragraph description. No free-form decorative slot. |
| `MtSection` | Optional heading, description, top rule, and content. Supports `density="standard|compact"`. |
| `MtField` | Label, optional hint, control slot, error, required marker expressed in text, and `aria-describedby` wiring. States: default, hover, focus, filled, invalid, disabled, read-only. |
| `MtTextInput` | 2.75rem control using shared borders and focus. Supports mono mode for identifiers only. |
| `MtTextarea` | Vertical resize, 8rem minimum, source mode in mono, compose mode in Inter. |
| `MtSelect` | Native select affordance with the same height and focus treatment as inputs. |
| `MtChoiceGroup` | Fieldset and legend for radio or checkbox groups. Full label row is clickable; each target is at least 2.75rem. |
| `MtFileInput` | Native file input within a ruled upload row. Shows accepted type and selected filename as text. No fake drag-and-drop requirement. |
| `MtButton` | Variants `primary`, `secondary`, `quiet`, `danger`. States: default, hover, focus, active, disabled, loading. Loading keeps width, changes label to a verb in progress, and sets `aria-busy`. |
| `MtDisclosure` | Native details or button disclosure. Chevron rotates 90 degrees over 160ms. Summary target is at least 2.75rem. |
| `MtFilterBar` | Rule above and below, label/control grid, submit aligned to control baseline. On mobile it becomes one column. Filters remain GET forms. |
| `MtNotice` | Variants info, warning, error, success. Uses a 3px leading rule and tinted background, never an icon alone. `role="alert"` only for blocking errors; status for non-blocking updates. |
| `MtSkeletonRows` | Static mist blocks matching final row geometry. Container has `aria-busy="true"` and one screen-reader loading sentence. No shimmer or looping animation. |
| `MtEmptyState` | Left-aligned heading or strong sentence, one explanatory sentence, and at most one useful action. No illustration. Distinguishes no data from no filtered matches. |
| `MtRuledList` | List with one outer top and bottom rule and internal row rules. Rows never become cards. |
| `MtMetaLine` | Wrap-safe metadata using text spans separated by spacing and visible labels, never middle-dot glyphs. |
| `MtCode` | Mono identifier with tabular numerals. It does not add a chip background by default. |
| `MtStatusTag` | Compact text for `Required`, `Locked`, `Pending`, or `Staff`. Square 0.25rem radius, 1px border, sentence case. Never used for ordinary metadata. |
| `MtAuthGate` | Inline ruled message explaining why sign-in or profile completion is needed, with one link to `/tools/account`. No modal. |
| `MtInlineActions` | Wrapping row with primary action last in DOM only when that matches reading order. On mobile, primary becomes full width; quiet actions remain natural width. |
| `MtWeekGrid` | Shared timetable frame with weekday header, time rail, horizontal overflow wrapper, overlap semantics, and mobile day sections. Schedule and free-time use distinct variants. |
| `MtRecordEditor` | Ruled editable record with title, metadata, fields, and nested meeting rows. Used by parsed schedule courses and extracted outline records. |
| `MtComposer` | Form section for a club, thread, or reply. Uses the standard fields, a 44rem maximum, local error placement, and persistent typed values after server error. |
| `MtReportDisclosure` | Quiet `Report` button that reveals an inline reason field and actions. It is closed initially and never opens a modal. |

### Control interaction rules

- Hover changes border or background only on devices that support hover.
- Active buttons translate down 1px for 120ms. No scale effect.
- Focus-visible is a 3px blue outline with 2px offset. Error borders remain visible inside the outline.
- Disabled controls use 52% opacity and a not-allowed cursor. Loading controls use 68% opacity and a progress cursor; they remain disabled to repeat submission.
- Input errors sit directly below the control at 0.75rem and use danger text. A form-level error appears above the first field only when it cannot be assigned to one field.
- Successful form feedback sits after the submit row and receives focus only after a full navigation. Inline enhancement announces it through a polite live region without moving focus.
- Destructive staff actions use the danger variant and require an inline confirmation row. Do not use a generic browser confirmation dialog as the designed state.

## Route specifications

### `/tools`: directory

**Purpose:** Route a student to one of six tools in one scan.

**Layout:** The page uses a two-column directory at 64rem and above. The left column is a 17rem introduction rail with the `MariTools` heading and the existing factual line. The right column is a ruled index grouped under `Plan`, `Courses`, and `Community`. At narrower widths it becomes one column, with the intro followed by the index.

Each route row is at least 4rem high and uses a three-column desktop grid: route name `10rem`, factual summary `minmax(0, 1fr)`, right arrow `1rem`. On mobile, name and summary stack and the arrow aligns to the top. Entire rows are links. Hover fills mist and turns only the name and arrow blue. The directory repeats neither Account nor Sign up.

**States:** Content is static, so no skeleton is shown. Current keyboard focus uses the shared outline around the full row. If a tool is ever unavailable, keep its row visible with an `Unavailable` status tag and remove navigation semantics; do not silently hide it. This state is not added until the application exposes availability data.

**Route tokens:** `--mt-home-intro-w: 17rem`; `--mt-home-row-min: 4rem`; `--mt-home-name-w: 10rem`.

### `/tools/schedule`: paste, review, timetable, export

**Purpose:** Turn an Omnivox compact course list into an editable week view and an ICS file.

**Layout and sequence:**

1. `MtPageHeader` uses `My schedule` and the current privacy sentence.
2. A closed `MtDisclosure` titled `How to copy your Omnivox list` contains the numbered instructions. It has a top and bottom rule, not a panel.
3. The source form uses a `MtTextarea` in mono, 15rem minimum height, with `Read schedule` below it. At 70rem and above, the source field occupies 65% of the available width and a 35% adjacent note rail explains accepted input in no more than three short points. Below 70rem, the note follows the field.
4. A successful parse reveals `Review courses`, then `Week`, then `Export` as three ruled sections. Do not animate the page as a sequence. Only the newly inserted section may fade in over 160ms.

**Review courses:** Each course is one `MtRecordEditor`. The header line shows course code in mono, section with a visible `Section` label, and teacher. The editable title follows. Meeting rows use columns `Day`, `Time`, and editable `Room`. On mobile they wrap to two lines without dropping labels. Warnings attach to the relevant course when possible; unassigned parser warnings appear as one warning notice above the list.

**Week grid:** At 64rem and above, render a registrar timetable with a 4.5rem time rail and five equal weekday columns. The visible day runs from the earliest meeting rounded down to the hour to the latest meeting rounded up, clamped to 08:00 through 19:00. One hour equals 4rem. Major hour rules are strong enough to track across columns; half-hour rules are 8% ink. Meeting blocks sit on the time grid with 0.25rem inset, white background, 1px blue border, and a 3px blue leading rule. They show time, course code, title truncated to two lines, and room. Overlapping meetings use a danger leading rule and an `Overlap` text label. Color alone never carries overlap state. Empty weekdays show `No classes` in the day header region, not a full-height message.

If the five columns would fall below 10.5rem, keep the desktop grid at its minimum width in a horizontally scrollable region. Provide a visually hidden instruction: `Scroll horizontally to view all weekdays.` The weekday header and time rail remain sticky within the scroll container. Below 40rem, replace the spatial grid with five day sections in Monday-to-Friday order. Each section lists chronological meetings as ruled rows; do not squeeze five columns into the viewport.

**Export:** The primary action reads `Download calendar (.ics)`. Beneath it, show the three existing import notes in a compact disclosure titled `How to import this file`. If automatic term resolution fails, the error copy is `We could not determine the current term, so calendar export is unavailable.` Do not tell the student to choose a term in the tools bar because no such control exists. If rules are missing, use `Calendar dates are not available for the current term.`

**States:**

- Initial: empty paste field, closed help, no results.
- Parsing: button label `Reading schedule…`, source field read-only, no skeleton because parsing is local and brief.
- Invalid: error notice after the form; preserve the paste and focus the notice.
- Parsed with warnings: warning notice plus editable course records.
- Parsed: editable records, grid, export.
- Overlap: danger annotation on affected records and grid blocks.
- Exporting: button label `Preparing calendar…` if work exceeds 150ms.
- Export failure: local error below export button.

**Route tokens:** `--mt-source-min-h: 15rem`; `--mt-schedule-hour: 4rem`; `--mt-schedule-block-inset: 0.25rem`; `--mt-schedule-day-min: 10.5rem`; `--mt-schedule-time-rail: 4.5rem`.

### `/tools/free-time`: multi-person comparison

**Purpose:** Compare two or more Omnivox schedules and find shared gaps without exposing course names in the exported busy-time file.

**Layout and sequence:** Start with the page header. The input area is a ruled workbench with a compact settings row first, schedule pastes second, and actions third.

The settings row contains `Minimum gap` as an `MtChoiceGroup` and `Optional date` as an `MtField`. At 64rem and above, they sit in a `minmax(24rem, 2fr) minmax(14rem, 1fr)` grid. Gap options are segmented radio rows, not pills. The custom-minute input appears directly after `Custom`, is 8rem wide, and keeps the 15 to 240 range hint visible.

Schedule paste fields use a two-column grid at 64rem and above. Added people fill additional rows. Each field heading reads `Person 1 schedule`, `Person 2 schedule`, and so on. `Remove` is a quiet action in that field's heading and appears only when more than two fields exist. Do not call people `Schedule 1` because the comparison is person-based. Source fields use mono and have a 10rem minimum height.

The action row places `Find shared free time` first visually and as the only primary button. `Add another person` and `Download busy times (.json)` are secondary. On mobile, the primary action spans the width and comes before secondary actions in reading order.

**Results:** If an optional date exists, show its result before the recurring week because it is more specific. The date heading uses the formatted local date; the effective weekday appears in a labeled metadata line such as `Schedule followed: Monday`. Do not concatenate the values with punctuation. Slots render as mono ruled rows.

The recurring week uses `MtWeekGrid` in free-time variant. At 48rem and above, use five columns with weekday headers. Each available block is a white row with a blue 3px leading rule and mono time range. There is no vertical hour scaling because the output is a list of candidate gaps, not a calendar. A day with no qualifying gap says `No gap of [n] minutes or longer`. Below 48rem, weekday sections stack.

**States:**

- Initial: two blank person fields, 45 minutes selected, no results.
- Invalid people: error `Paste valid schedules for at least two people.` Preserve all text and mark only invalid non-empty pastes.
- Invalid custom duration: field error with range.
- Comparing: primary button `Comparing…`; no skeleton for local work.
- Results: optional date result and week matrix.
- No weekly match: teaching empty state `No shared gap meets this duration. Try a shorter minimum gap.` with a quiet focus link back to Minimum gap.
- No date match: local empty message inside the date section; weekly results remain visible.
- Date outside class dates: warning tied to the date field; weekly results still render.
- Term unresolved or calendar rules missing: date-specific warning only. Do not discard the recurring comparison.
- Busy download error: local error in the actions region.

**Route tokens:** `--mt-person-textarea-min-h: 10rem`; `--mt-free-settings-min: 24rem`; `--mt-free-date-min: 14rem`; `--mt-free-day-min: 9rem`; `--mt-free-slot-row: 2.5rem`.

### `/tools/semester`: upload, extract, review, contribute

**Purpose:** Save a course outline privately, review extracted assessment and textbook facts, and optionally copy confirmed structured fields into the shared catalog.

**Layout:** Use a single 44rem work column aligned to the main pane's leading edge. The page header states that only text PDFs work and that the student must check extracted data. Auth and disclosure gates occupy the exact position of the upload form so the workflow does not jump between unrelated page regions.

The upload phase is `01 Upload outline`. `MtFileInput` shows `PDF, text-based, maximum size from server policy` as its hint. The developer must bind the real server limit into this copy rather than inventing a number. `Read outline` is the primary action.

The review phase is `02 Check extracted fields`. The course identity fields appear in a two-column grid: Course code and Section in the narrow column; Title and Teacher across the remaining width. Below 36rem, all fields stack. Assessment records use columns Title, Weight, Date. Book records use Title, Author, ISBN, Required. Each extracted record is separated by a rule and remains editable. Mono applies to course code, section, date, and ISBN only.

The contribution phase is `03 Private or shared`. The privacy explanation comes before the checkbox. The checkbox label is exactly `Share these confirmed fields to the course catalog`. When unchecked, no submit action appears because private extraction has already been saved by the upload flow. When checked, required course identity fields show inline validation and the primary action appears as `Share to catalog`. A blue-soft notice states `Only the fields shown here are shared. The PDF stays private.`

**Auth gates:**

- `need-sign-in`: `Sign in to upload and save an outline.` Action `Go to account`.
- `need-profile`: `Finish your account before saving outlines.` Action `Finish account`.
- `need-disclosure`: `Review the NVIDIA outline-analysis disclosure before sending outline text for analysis.` Action `Review disclosure`.

Each action links to `/tools/account`. Do not use a modal or duplicate Google sign-in on this page.

**States:**

- Gated by sign-in, incomplete profile, or missing disclosure.
- Upload idle and file selected.
- Uploading: selected filename remains visible; button reads `Uploading outline…`.
- Extracting: show three static skeleton record rows under `Checking outline`; set the section busy.
- Extraction success: editable fields and privacy choice.
- Cache hit: informational notice `Loaded the saved extraction for this file.`
- Automatic extraction unavailable: warning that manual review fields are available and the upload remains private.
- No assessments or no books: in the corresponding subsection, state `No [records] were extracted. Check the outline before sharing.` Do not imply the outline has none.
- Invalid file or server error: error notice next to upload; preserve the selected filename only when the browser permits it.
- Contribution validation error: preserve all edits and checkbox state; focus the first invalid field.
- Contributing: button `Sharing…`.
- Success: success notice `Saved to the course catalog.` and a link to `/tools/catalog` with the relevant filters only if the route can construct them from confirmed data.

**Route tokens:** `--mt-semester-max: 44rem`; `--mt-review-narrow: 9rem`; `--mt-review-row-gap: 1rem`; `--mt-extract-skeleton-h: 4.5rem`.

### `/tools/catalog`: shared course facts

**Purpose:** Browse student-contributed course facts by term and course code. Textbooks are reference data, never products.

**Layout:** The page header is followed by a single `MtFilterBar`. Term is a native select up to 16rem. Course code is a mono text field up to 16rem. `Show courses` is the primary button. This page is the only tools page with a user-facing term filter. The shell gains no term control.

Results use `MtRuledList`. Each course row uses a two-part desktop grid: a 15rem identity rail and a flexible facts column. The rail shows course code, title, term, section, and teacher with visible metadata labels. The facts column has Assessments followed by Textbooks. Assessments use aligned columns Name, Weight, Date. Textbooks use Title, Author, ISBN, Status. Rows with missing fields retain their column and show an em dash only as missing-data content; do not collapse the alignment.

The section heading is `Textbooks`, not `Books`, and a persistent line below it reads `Course reference only. MariTools does not sell books.` There is no price, bookstore link, cover art, add-to-cart action, Book Delivery link, or purchase language. Required status uses an `MtStatusTag`; optional status is plain text.

At widths below 56rem, identity and facts stack. Assessment and textbook subrows remain horizontal until 40rem, then become labeled definition rows. Never make each catalog entry a rounded card.

**States:**

- Initial load: filter values visible plus five static skeleton result rows.
- Results: show a count line `N entries` before the list. Do not make counts promotional.
- No published data with no filters: teaching empty state `No course facts have been published yet.` with a link to Semester only if the user can contribute.
- No filtered matches: `No courses match these filters.` plus `Clear filters` as a secondary link.
- Unavailable: error notice and `Try again` submit action; filters stay usable.
- Partial entry: omit an entirely empty subsection, but keep known identity metadata.

**Route tokens:** `--mt-catalog-identity-w: 15rem`; `--mt-filter-control-w: 16rem`; `--mt-assessment-cols: minmax(12rem, 1fr) 5rem 8rem`; `--mt-book-cols: minmax(12rem, 1.4fr) minmax(8rem, 1fr) 9rem 5rem`.

### `/tools/clubs`: browse and submit

**Purpose:** Find staff-checked campus club listings and, when signed in, submit one for review.

**Layout:** Search and Category sit in `MtFilterBar`, each up to 16rem, followed by `Show clubs`. Results use a ruled list. A desktop club row uses a 12rem identity column for name and category, a flexible description column, and a 10rem links column. With multiple links, stack them as underlined text. At widths below 56rem, the three regions stack with 0.5rem gaps.

The contribution area begins after the results with a strong top rule and heading `Submit a club`. It stays in the same page, never in a modal. Signed-out users see an `MtAuthGate`. Signed-in users see a 36rem `MtComposer` with Club name, Category, Description, Link label, and Website. Server errors preserve entered values. The success notice reads `Sent for staff review.` and replaces the submit button until the form changes.

Staff-only pending listings follow the contribution area under `Pending listings`. Each pending row shows all submitted fields before the Publish action. `Publish` is primary but compact. If publishing changes public visibility immediately, expose an inline confirmation sentence before submission. The empty state reads `No listings are waiting for review.`

**States:**

- Initial loading: filter bar plus four static skeleton rows.
- Published results.
- No clubs at all: `No club listings have been published yet.`
- No filtered matches: `No clubs match this search and category.` plus Clear filters.
- Unavailable: local error with retry.
- Signed out contribution gate.
- Signed in composer: idle, invalid, submitting, error, submitted.
- Staff pending: loading, empty, rows, publishing, published, publish error.

Rooms remain absent until the product exposes staff-verified room data. The redesign must not create room placeholders or imply campus approval.

**Route tokens:** `--mt-club-identity-w: 12rem`; `--mt-club-links-w: 10rem`; `--mt-club-compose-max: 36rem`; `--mt-club-description-max: 68ch`.

### `/tools/forum`: thread list and compose

**Purpose:** Let anyone read course-tagged or student-life threads and let signed-in students create one.

**Layout:** Category and Course filters use native selects in `MtFilterBar`. The course control stays enabled for all categories so the current backend behavior is preserved; if product logic later makes it irrelevant, disable it only after the category change is explicit and announce the change.

Thread results are a ruled index. Each row is a full-width link with title in the flexible first column, category in a 7rem column, course code in a 7rem mono column, and a right arrow. Missing course tags show `No course` as muted text. On mobile, title sits first and a labeled metadata line follows. Do not use middle-dot separators.

The signed-in composer begins after a strong rule under `Start a thread`, max width 44rem. Category, Course tag, Title, and Body use shared fields. Body uses Inter, not mono. The primary action is `Post thread`. Signed-out users see `Sign in to start a thread` and a link to Account. Course tags remain sourced from the catalog.

**States:**

- Initial loading: filters plus six static thread rows.
- Results.
- No threads at all: `No threads have been posted yet.` Signed-in users get a focus link to the composer.
- No filtered matches: `No threads match these filters.` plus Clear filters.
- Unavailable: error and retry while filters remain.
- Signed out composer gate.
- Compose idle, invalid, posting, server error. Preserve input on error.
- Successful create follows the server redirect to the new thread; do not leave a duplicate success banner on the list.

**Route tokens:** `--mt-thread-category-w: 7rem`; `--mt-thread-course-w: 7rem`; `--mt-thread-composer-max: 44rem`; `--mt-thread-row-min: 3.75rem`.

### `/tools/forum/[threadId]`: thread and replies

**Purpose:** Read one discussion, reply when allowed, report content, and expose staff moderation without turning the page into an admin dashboard.

**Layout:** Start with a text breadcrumb `Forum / [thread title]`; the slash is an ordinary separator with spacing and is hidden from assistive technology. The h1 uses 1.75rem desktop and 1.5rem mobile because thread titles can be long. Below it, a labeled metadata row shows Category and Course when present. `Locked` appears as an `MtStatusTag` beside the metadata.

The original post and each reply use one shared post pattern. A 9rem metadata rail may later hold author and time if real data is exposed; until then it is not rendered. Current content therefore uses a single prose column capped at 72ch. Preserve paragraph line breaks safely. Every post begins with a top rule. Report is a quiet action after the body. Activating it reveals `MtReportDisclosure` inline with a reason field, Cancel, and `Send report`. Do not show a report text field on every post by default.

Replies use an ordered visual sequence but a semantic unordered list unless reply order has an explicit ordinal meaning. The heading includes the real count only when the server provides it. Empty state reads `No replies yet. Start the conversation.` only for a user who can reply; otherwise use `No replies yet.`

The reply composer follows the list and uses a 44rem `MtComposer`. If the thread is locked, replace it with an informational notice `This thread is locked. New replies are closed.` If the user is signed out and the thread is open, show an auth gate. If server policy sets `canReply` false for another reason, show only a factual notice supplied by the server. Do not guess the reason.

Staff moderation is the last section and uses a mist background with a strong leading rule. `Lock thread` is secondary. `Remove thread` and `Remove reply` are danger actions. A first press reveals inline confirmation with Cancel and the final action. Moderation controls must never sit between post body paragraphs.

**States:**

- Loading: header skeleton, one post skeleton, and three reply skeletons.
- Thread available, open or locked.
- Not found: page-level empty state `That thread is not available.` with Back to forum.
- Unavailable: error notice and Back to forum.
- Replies empty or populated.
- Signed out, signed in but cannot reply, can reply, posting, reply error, reply posted.
- Report disclosure closed, open, submitting, reported, report error.
- Staff moderation idle, confirming, submitting, success, error.

Success notices appear beside the action's region, not collected at the page bottom. When enhancement is unavailable and the server returns them at page level, move focus to the notice and include a link back to the affected content.

**Route tokens:** `--mt-thread-prose-max: 72ch`; `--mt-thread-title: 1.75rem`; `--mt-thread-title-mobile: 1.5rem`; `--mt-post-gap: 1.5rem`; `--mt-moderation-max: 44rem`.

### `/tools/account`: identity, profile, disclosure

**Purpose:** Sign in with Google, complete the MariTools student profile, and record the NVIDIA outline-analysis disclosure decision.

**Placement:** Account stays in the existing site header and never appears in the tools sidebar. The account page still uses the tools shell so navigation back to campus tasks remains available.

**Layout:** Use a 42rem single work column. The page header changes its description by account state but keeps the title `Your account`. Error and recovery notices come immediately after the header.

Guest state shows one primary `Continue with Google` button and the factual sentence that any Google account works. Do not use Google brand colors unless the official Google sign-in asset and its usage rules are adopted as a separate product decision.

Incomplete state shows the signed-in email as a read-only definition row, then fields for Student number, optional Display name, and the NVIDIA disclosure checkbox. The student number hint says `5 to 8 digits` if that matches server validation. It uses numeric input mode but remains a text input so leading zeroes survive. The disclosure copy is rendered in full. Do not hide it behind a tooltip.

Complete state uses a ruled definition list with Email, optional Display name, Student number status, and NVIDIA outline analysis status. Never echo the student number. If disclosure remains unaccepted, show a focused update form below the definition list with student number and full disclosure, matching current server requirements. Do not imply that account completion authorizes sharing to the catalog; sharing is a separate Semester checkbox.

**States:**

- Guest idle.
- Opening Google sign-in: button label `Opening Google…`, disabled, polite status.
- Google authorization start failed: error beside button; button returns to enabled.
- Recovery error and account unavailable: separate error notices if both exist, with duplicate copy collapsed.
- Incomplete profile: idle, invalid student number, saving, server error, saved.
- Complete profile with disclosure accepted.
- Complete profile without disclosure, with update form.
- Saved: success notice `Account saved.` and no automatic redirect.

**Route tokens:** `--mt-account-max: 42rem`; `--mt-profile-label-w: 11rem`; `--mt-disclosure-max: 60ch`.

## Loading, empty, error, and success behavior

Server-loaded browse pages show static skeletons only in the results region. Headers and filters render immediately. Never replace a whole page with a centered spinner. Local calculations under 150ms keep the existing content and show only button busy state.

Empty states must identify the reason:

- No published records: teach how records appear.
- No filtered matches: name the filters and offer Clear filters.
- No result from a calculation: suggest the one control most likely to change the outcome.
- Permission gate: name the blocked action and link to Account.

Errors use plain language and retain recoverable input. A route outage does not remove filters, navigation, or previously rendered data. If stale data remains visible after a refresh error, label it `Could not refresh. Showing the previous results.`

Success feedback names what changed. Avoid generic `Done` or `Success`. It remains visible until the next relevant edit or route change.

## Responsive behavior

Breakpoints are structural:

- `80rem and above`: 15rem sidebar, 2rem main gutter, full data grids.
- `48rem to 79.99rem`: 13.5rem sidebar, 1.5rem gutter, two-column forms where specified.
- `below 48rem`: mobile tools subheader, 1rem gutter, 3rem touch controls, stacked filters and form fields.
- `below 40rem`: schedule becomes day lists; catalog fact tables become labeled definition rows.
- `below 24rem`: mobile tools disclosure may shorten its visible label to `Tools`; actions stack when labels collide.

Horizontal scrolling is allowed only for the desktop schedule grid between 40rem and the width needed for five 10.5rem day columns. It is not allowed for ordinary forms, filters, catalog records, club lists, forum rows, or account content.

On-screen keyboards must not hide the active control or primary submit action. Use `scroll-margin-block: 6rem` on fields and notices. Textareas resize vertically. Long course names, URLs, thread titles, and user text wrap without widening the page.

## Keyboard and assistive technology

- Preserve the global skip link and point it at the tools main pane.
- Sidebar and mobile navigation use a real `nav` with label `MariTools`.
- Current links use `aria-current="page"`.
- Every filter and form has a programmatic label. Placeholder text never replaces a label.
- Form errors connect through `aria-describedby`; invalid controls set `aria-invalid="true"`.
- Notices use alert only when immediate attention is required. Routine loading and success use polite status.
- Timetable blocks are also available in DOM reading order by weekday and time. Visual CSS placement must not scramble reading order.
- Schedule overlap, required textbook, locked thread, and error state always include text, not color alone.
- Mobile popover focus stays in ordinary document order; because it is not modal, do not trap focus. Closed contents are inert.
- After adding a person, move focus to the new schedule heading or textarea. After removing one, move focus to the preceding person's Remove action or heading.
- After server validation, focus the first invalid field. After route-level failure or not-found, focus the page-state heading.
- All pointer targets are at least 2.75rem desktop and 3rem mobile.

## Motion

Motion reports state and never delays work.

| Event | Duration | Property |
| --- | --- | --- |
| Button press | 120ms | `transform: translateY(1px)` |
| Hover and selected background | 160ms | background, border, color |
| Disclosure chevron | 160ms | transform |
| Mobile navigation open or close | 220ms | opacity and `translateY(-0.25rem)` to zero |
| Newly inserted notice or result section | 160ms | opacity only |
| Skeleton | none | Static fill, no shimmer or pulse |

There is no page-load choreography, staggered list entrance, animated timetable drawing, parallax, spring scaling, or looping ambient effect. Under `prefers-reduced-motion: reduce`, set durations to `1ms`, remove transforms, and keep every state change immediate. Smooth scrolling is disabled.

## Content rules

- Use `Free Time` in sidebar navigation and `Common free time` as the page title.
- Use `Course catalog` as the page title and `Catalog` in compact navigation.
- Use sentence case everywhere.
- Never use center-dot characters in metadata. Use a labeled layout, line break, comma, slash in a breadcrumb, or separate columns.
- Do not invent term names, dates, room information, authors, post times, reply counts, or staff status.
- Do not call catalog textbook data a shop, inventory, or available book.
- Do not call Programming Club registration `MariTools sign-in`. `Sign up` stays a separate club action.
- Privacy statements must describe actual behavior. Do not claim that data never leaves the browser when a server action processes it.

## Anti-goals

- No dashboard overview with activity metrics, greetings, streaks, saved-item counts, or recommendation cards.
- No rounded card grid for tools, courses, clubs, threads, posts, or account fields.
- No neon, phosphor green, terminal prompt motifs, scan lines, graph paper, notebook doodles, or school mascot decoration.
- No warm cream, beige, parchment, coral accents, or pastel category palette.
- No global term selector or hidden term control in tools chrome.
- No Account item in the sidebar or mobile tools popover.
- No duplicate MariTools links in the club header.
- No Programming Club initiative strip inside the tools shell.
- No Book Delivery navigation, pricing, cart, checkout, cover art, or purchase action.
- No modal for sign-in, compose, report, upload, contribution, or ordinary validation.
- No display font in buttons, fields, filters, data rows, or navigation.
- No decorative uppercase eyebrows, pill-shaped metadata, or icon-only operational actions without accessible text.
- No centered spinner, whole-page loading curtain, or skeleton motion.
- No fixed action bar that covers timetable or form content on mobile.

## Arena grafts (synthesized from parallel candidates)

These refinements were grafted from Codex (GPT) and Grok CLI candidates after cross-judge scoring. Base: candidate 1.

**From candidate 3 — `MtWeekGrid` geometry.** Window 08:00–18:00, five weekday columns. Grid: `grid-template-columns: var(--mt-grid-time-col) repeat(5, minmax(0, 1fr))` on a raised paper frame with strong outer rule, no shadow. Time rail labels each hour in mono; half-hour rules between. Meeting blocks use absolute positioning with `top`/`height` derived from minutes since 08:00 and `--mt-grid-row-h` per 30-minute slot. Schedule uses occupied meeting fills; free-time uses gap rows (no vertical hour scaling).

**From candidate 2 — Semester form grid.** Course identity fields use a 12-column row: code 3, title 5, section 2, teacher 4; wrap to two rows below 54rem.

**From candidate 2 — Acceptance checklist.**

- Every `/tools` route uses the same shell, page header, controls, rules, messages, and loading grammar.
- Schedule desktop grid reads as a registrar timetable; mobile becomes a readable day agenda.
- Free Time is visually related to Schedule but communicates availability, not classes.
- Every route specifies loading, empty, error, and success states where applicable.
- Auth gates preserve the surrounding task and link to Account without adding Account to the sidebar.
- Catalog textbooks remain reference facts with no commerce affordance.
- Automatic term resolution only; no term selector in tools chrome.
- First useful control appears in the first viewport on every route.
- All controls have default, hover, focus, active, disabled, loading, and invalid behavior.
- Mobile, keyboard, screen reader, 200% zoom, and reduced-motion behavior are complete.

**Rejected from candidate 4:** Copy that asks users to “choose a term in the tools bar” (contradicts automatic term resolution). **Rejected from candidates 3–4:** Center-dot metadata separators (conflicts with plain-language copy rules).

## Implementation order

Implementation should preserve a usable vertical slice at every phase.

1. **Foundation and shell.** Add scoped `--mt-*` properties, `MtShell`, desktop sidebar, mobile tools navigation, page frame, and current-route behavior. Verify `/tools`, `/tools/forum/[threadId]`, and `/tools/account` current states, keyboard navigation, mobile menu closure, and the absence of Account and term controls in the sidebar.
2. **Shared controls and states.** Build fields, buttons, notices, filter bar, ruled list, empty state, static skeletons, auth gate, and composer. Replace route-local variants only after every required state exists in the shared component.
3. **Schedule vertical slice.** Implement paste, parse error, editable review, responsive registrar grid, overlap annotation, and ICS export. Run the smallest real journey: paste a representative Omnivox list, correct a room, inspect desktop and mobile week views, and download an ICS file.
4. **Free-time comparison.** Reuse source fields and week-frame behavior, then verify two schedules, added and removed people, custom duration errors, a date outside class dates, weekly results, and JSON download.
5. **Semester flow.** Implement the three auth gates, upload and extraction states, editable review, private default, explicit contribution, and catalog success path. Test a real text PDF and the manual fallback separately. Never use a synthetic extraction result as proof that PDF upload works.
6. **Browse pages.** Implement Catalog, Clubs, and Forum list using the filter and ruled-list components. Verify initial, populated, no-data, no-match, unavailable, signed-out, and signed-in states. Confirm catalog textbooks contain no commerce affordance.
7. **Thread and account.** Implement thread reading, reply gates, inline reporting, staff confirmations, and every account state. Verify long content, locked threads, sign-in failure, incomplete profile, and unaccepted disclosure.
8. **Responsive and accessibility pass.** Test 1440 by 900, 1024 by 768, 768 by 1024, 390 by 844, and 320 by 568. Complete keyboard-only journeys, screen-reader labeling checks, 200% zoom, forced colors, reduced motion, and long-content stress tests.
9. **Visual consistency pass.** Remove route-local control styles, verify all property values against this table, check rule alignment and first-viewport requirements, and confirm no anti-goal has returned.

The first product proof is the Schedule journey in step 3, not the completion of the component library. Shared components should be sufficient to make that journey real, then expand only as later routes require them.
