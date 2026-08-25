# Phase 5. Native Omnivox tutorial

Back: [overview](./overview.md)

## Goal

A student who does not know Omnivox can follow in-product steps and return to the paste box. No Scribe embed, iframe, or runtime dependency.

## Changes

- `/tools/schedule/how` (or a panel on My Schedule) with the real 9 steps.
- Button labels from the screenshots, not the Scribe captions: **Obtain my schedule**, printer banner, **Compact printable semester schedule**, **View**.
- Tell them to copy the **right-hand numbered list**, not the grid, not the name/student-number header.
- Static images under `static/maritools/omnivox/`, cropped so the captured legal name and student number are not shipped.
- After the last step, a control returns to the paste field.

## Data structures

Step records: `n`, `title`, `body`, `imageSrc`, `imageAlt`. No CMS.

## Verification

**Static.** Component test that all 9 steps render and the return control points at the paste UI. `npm test`.

**Runtime.** Walk the tutorial on desktop and a phone-width viewport. Confirm cropped screenshots show no student number.
