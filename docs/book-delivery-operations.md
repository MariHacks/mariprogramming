# Book Delivery card checkout operations

Book Delivery uses Stripe-hosted Checkout for card payments. The club purchases paid orders manually; this release does not create automatic fulfillment, inventory, pickup-time, or e-Transfer workflows.

## Configure Stripe in Vercel

1. In Vercel, add `STRIPE_SECRET_KEY` as a server-only environment variable. Never prefix it with `PUBLIC_`, commit it, add it to client code, or paste it into issue trackers or logs.
2. Use a Stripe test-mode secret key for local development and Preview deployments. Use the live-mode secret key only in the Production environment after the launch checks below are complete.
3. `STRIPE_WEBHOOK_SECRET` is intentionally reserved for a future verified fulfillment webhook. It is not needed for this manual-release flow.
4. `BOOK_DELIVERY_ETRANSFER_ADDRESS` is reserved for a later, policy-backed e-Transfer option. Do not show e-Transfer until the club has confirmed its recipient address and payment-confirmation policy.

## Enable email receipts

In the Stripe Dashboard, enable **Customer emails → Successful payments** and confirm the account branding and public contact details. Checkout sends the guest email to Stripe as both the Checkout customer email and the PaymentIntent receipt email.

Test-mode payments do not automatically send receipts to arbitrary addresses. Stripe limits automatic test receipts to email addresses verified for the testing environment; otherwise, view or manually send the receipt from the Dashboard. Verify a receipt with an approved test address before launch.

## Manual purchasing workflow

After a successful card payment:

1. Open the paid Checkout Session or linked payment in the Stripe Dashboard.
2. Confirm that the payment succeeded and review the server-created book, bookstore-service-fee, and tax line items.
3. Use the Book Delivery metadata (`service`, `fulfillment`, and `book_count`) to identify the manual Dashboard workflow.
4. Purchase the listed books manually, then follow the club's approved student-contact and Wayne's Front Desk pickup process.
5. Handle cancellation, refunds, and student communication through the club's approved policy. A Stripe session alone does not promise inventory, delivery time, or completed pickup.

## Launch checks

- Confirm the current legal and tax treatment for the service and book purchases.
- Confirm Stripe business details, receipt branding, successful-payment email setting, and refund policy.
- Complete a Stripe test-mode Checkout payment with a verified test email and inspect every book, fee, tax, receipt, success redirect, and cancellation redirect.
- Rehearse the staff Dashboard review and manual purchasing workflow, including an unsuccessful or refunded payment.
- Confirm the Wayne's Front Desk pickup process with the college before publishing card checkout.
- Keep card checkout disabled in Production until the live-mode key, operational approvals, and the checks above are complete.
