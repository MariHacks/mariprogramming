# Book Delivery operations

Book Delivery uses Stripe-hosted card checkout and a manual purchasing workflow. The public service is closed in Production until the approvals and provider tests in [the deployment runbook](./book-delivery-deployment.md) are complete.

## Daily staff workflow

1. Sign in with the verified `team@marihacks.com` Google account.
2. Open the order ledger and work only from persisted payment status. A browser return from Stripe is not payment proof.
3. For a paid order, move fulfillment through purchasing, received, ready for pickup, and picked up. Each step uses the current version and writes an audit row.
4. Buy the listed books from the grouped bookstore purchase list. The system does not purchase inventory automatically.
5. Follow the approved Wayne's Front Desk receiving and pickup procedure.
6. Start refunds in Stripe Dashboard. The signed webhook mirrors the provider result into the order ledger.

Staff can cancel only a pending, unstarted order after Stripe confirms that its Checkout Session is expired. A concurrent paid result wins.

## Payment and receipt checks

Stripe receives the guest email for Checkout and payment receipts. Before launch, enable successful payment emails, confirm account branding and support details, and test delivery with an address Stripe permits in test mode.

The order total is rebuilt on the server from active catalogue records. It includes selected books, one approved $5 to $7 service fee for each represented bookstore, and the configured tax rate. Browser prices are never accepted.

## Automated recovery

Vercel runs the authenticated Book Delivery job daily while the service is closed. Before Book Delivery opens, move the job to an hourly scheduler. It:

- reconciles expired or completed Stripe Sessions in a bounded batch;
- fails a providerless attempt only after it has remained incomplete for one hour;
- anonymizes due customer data 90 days after the configured terminal point;
- clears expired confirmation capabilities and the HMAC-keyed auth, checkout, and staff rate-limit buckets;
- writes maintenance and reconciliation audit records without customer identity.

A 503 response means the job needs a safe retry. Do not bypass authorization or raise batch limits to clear a backlog.

## Incident priorities

If payment, catalogue, or pickup behavior is uncertain, set `BOOK_DELIVERY_LAUNCH_STATE=coming-soon` before investigating. Keep signed webhooks and the authenticated scheduled job available for orders that already exist. Rotate an exposed credential at its provider and in Vercel, revoke the old value, and follow the rollback and recovery steps in the deployment runbook.
