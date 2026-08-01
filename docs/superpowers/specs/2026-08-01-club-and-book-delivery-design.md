# Marianopolis Programming Club and Book Delivery Redesign

## Purpose

Replace the outdated static club website with a current, useful home for the Marianopolis Programming Club and add a first-class Book Delivery service. The service lets students assemble a teacher-assigned course-book order, pay by card or e-transfer, and collect the completed order at Wayne's Front Desk at Marianopolis College.

The club site and Book Delivery share a visual language, but commerce controls are intentionally confined to the Book Delivery area.

## Goals

- Make the club's current activity, workshops, events, resources, and joining path easy to find and maintain.
- Let a student select a teacher, review the preset book list for each course, and remove individual books when appropriate.
- Charge the complete order total upfront: books, configurable taxes, and one $5-$7 service fee for every distinct bookstore represented in the cart.
- Support secure card payment through Stripe and manual e-transfer confirmation.
- Give executives a lightweight operational view for cataloguing books, purchasing them manually by bookstore, and marking pickup progress.
- Send payment and fulfillment emails without requiring a student account.

## Non-goals for the first release

- Direct integrations with bookstores or automatic purchasing.
- Home delivery.
- Student accounts, saved payment methods, or recurring payments.
- A full inventory-management system.
- A public executive directory or public order lookup.

## Product structure

### Shared navigation

The refreshed global navigation includes Club, Workshops, Events, Resources, and Book Delivery. It has a clear community action. Until executives supply a fresh verified Discord invite, that action uses the club’s existing Instagram profile rather than a dead invite. The cart icon and count appear only after entering Book Delivery routes, never on club pages.

### Club pages

| Page      | Purpose                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------- |
| Home      | Lead with current club activity, the next workshop or event, projects, and a direct path to join. |
| About     | Explain who the club is for and how students can participate.                                     |
| Workshops | Searchable archive organized by learning track and semester.                                      |
| Events    | Current event list and detail pages, with an obvious empty state between terms.                   |
| Resources | Practical starter paths, contest links, hackathon material, and club-made resources.              |

Club content must be structured so executives can replace stale event and workshop material without editing page layouts.

### Book Delivery pages

| Route area     | Purpose and behavior                                                                                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue      | Teacher-first card grid. Every card shows an offset stack of relevant book covers, teacher name, course names, required-book count, price range, and bookstore count.                                                                                 |
| Teacher detail | Groups book rows by course. Each row has a book-cover thumbnail, title, format or edition, bookstore name, price, optional bookstore product link, selected state, and quantity controls. Preset books start selected and students can unselect them. |
| Cart           | Groups selected books by bookstore, applies the configured fee one time per group, shows taxes and total, and supports quantity changes or removals.                                                                                                  |
| Checkout       | Custom two-column layout. The light panel collects Marianopolis email, student ID, and a payment choice. The deep-navy panel holds a live order summary. Stripe card fields remain securely hosted by Stripe.                                         |
| Review         | Re-states the total and selected books, then shows a Marianopolis College map with Wayne's Front Desk as the pickup location. Pickup guidance does not distract from catalogue or teacher-detail screens.                                             |
| Confirmation   | Provides the order number, current payment state, receipt or transfer instructions, and the pickup map.                                                                                                                                               |

The optional bookstore product link appears as a plainly labeled external action, such as `View at Renaud-Bray`. It opens the exact retailer page in a new tab. If an executive has not supplied a verified URL, the action is absent.

## Visual direction

The redesign keeps the club's established colors, then expands them for better contrast and a calmer service experience.

| Token     | Value     | Use                                                    |
| --------- | --------- | ------------------------------------------------------ |
| Midnight  | `#050D2E` | Navigation, checkout summary, high-contrast sections.  |
| Club blue | `#0D2173` | Primary actions and interactive states.                |
| Sky       | `#99C2FF` | Supporting surfaces and club highlights.               |
| Paper     | `#F7F4ED` | Book pages, reading surfaces, and space around covers. |
| Graphite  | `#181B25` | Body copy and information hierarchy.                   |
| Coral     | `#DF5B48` | Deadline and attention states only.                    |

Typography pairs a characterful geometric display sans with a precise mono utility face. The visual signature is the offset stack of book covers on every teacher card. It conveys a curated course bundle rather than a generic ecommerce catalogue.

The interface uses full-bleed, high-contrast sections sparingly. Most surfaces stay quiet enough for covers, course information, and prices to remain easy to scan. It must work on mobile, support keyboard navigation and visible focus, and honor reduced-motion preferences.

## Checkout and payment design

### Card payment

Use a custom checkout page built around Stripe's Payment Element or equivalent secure Stripe field. The site never handles raw card data. The backend creates and verifies the payment intent or checkout session server-side, calculates the authoritative price server-side, and only accepts a completed payment after a verified Stripe webhook.

Stripe sends the official card-payment receipt to the email supplied at checkout. Configure its branding to match the club service. A branded transactional email also confirms the order and later announces pickup availability.

### E-transfer

E-transfer is an explicit alternate payment option, not a simulated card payment. A submitted e-transfer order receives an order number, a uniquely identifying memo, the exact amount, and the transfer instructions by email. Its status begins as `awaiting_transfer`; an executive marks it paid after verification. Unpaid orders do not enter the bookstore purchasing export.

### Pricing

- Price, bookstore, tax behavior, and service fee are stored with the book or bookstore configuration and resolved on the server at checkout.
- A service fee is charged once for each unique bookstore in the cart.
- The exact applicable tax rules remain configurable rather than being hard-coded.
- The order stores a price snapshot so later catalogue edits cannot alter a completed order.

## Pickup and fulfillment

Students pick up completed orders at Wayne's Front Desk at Marianopolis College. The map is shown during review and confirmation only. It gives an accessible text alternative and a directions link in addition to the visual marker.

Executives fulfill orders manually:

1. Export paid order lines grouped by bookstore.
2. Purchase the grouped lists at the bookstores.
3. Mark relevant orders `purchased`, then `received` as books arrive.
4. Mark complete orders `ready_for_pickup` and send the branded notice.
5. Search the pickup roster by order number, student name, or student ID, then mark it `picked_up`.

## Administration

Only invited club executives have access to the admin area. Email magic links or another vetted passwordless sign-in method protect it. Student checkout remains account-free.

Admin capabilities:

- Manage teachers, courses, textbooks, cover images, ISBN or edition information, prices, bookstore assignments, and retailer product URLs.
- Set the per-bookstore service fee within the operational $5-$7 range.
- Control ordering windows and deadlines.
- View payment and fulfillment status, search orders, and manually validate e-transfers.
- Export paid orders grouped by bookstore and create a pickup roster.

## Data model

| Entity      | Key fields                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| Executive   | Email, role, authentication identity.                                                                                      |
| Teacher     | Name, display order, optional photo or biography.                                                                          |
| Course      | Teacher, term, code, title, availability.                                                                                  |
| Bookstore   | Name, service fee, address or notes, active state.                                                                         |
| Book        | Course, title, author, ISBN, edition, format, cover asset, price, tax rule, bookstore, external product URL, active state. |
| Order       | Order number, student email, student ID, payment method and state, fulfillment state, price snapshot, timestamps.          |
| Order item  | Order, book snapshot, unit price, quantity, bookstore snapshot.                                                            |
| Fee line    | Order, bookstore snapshot, amount.                                                                                         |
| Email event | Order, template type, provider message ID, sent time.                                                                      |

## Technology choices

- Keep SvelteKit and the existing Vercel deployment path.
- Use Supabase Postgres for transactional data, Supabase Auth for executive access, and Supabase Storage for uploaded book covers.
- Use server-only SvelteKit routes for data mutations, payments, admin actions, and webhook handling.
- Use Stripe for card payments and Stripe receipts.
- Use a transactional email provider for branded order, e-transfer, and pickup messages.
- Store the guest cart locally in the browser until checkout. The final order is always reconstructed and priced on the server.

The allowed Marianopolis student-email domains are configuration, not a hard-coded assumption. The initial setup must specify them before accepting live orders.

## Security and privacy

- Validate all catalogue IDs, quantities, prices, and state changes on the server.
- Never trust a browser-provided total or payment status.
- Verify Stripe webhook signatures before updating an order to paid.
- Keep service credentials out of client bundles and source control.
- Restrict admin routes and server actions to the executive role.
- Store only the student data needed to fulfill and reconcile an order, with a documented retention policy.
- Escape and validate bookstore product URLs before rendering external links.

## Error and empty states

- No active ordering window: explain when ordering opens and show no checkout action.
- No books under a teacher or course: say that the list is being prepared and direct students to check with the instructor.
- Cart emptied: provide a direct action back to the teacher catalogue.
- Card payment fails: preserve the cart, explain that no order was created, and offer a retry or e-transfer choice.
- E-transfer pending: show instructions and explain that purchasing begins only after payment confirmation.
- Book price changed before payment: reprice the cart server-side, state what changed, and require review before the next attempt.

## Acceptance criteria

### Club redesign

- The home, about, workshops, events, and resources experiences use current content structure and no Fall 2024 placeholder copy remains.
- The layout is responsive, keyboard accessible, and readable at mobile and desktop widths.
- Book Delivery is discoverable from the main navigation but cart UI is not visible elsewhere.

### Catalogue and cart

- Teacher cards render stacked cover art and meaningful course information.
- Book rows have cover thumbnails, selection controls, quantity controls, prices, bookstore names, and optional verified retailer links.
- Students can select and unselect individual preset books.
- The cart groups by bookstore and charges exactly one configured service fee for each unique bookstore.
- Cart totals are recalculated on the server before payment.

### Payments and email

- A valid card payment creates a paid order only after the verified Stripe webhook arrives.
- Stripe sends a card payment receipt to the checkout email.
- E-transfer orders receive complete instructions and remain unpaid until executive confirmation.
- Branded confirmation and ready-for-pickup email paths are tested with a safe mail sandbox or staging recipient.

### Operations

- An executive can create or edit a book with an optional retailer URL and cover image.
- An executive can find an order, update fulfillment state, export paid bookstore lists, and mark a pickup complete.
- Review and confirmation show the accessible Marianopolis College map with Wayne's Front Desk marked.

## Verification plan

- Unit-test price and service-fee calculation, including multiple bookstores, unselected books, changed prices, and zero-item carts.
- Test server-side authorization and invalid state transitions for all admin and order actions.
- Test Stripe webhook verification with Stripe's test fixtures.
- Test card and e-transfer flows with staging credentials.
- Test transactional emails in a sandbox or staging inbox.
- Run the formatter, linter, type checking, build, and targeted browser-based visual checks at mobile and desktop sizes.
