# Book Delivery Checkout, Pickup Review, and Payment Plan

## Goal

Turn the existing Book Delivery cart into a fast guest order-review and secure card-checkout flow. Students should review their books, see Marianopolis College and Wayne's Front Desk on a map, enter only the contact details needed for their receipt, and transition to Stripe-hosted Checkout. The club can purchase books manually after payment by using Stripe's Dashboard order record and line items.

## Product decisions already made

- Checkout remains inside the Book Delivery route area; no cart, payment, or pickup UI appears in the programming-club shell.
- Guest checkout is the default. There is no account system or password wall.
- Every browser total is a review estimate. The server re-creates the canonical cart from book IDs and quantities, then re-calculates the total before it creates a payment session.
- Manual purchasing is the fulfillment model: a paid Stripe order is reviewed and purchased by the club manually. This plan deliberately does not claim stock, availability, purchase time, or automatic fulfillment.
- Wayne's Front Desk at Marianopolis College belongs on the order-review/confirmation experience, not the catalogue or teacher list.
- Stripe is the card-payment path. The user has not supplied a recipient email or confirmation policy for Interac e-Transfer, so that option must remain configuration-gated rather than showing invented instructions.

## Stripe and receipt facts

- A server creates a fresh hosted Checkout Session for each attempt. It sends the guest email as `customer_email` and `payment_intent_data.receipt_email`; no Stripe secret reaches the browser.
- The session contains server-repriced book lines plus exactly one service-fee line per bookstore. Tax is the same server-calculated tax presently disclosed in Book Delivery until the club confirms its production tax configuration.
- Stripe receipt settings must be enabled in the club's Stripe Dashboard before launch. Stripe documents both automated Checkout receipts and live-mode `receipt_email` behavior. See [Checkout receipt documentation](https://docs.stripe.com/payments/checkout/receipts) and the [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create).
- Manual purchasing may be done from the Stripe Dashboard for a low-volume service. If the club later automates fulfillment, Stripe recommends verified webhook handling and idempotent fulfillment; see [Stripe's fulfillment guidance](https://docs.stripe.com/checkout/fulfillment).

## Architecture

```text
Book Delivery cart (browser, persisted items)
        |
        v
Order review (guest name/email + Wayne's Front Desk map)
        |
        | POST only book IDs, quantities, guest contact
        v
Server checkout endpoint
  - validate request and same-origin intent
  - reconstruct canonical cart
  - calculate canonical book, fee, tax totals
  - create Stripe Checkout Session
        |
        v
Stripe-hosted Checkout
        |
        v
Server-verified confirmation page + manual club fulfillment in Stripe Dashboard
```

## Environment and deployment prerequisites

- `STRIPE_SECRET_KEY`: server-only Stripe secret key.
- `STRIPE_WEBHOOK_SECRET`: reserve for a future idempotent fulfillment endpoint; not required for manual Dashboard-based purchasing in the first release.
- `BOOK_DELIVERY_ETRANSFER_ADDRESS`: optional future recipient address. Do not expose an e-transfer option until this is configured and the club supplies its payment-confirmation policy.
- Vercel environment variables only. Never commit actual secrets or transmit them to browser code.
- Before live launch, the club must confirm: legal/tax treatment, Stripe public business details, receipt branding/email setting, refund policy, and Wayne's Front Desk pickup workflow.

## Task 7: Checkout request and canonical Session-line builder

**Files:**

- Create `src/lib/books/checkout.js`
- Create `src/lib/books/checkout.test.js`

**Responsibilities:**

- Validate a bounded guest checkout request `{ items, email, name? }` without trusting totals, price, title, bookstore, or arbitrary metadata supplied by the browser.
- Rebuild the cart with `createCart`, calculate it with the existing `calculateCart(catalogue, cart)`, and shape deterministic Stripe line-item data for books, each existing bookstore fee, and the canonical tax line.
- Return a minimal order description/metadata appropriate for manual Dashboard fulfillment, never secrets.
- Test malformed IDs, quantities, emails, empty carts, duplicate items, stable order, one-fee-per-bookstore, and amounts that equal the server summary.

## Task 8: Stripe server gateway

**Files:**

- Add the official `stripe` dependency and lockfile update.
- Create `src/lib/server/books/stripe.js`
- Create `src/lib/server/books/stripe.test.js`
- Create `src/routes/api/book-checkout/+server.js`
- Create endpoint tests.
- Create `.env.example` and a concise `docs/book-delivery-operations.md` setup runbook.

**Responsibilities:**

- Use server-only dynamic environment access, construct Stripe only on the server, and surface a deliberate unavailable response when the secret is missing.
- Accept a JSON request only after body validation and a same-origin check. Use Task 7's server repricing contract, not client amount fields.
- Create hosted Stripe Checkout Sessions in CAD with a short, safe success URL that includes the Checkout Session placeholder. Set the guest email as both Checkout customer email and payment-intent receipt email, preserve manual-purchase context in bounded metadata, and return only the Session redirect URL.
- Write unit tests with a fake Stripe client for the exact request/Session payload, invalid request rejection, no-secret response, and no leakage of secrets or client-provided price data.
- Document Stripe Dashboard receipt activation and manual staff workflow. This first release does not imply a webhook-driven fulfillment database.

## Task 9: PickupMap component

**Files:**

- Create `src/lib/books/PickupMap.svelte`
- Create `src/lib/books/PickupMap.test.js`

**Responsibilities:**

- Render an accessible map view centered on Marianopolis College, a clear internal Wayne's Front Desk pickup annotation, and an external `Open campus map` link that is secure/new-tab explicit.
- Treat the public campus map as navigational context only; never pretend it confirms a meet time or inventory.
- Match the editorial Book Delivery palette with a quiet Paper map pane, visible label hierarchy, keyboard-safe external link, mobile aspect ratio, reduced motion, and forced colors.

## Task 10: GuestCheckoutForm component

**Files:**

- Create `src/lib/books/GuestCheckoutForm.svelte`
- Create `src/lib/books/GuestCheckoutForm.test.js`

**Responsibilities:**

- Provide fast guest name/email collection with native input semantics, inline but non-blocking validation, loading/error state, and an explicit secure-card handoff. Do not render card numbers or imitate Stripe fields.
- Emit only validated guest contact and current cart items to its parent. It must not calculate price, create a Session, or read secrets.
- Keep e-transfer out unless a later configuration-specific component is implemented with a real recipient and policy.

## Task 11: Order-review checkout route

**Files:**

- Create `src/routes/books/checkout/+page.svelte`
- Create focused route tests.

**Responsibilities:**

- Consume the Book Delivery-local cart context and canonical summary. Empty cart returns the student to `/books/cart` without fake checkout UI.
- Use a desktop two-column review matching the requested contrast: Paper guest-review/form work area beside a Midnight summary rail containing `CartTotals` and `PickupMap`. Stack naturally at 390px/320px.
- Submit the GuestCheckoutForm to the API, redirect only to a returned Stripe URL, and retain a calm retryable failure state. Make the review copy distinguish `Order review` from a completed payment.
- Provide a single H1, screen-reader announcement of submission/error changes, no checkout fields outside `/books`, and map/pickup details only here.

## Task 12: Server-verified order confirmation

**Files:**

- Create `src/routes/books/order-confirmation/+page.server.js`
- Create `src/routes/books/order-confirmation/+page.svelte`
- Create focused tests.

**Responsibilities:**

- Mark the route non-prerendered and retrieve the Stripe Session server-side from its session ID. Confirm payment status before using success language; show a safe recovery path for missing, expired, unpaid, or invalid sessions.
- Show a concise paid-order confirmation, receipt expectation, selected book summary as available from the server Session, and the Wayne's Front Desk pickup map again. Clear the browser-local cart only after a server-verified paid Session.
- Do not falsely promise manual-purchase timing. Direct a student to their Stripe receipt for payment records.

## Task 13: Payment and confirmation browser coverage

**Files:**

- Add focused Playwright coverage under `tests/e2e/`.

**Responsibilities:**

- Exercise guest validation, empty cart recovery, map presence only on review/confirmation, cart absence outside `/books`, safe API failure state, and responsive two-column-to-stack visual checks.
- Stub Stripe only at the server boundary. Never use a live key in browser tests.

## Launch gate

Before enabling the card CTA in production, verify an end-to-end Stripe test-mode payment, receipt delivery to a verified test address, Session line-item/fee correctness, staff Dashboard manual-purchase workflow, cancellation/refund handling, and current legal/tax approval. Obtain the e-transfer recipient address and manual confirmation policy before exposing that option.
