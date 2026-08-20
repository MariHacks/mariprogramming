# Reference-accurate club website design

## Purpose

Rebuild the Marianopolis Programming Club website around the supplied reference composition. The homepage must feel like a direct implementation of that layout, not another interpretation of the same general style. The remaining public pages inherit the same typography, rules, spacing, navigation, imagery, and footer.

The homepage has one primary job: help Marianopolis students understand the club and open the Fall 2026 interest form.

## Verified destinations

- Fall 2026 interest form: `https://docs.google.com/forms/d/e/1FAIpQLScgamwSUyaJO6wyY0w2KPxsJ_l7wdORyR37vhuHn209l7os0g/viewform?usp=header`
- Instagram: `https://www.instagram.com/mari_programming_club/`
- Discord: `https://discord.gg/c6JJw9d`
- MariHacks: `https://www.marihacks.com/`

## Visual authority

The reference image at `/Users/sony0627/.codex/generated_images/019fb964-8edf-7771-8380-b490ae6e4fda/exec-4322d2d1-9593-4fa3-955c-1dc29c192614.png` is the visual authority for composition and density.

The implementation preserves these traits:

- A white header with the compact Marianopolis Programming Club mark at left, a calm central navigation, icon-only social links, and a blue `Sign up` action at the top right.
- A desktop hero split close to 47 percent copy and 53 percent photography, with no gutter between the two halves.
- A large three-line headline, short supporting paragraphs, one filled action, one quiet text action, and a plain eligibility note.
- A four-column activity band separated by vertical rules.
- A two-column archive and Book Delivery band separated by a central rule.
- A four-column Programming Hub band followed by a deep navy footer.
- Cool white, ink navy, electric blue, quiet gray, thin rules, square corners, and almost no shadows.
- Inter Tight for display type and Inter for body copy. Roboto Mono is limited to course codes, dates, and order references.

At the 1024 by 1536 reference viewport, the measurable targets are a 72 pixel header, a hero from y 72 through about 613, an activity band through about y 861, an archive and service band through about y 1286, a Programming Hub band through about y 1457, and the compact footer below it. The copy column targets 47.4 percent and must remain between 45.9 and 48.9 percent. The main horizontal inset is 46 through 49 pixels. Implemented anchors may vary by no more than 12 pixels vertically.

| 1024 calibration            | Target                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Header logo bounds          | x 46 to 216, vertically centered within 72 pixels                                                                       |
| Primary action bounds       | x 895 to 977, 82 by 36 pixels                                                                                           |
| Hero title                  | x about 46, y about 139, 58 to 60 pixels, 700 weight, 60 to 63 pixel line height, three lines, maximum width 330 pixels |
| Hero text measure           | maximum 355 pixels, body 15 to 16 pixels with 22 pixel line height                                                      |
| Hero actions                | begin near y 498, filled action 145 by 42 pixels, 34 to 36 pixel horizontal gap                                         |
| Activity dividers           | near x 263, 503, and 744 within the 46 to 976 inset                                                                     |
| Archive and service divider | near x 502                                                                                                              |
| Programming Hub dividers    | four equal content columns within the global inset                                                                      |
| Footer                      | about 79 pixels high                                                                                                    |

## Homepage composition

### Header

At wide desktop sizes the header displays `About`, `Events`, `Workshops`, `Resources`, and `Book Delivery` in one row. Instagram and Discord remain icon links. The primary action is `Sign up`.

At 1024 pixels and wider the full reference navigation remains visible. From 700 through 1023 pixels, the first three public destinations remain visible and an accessible `More` control contains Resources, Book Delivery, Mini-Competitions, and MariHacks. Below 700 pixels, one menu control opens the full navigation while `Sign up` remains the top-right primary action. Menus expose `aria-expanded` and `aria-controls`, close on outside click and Escape, return focus to their trigger, show the active page, and never trap focus.

### Hero

The copy reads:

- Heading: `Code. Collaborate. Create.`
- First paragraph: `The student-run programming club for Marianopolis students of every experience level.`
- Second paragraph: `Learn with other students through workshops, shared resources, mini-competitions, and MariHacks.`
- Primary action: `Join the club`
- Secondary action: `Explore upcoming events`
- Note: `Open to all Marianopolis students. No experience required.`

The photograph is a real MariHacks image selected from the supplied public photo folder. It must show work or collaboration at close enough range to support the right-side crop, remain visually quiet in grayscale, and preserve its subject at a 53 percent desktop crop and a mobile landscape crop. The implementation plan records the chosen local asset, crop role, source resolution, optimized dimensions, and alternative text. The final repository contains a locally optimized image at least 1600 pixels wide. No remote Drive URL is used at runtime.

### Activity band

The four entries are Peer Help, Workshops, Mini-Competitions, and MariHacks. Each entry has one simple line icon, a short factual description, and one action. Mini-Competitions is labelled `Coming Soon`, links only to its factual status page, and does not imply an active challenge.

### Archive and Book Delivery band

The workshop side uses only real workshop entries already present in the repository. It does not invent dates. If current dates are unavailable, the date column is omitted and the list is titled `Workshop archive`.

The Book Delivery side is a launch notice in production. It displays `Coming Soon`, a short factual explanation, and one `Book Delivery status` link to `/books`. It contains no `View all courses`, order action, fake course, teacher, price, or book cover. Development and automated-test configurations can enable the complete catalogue and transactional flow.

### Programming Hub and footer

The Programming Hub contains four direct destinations: ask for help, browse resources, meet collaborators, and join Discord. Copy stays short and useful.

The footer uses the reference's deep navy band, compact club identity, Marianopolis location, and icon-only social links.

## Other public pages

About, Events, Workshops, Resources, Mini-Competitions, and the production Book Delivery launch page use the same page width, type scale, thin rules, square controls, and cool palette. Sparse pages gain structure from useful indexes, destinations, and photography. They do not gain ornamental paragraphs, repeated cards, large empty gradients, or decorative labels.

| Route                  | Primary task                 | Required structure                                                                                                   | Empty or status behavior                                             |
| ---------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/about-us`            | Understand the club and join | concise mission, beginner access, real activities, interest-form action, one distinct MariHacks photo when available | no unsupported history, metrics, or filler                           |
| `/events`              | Find a real upcoming event   | chronological ruled list from the existing events source and direct destination where one exists                     | a single factual no-events message and workshop/Discord alternatives |
| `/our-workshops`       | Find workshop material       | ruled archive using only repository-backed workshop names and links                                                  | no invented dates, counts, or summaries                              |
| `/resources`           | Reach useful club resources  | grouped editorial index of the existing real destinations                                                            | omit any destination without a verified URL                          |
| `/mini-competitions`   | Learn launch status          | concise `Coming Soon` page with what the feature will provide                                                        | no challenge, leaderboard, registration, or countdown action         |
| `/books` in production | Learn launch status          | concise `Coming Soon` page consistent with the homepage teaser                                                       | no catalogue, cart, checkout, fake books, or purchase action         |

Real MariHacks photographs may appear on About, Events, and Workshops when they add evidence. Each image is selected for a distinct role, optimized locally, and given useful alternative text. The same photograph is not repeated simply to fill space.

## Book Delivery launch states

`BOOK_DELIVERY_LAUNCH_STATE` controls public availability.

- `coming-soon`: `/books` shows the launch notice. Nested Book Delivery pages redirect to `/books`. `/api/book-checkout` does not create Stripe sessions.
- `live`: the complete catalogue, cart, checkout, confirmation, and staff-backed fulfillment flow are available.

The live customer flow preserves the approved interface contract. The catalogue shows one teacher-course entry per course with layered covers. Course detail uses ruled rows with a cover at left, inclusion control, quantity, price, and bookstore link. The cart is a Book Delivery-only ledger with clear empty and invalid-selection recovery. Checkout uses a light information column and deep navy order-summary column, while card entry remains on hosted Stripe Checkout. Confirmation shows the Marianopolis map and Wayne's Front Desk pickup. Every surface has loading, unavailable, validation, provider-failure, empty, and mobile states. Test data enters through test-only repositories and cannot appear in production imports or build output.

Production deploys with `coming-soon`. Automated integration and end-to-end tests run with `live`. This is a server-enforced gate, not a hidden navigation link.

## Responsive behavior

- Desktop preserves the reference's major splits and visible ruled columns.
- Tablet uses the compact navigation and keeps the hero split until the copy or actions would become cramped.
- Mobile stacks photography after hero copy, turns four-column bands into ruled rows, and keeps controls at least 44 CSS pixels high.
- No page has horizontal overflow at 320, 390, 768, 1024, or 1440 CSS pixels.

## Motion

Motion is limited to press feedback, the expandable navigation, cart-count state feedback, checkout feedback, and paid-confirmation arrival. All motion stays below 300 ms, animates only opacity and transforms, and has a reduced-motion treatment. Images and information-dense lists do not drift, parallax, or stagger into view.

## Copy rules

Every visible string receives a Humanizer review. Copy must remain factual, concise, and easy to scan. The final UI contains no em dash, en dash, center dot, decorative eyebrow, fake metric, invented event date, or unsupported claim.

## Acceptance criteria

- A screenshot review at 1024 by 1536 verifies the calibration table, target 47.4 percent copy width, 46 to 49 pixel inset, Inter Tight and Inter hierarchy, exact section order, rule alignment, square controls, and absence of unintended rounded cards or shadows. Overlay and side-by-side captures are retained as test artifacts.
- The Fall 2026 form is the only sign-up destination.
- The header handles wide, intermediate, and mobile navigation without crowding.
- Public production pages expose no placeholder photos, fake book records, or active Mini-Competition claim.
- Book Delivery and Mini-Competitions display `Coming Soon` in production.
- All public pages work with keyboard navigation, visible focus, screen readers, forced colors, and reduced motion.
- The site provides a skip link, labelled icon-only links, meaningful image alternatives, associated validation summaries, mutation status announcements, and focus indicators that remain visible in forced colors.
- A fresh-user reviewer can find sign-up, workshops, resources, Discord, MariHacks, and the Book Delivery launch state without guidance.
