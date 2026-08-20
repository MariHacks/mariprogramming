import { describe, expect, it, vi } from 'vitest';
import {
	createStripeCheckoutSession,
	createStripeClient,
	isSecureCheckoutRedirectUrl,
	retrieveReadyStripeCheckoutSession,
	retrieveStripeCheckoutSession
} from './stripe';

const TEST_NOW_SECONDS = 1786651300;
const PUBLIC_REFERENCE = 'MPC-ABCDEFGHJK23';

function persistedStripeFixture() {
	const order = {
		id: '10000000-0000-4000-8000-000000000001',
		publicReference: PUBLIC_REFERENCE,
		customerEmail: 'ada@example.com',
		currency: 'cad',
		taxCents: 0,
		totalCents: 1800
	};
	const attempt = {
		id: '20000000-0000-4000-8000-000000000001',
		stripeIdempotencyKey: 'mpc-book-checkout-v1:20000000-0000-4000-8000-000000000001',
		status: 'created'
	};
	return {
		snapshot: {
			order,
			attempt,
			lines: [
				{
					label: 'Book',
					quantity: 1,
					unitAmountCents: 1800,
					lineAmountCents: 1800
				}
			]
		},
		options: {
			appOrigin: 'https://club.example',
			stripeCheckoutHost: null,
			stripeSecretKey: 'sk_test_example',
			now: new Date(TEST_NOW_SECONDS * 1000)
		}
	};
}

describe('createStripeCheckoutSession', () => {
	it('creates card-only Checkout from persisted snapshots with stable internal metadata and idempotency', async () => {
		const order = {
			id: '10000000-0000-4000-8000-000000000001',
			publicReference: PUBLIC_REFERENCE,
			customerEmail: 'ada@example.com',
			currency: 'cad',
			taxCents: 275,
			totalCents: 2575
		};
		const attempt = {
			id: '20000000-0000-4000-8000-000000000001',
			stripeIdempotencyKey: 'mpc-book-checkout-v1:20000000-0000-4000-8000-000000000001',
			status: 'created'
		};
		const lines = [
			{ label: 'Book', quantity: 1, unitAmountCents: 1800, lineAmountCents: 1800 },
			{ label: 'Store pickup service', quantity: 1, unitAmountCents: 500, lineAmountCents: 500 }
		];
		const session = {
			id: 'cs_test_persisted_checkout',
			object: 'checkout.session',
			livemode: false,
			mode: 'payment',
			ui_mode: 'hosted_page',
			status: 'open',
			payment_status: 'unpaid',
			currency: 'cad',
			amount_total: 2575,
			client_reference_id: order.id,
			metadata: {
				service: 'marianopolis-book-delivery',
				schema_version: '1',
				order_id: order.id,
				checkout_attempt_id: attempt.id
			},
			customer_email: order.customerEmail,
			payment_method_types: ['card'],
			success_url: `https://club.example/books/order-confirmation/${PUBLIC_REFERENCE}`,
			cancel_url: 'https://club.example/books/checkout',
			created: 1786651200,
			expires_at: 1786737600,
			payment_intent: null,
			url: 'https://checkout.stripe.com/c/pay_test_persisted'
		};
		const create = vi.fn().mockResolvedValue(session);
		const stripe = { checkout: { sessions: { create } } };

		await expect(
			createStripeCheckoutSession(
				stripe,
				{ order, attempt, lines },
				{
					appOrigin: 'https://club.example',
					stripeCheckoutHost: null,
					stripeSecretKey: 'sk_test_example',
					now: new Date(1786651300 * 1000)
				}
			)
		).resolves.toEqual({
			id: session.id,
			url: session.url,
			paymentIntentId: null,
			expiresAt: new Date(session.expires_at * 1000)
		});

		expect(create).toHaveBeenCalledWith(
			{
				mode: 'payment',
				payment_method_types: ['card'],
				client_reference_id: order.id,
				customer_email: order.customerEmail,
				line_items: [
					{
						price_data: {
							currency: 'cad',
							product_data: { name: 'Book' },
							unit_amount: 1800
						},
						quantity: 1
					},
					{
						price_data: {
							currency: 'cad',
							product_data: { name: 'Store pickup service' },
							unit_amount: 500
						},
						quantity: 1
					},
					{
						price_data: {
							currency: 'cad',
							product_data: { name: 'Tax' },
							unit_amount: 275
						},
						quantity: 1
					}
				],
				metadata: session.metadata,
				payment_intent_data: {
					receipt_email: order.customerEmail,
					metadata: session.metadata
				},
				success_url: session.success_url,
				cancel_url: session.cancel_url
			},
			{ idempotencyKey: attempt.stripeIdempotencyKey }
		);
		expect(JSON.stringify(create.mock.calls[0])).not.toContain('session_id');
	});

	it('preserves a zero-priced book line when a positive bookstore fee makes the order payable', async () => {
		const { snapshot, options } = persistedStripeFixture();
		const freeBookSnapshot = {
			...snapshot,
			order: { ...snapshot.order, totalCents: 500 },
			lines: [
				{ label: 'Open textbook', quantity: 1, unitAmountCents: 0, lineAmountCents: 0 },
				{
					label: 'Store pickup service',
					quantity: 1,
					unitAmountCents: 500,
					lineAmountCents: 500
				}
			]
		};
		const session = {
			id: 'cs_test_free_book',
			object: 'checkout.session',
			livemode: false,
			mode: 'payment',
			ui_mode: 'hosted_page',
			status: 'open',
			payment_status: 'unpaid',
			currency: 'cad',
			amount_total: 500,
			client_reference_id: snapshot.order.id,
			metadata: {
				service: 'marianopolis-book-delivery',
				schema_version: '1',
				order_id: snapshot.order.id,
				checkout_attempt_id: snapshot.attempt.id
			},
			customer_email: snapshot.order.customerEmail,
			payment_method_types: ['card'],
			success_url: `https://club.example/books/order-confirmation/${PUBLIC_REFERENCE}`,
			cancel_url: 'https://club.example/books/checkout',
			created: TEST_NOW_SECONDS - 100,
			expires_at: TEST_NOW_SECONDS - 100 + 86400,
			payment_intent: null,
			url: 'https://checkout.stripe.com/c/pay_free_book'
		};
		const create = vi.fn().mockResolvedValue(session);

		await expect(
			createStripeCheckoutSession({ checkout: { sessions: { create } } }, freeBookSnapshot, options)
		).resolves.toMatchObject({ id: session.id, url: session.url });
		expect(create.mock.calls[0][0].line_items).toEqual([
			{
				price_data: {
					currency: 'cad',
					product_data: { name: 'Open textbook' },
					unit_amount: 0
				},
				quantity: 1
			},
			{
				price_data: {
					currency: 'cad',
					product_data: { name: 'Store pickup service' },
					unit_amount: 500
				},
				quantity: 1
			}
		]);
	});

	it('accepts exact provider metadata independent of object insertion order', async () => {
		const order = {
			id: '10000000-0000-4000-8000-000000000001',
			publicReference: PUBLIC_REFERENCE,
			customerEmail: 'ada@example.com',
			currency: 'cad',
			taxCents: 0,
			totalCents: 1800
		};
		const attempt = {
			id: '20000000-0000-4000-8000-000000000001',
			stripeIdempotencyKey: 'mpc-book-checkout-v1:20000000-0000-4000-8000-000000000001',
			status: 'created'
		};
		const session = {
			id: 'cs_test_persisted_checkout',
			object: 'checkout.session',
			livemode: false,
			mode: 'payment',
			ui_mode: 'hosted_page',
			status: 'open',
			payment_status: 'unpaid',
			currency: 'cad',
			amount_total: 1800,
			client_reference_id: order.id,
			metadata: {
				checkout_attempt_id: attempt.id,
				order_id: order.id,
				schema_version: '1',
				service: 'marianopolis-book-delivery'
			},
			customer_email: order.customerEmail,
			payment_method_types: ['card'],
			success_url: `https://club.example/books/order-confirmation/${PUBLIC_REFERENCE}`,
			cancel_url: 'https://club.example/books/checkout',
			created: 1786651200,
			expires_at: 1786737600,
			payment_intent: null,
			url: 'https://checkout.stripe.com/c/pay_test_persisted'
		};
		const stripe = {
			checkout: { sessions: { create: vi.fn().mockResolvedValue(session) } }
		};

		await expect(
			createStripeCheckoutSession(
				stripe,
				{
					order,
					attempt,
					lines: [
						{
							label: 'Book',
							quantity: 1,
							unitAmountCents: 1800,
							lineAmountCents: 1800
						}
					]
				},
				{
					appOrigin: 'https://club.example',
					stripeCheckoutHost: null,
					stripeSecretKey: 'sk_test_example',
					now: new Date(1786651300 * 1000)
				}
			)
		).resolves.toMatchObject({ id: session.id, url: session.url });
	});

	it('rejects inconsistent persisted totals before contacting Stripe', async () => {
		const create = vi.fn();
		const stripe = { checkout: { sessions: { create } } };

		await expect(
			createStripeCheckoutSession(
				stripe,
				{
					order: {
						id: '10000000-0000-4000-8000-000000000001',
						publicReference: PUBLIC_REFERENCE,
						customerEmail: 'ada@example.com',
						currency: 'cad',
						taxCents: 275,
						totalCents: 2575
					},
					attempt: {
						id: '20000000-0000-4000-8000-000000000001',
						stripeIdempotencyKey: 'mpc-book-checkout-v1:20000000-0000-4000-8000-000000000001',
						status: 'created'
					},
					lines: [
						{
							label: 'Book',
							quantity: 1,
							unitAmountCents: 1800,
							lineAmountCents: 1800
						}
					]
				},
				{
					appOrigin: 'https://club.example',
					stripeCheckoutHost: null,
					stripeSecretKey: 'sk_test_example',
					now: new Date(1786651300 * 1000)
				}
			)
		).rejects.toThrow(/canonical|total/i);
		expect(create).not.toHaveBeenCalled();
	});

	it('does not classify an unexpected preparation fault as a proven pre-provider failure', async () => {
		const create = vi.fn();
		const stripe = { checkout: { sessions: { create } } };
		const revoked = Proxy.revocable({}, {});
		revoked.revoke();

		await expect(
			createStripeCheckoutSession(
				stripe,
				/** @type {any} */ (revoked.proxy),
				persistedStripeFixture().options
			)
		).rejects.toBeInstanceOf(TypeError);
		expect(create).not.toHaveBeenCalled();
	});

	/**
	 * @typedef {ReturnType<typeof persistedStripeFixture>} PersistedStripeFixture
	 * @typedef {(fixture: PersistedStripeFixture) => [unknown, unknown]} InvalidPersistedCheckoutFactory
	 */
	/** @type {Array<[string, InvalidPersistedCheckoutFactory]>} */
	const invalidPersistedCheckoutCases = [
		['a non-object snapshot', ({ options }) => [null, options]],
		[
			'a malformed order snapshot',
			({ snapshot, options }) => [{ ...snapshot, order: null }, options]
		],
		[
			'a malformed attempt snapshot',
			({ snapshot, options }) => [{ ...snapshot, attempt: null }, options]
		],
		[
			'a malformed line collection',
			({ snapshot, options }) => [{ ...snapshot, lines: null }, options]
		],
		['malformed options', ({ snapshot }) => [snapshot, null]],
		[
			'a non-string application origin',
			({ snapshot, options }) => [snapshot, { ...options, appOrigin: undefined }]
		],
		[
			'a malformed application origin',
			({ snapshot, options }) => [snapshot, { ...options, appOrigin: 'not a URL' }]
		],
		[
			'an unsafe application origin',
			({ snapshot, options }) => [snapshot, { ...options, appOrigin: 'ftp://club.example' }]
		],
		[
			'an invalid custom host value',
			({ snapshot, options }) => [snapshot, { ...options, stripeCheckoutHost: 42 }]
		],
		[
			'a blank Stripe key',
			({ snapshot, options }) => [snapshot, { ...options, stripeSecretKey: '' }]
		],
		['a non-Date clock', ({ snapshot, options }) => [snapshot, { ...options, now: 'today' }]],
		[
			'an invalid Date clock',
			({ snapshot, options }) => [snapshot, { ...options, now: new Date('invalid') }]
		],
		[
			'a blank order ID',
			({ snapshot, options }) => [{ ...snapshot, order: { ...snapshot.order, id: '' } }, options]
		],
		[
			'a malformed public order reference',
			({ snapshot, options }) => [
				{ ...snapshot, order: { ...snapshot.order, publicReference: 'MPC-invalid' } },
				options
			]
		],
		[
			'a blank attempt ID',
			({ snapshot, options }) => [
				{ ...snapshot, attempt: { ...snapshot.attempt, id: '' } },
				options
			]
		],
		[
			'a blank email',
			({ snapshot, options }) => [
				{ ...snapshot, order: { ...snapshot.order, customerEmail: '' } },
				options
			]
		],
		[
			'a zero total',
			({ snapshot, options }) => [
				{ ...snapshot, order: { ...snapshot.order, totalCents: 0 } },
				options
			]
		],
		[
			'a fractional total',
			({ snapshot, options }) => [
				{ ...snapshot, order: { ...snapshot.order, totalCents: 1.5 } },
				options
			]
		],
		[
			'an over-limit total',
			({ snapshot, options }) => [
				{ ...snapshot, order: { ...snapshot.order, totalCents: 100000000 } },
				options
			]
		],
		[
			'a non-CAD order',
			({ snapshot, options }) => [
				{ ...snapshot, order: { ...snapshot.order, currency: 'usd' } },
				options
			]
		],
		[
			'a fractional tax',
			({ snapshot, options }) => [
				{ ...snapshot, order: { ...snapshot.order, taxCents: 1.5 } },
				options
			]
		],
		[
			'a negative tax',
			({ snapshot, options }) => [
				{ ...snapshot, order: { ...snapshot.order, taxCents: -1 } },
				options
			]
		],
		[
			'a blank idempotency key',
			({ snapshot, options }) => [
				{
					...snapshot,
					attempt: { ...snapshot.attempt, stripeIdempotencyKey: '' }
				},
				options
			]
		],
		[
			'a malformed persisted line',
			({ snapshot, options }) => [{ ...snapshot, lines: [null] }, options]
		],
		[
			'a blank line label',
			({ snapshot, options }) => [
				{ ...snapshot, lines: [{ ...snapshot.lines[0], label: '' }] },
				options
			]
		],
		[
			'a zero line quantity',
			({ snapshot, options }) => [
				{ ...snapshot, lines: [{ ...snapshot.lines[0], quantity: 0 }] },
				options
			]
		],
		[
			'a fractional line quantity',
			({ snapshot, options }) => [
				{ ...snapshot, lines: [{ ...snapshot.lines[0], quantity: 1.5 }] },
				options
			]
		],
		[
			'an over-limit unit amount',
			({ snapshot, options }) => [
				{ ...snapshot, lines: [{ ...snapshot.lines[0], unitAmountCents: 100000000 }] },
				options
			]
		],
		[
			'a mismatched line amount',
			({ snapshot, options }) => [
				{ ...snapshot, lines: [{ ...snapshot.lines[0], lineAmountCents: 1 }] },
				options
			]
		],
		['no persisted lines', ({ snapshot, options }) => [{ ...snapshot, lines: [] }, options]],
		[
			'too many persisted lines',
			({ snapshot, options }) => [
				{ ...snapshot, lines: Array.from({ length: 66 }, () => snapshot.lines[0]) },
				options
			]
		],
		[
			'a non-created attempt',
			({ snapshot, options }) => [
				{ ...snapshot, attempt: { ...snapshot.attempt, status: 'ready' } },
				options
			]
		]
	];

	it.each(invalidPersistedCheckoutCases)(
		'rejects %s before contacting Stripe',
		async (_label, createInvalid) => {
			const create = vi.fn();
			const [snapshot, options] = createInvalid(persistedStripeFixture());

			await expect(
				createStripeCheckoutSession(
					{ checkout: { sessions: { create } } },
					/** @type {any} */ (snapshot),
					/** @type {any} */ (options)
				)
			).rejects.toBeInstanceOf(Error);
			expect(create).not.toHaveBeenCalled();
		}
	);

	it.each([
		['wrong object', { object: 'payment_intent' }],
		['wrong Session ID', { id: 'cs_live_wrong' }],
		['overlong Session ID', { id: `cs_test_${'a'.repeat(248)}` }],
		['wrong livemode', { livemode: true }],
		['wrong mode', { mode: 'setup' }],
		['wrong UI mode', { ui_mode: 'embedded_page' }],
		['wrong status', { status: 'complete' }],
		['wrong payment state', { payment_status: 'paid' }],
		['wrong currency', { currency: 'usd' }],
		['wrong total', { amount_total: 1 }],
		['wrong reference', { client_reference_id: 'other-order' }],
		['wrong metadata', { metadata: {} }],
		['non-object metadata', { metadata: null }],
		[
			'extra metadata',
			{
				metadata: {
					service: 'marianopolis-book-delivery',
					schema_version: '1',
					order_id: '10000000-0000-4000-8000-000000000001',
					checkout_attempt_id: '20000000-0000-4000-8000-000000000001',
					extra: 'forged'
				}
			}
		],
		['wrong customer email', { customer_email: 'other@example.com' }],
		['delayed payment method', { payment_method_types: ['card', 'sepa_debit'] }],
		[
			'wrong success URL',
			{ success_url: 'https://club.example/books/order-confirmation?session_id=cs_test' }
		],
		['wrong cancel URL', { cancel_url: 'https://evil.example/books/checkout' }],
		['invalid creation time', { created: -1 }],
		['non-integer creation time', { created: 'now' }],
		['expired session', { expires_at: 1786651200 }],
		['non-integer expiry', { expires_at: 'later' }],
		['too-short expiry', { expires_at: 1786651200 + 29 * 60 }],
		['overlong expiry', { expires_at: 1786737701 }],
		['malformed payment intent', { payment_intent: 'not-a-pi' }],
		['expanded payment intent', { payment_intent: { id: 'pi_test_expanded' } }],
		['malformed redirect', { url: 'https://checkout.stripe.com.evil.example/pay' }]
	])('rejects a provider result with %s', async (_label, override) => {
		const order = {
			id: '10000000-0000-4000-8000-000000000001',
			publicReference: PUBLIC_REFERENCE,
			customerEmail: 'ada@example.com',
			currency: 'cad',
			taxCents: 0,
			totalCents: 1800
		};
		const attempt = {
			id: '20000000-0000-4000-8000-000000000001',
			stripeIdempotencyKey: 'mpc-book-checkout-v1:20000000-0000-4000-8000-000000000001',
			status: 'created'
		};
		const session = {
			id: 'cs_test_persisted_checkout',
			object: 'checkout.session',
			livemode: false,
			mode: 'payment',
			ui_mode: 'hosted_page',
			status: 'open',
			payment_status: 'unpaid',
			currency: 'cad',
			amount_total: 1800,
			client_reference_id: order.id,
			metadata: {
				service: 'marianopolis-book-delivery',
				schema_version: '1',
				order_id: order.id,
				checkout_attempt_id: attempt.id
			},
			customer_email: order.customerEmail,
			payment_method_types: ['card'],
			success_url: `https://club.example/books/order-confirmation/${PUBLIC_REFERENCE}`,
			cancel_url: 'https://club.example/books/checkout',
			created: 1786651200,
			expires_at: 1786737600,
			payment_intent: null,
			url: 'https://checkout.stripe.com/c/pay_test_persisted',
			...override
		};
		const stripe = { checkout: { sessions: { create: vi.fn().mockResolvedValue(session) } } };

		await expect(
			createStripeCheckoutSession(
				stripe,
				{
					order,
					attempt,
					lines: [{ label: 'Book', quantity: 1, unitAmountCents: 1800, lineAmountCents: 1800 }]
				},
				{
					appOrigin: 'https://club.example',
					stripeCheckoutHost: null,
					stripeSecretKey: 'sk_test_example',
					now: new Date(1786651300 * 1000)
				}
			)
		).rejects.toThrow(/stripe|checkout|provider|session|redirect/i);
	});

	it('rejects a non-object provider response', async () => {
		const { snapshot, options } = persistedStripeFixture();
		const stripe = { checkout: { sessions: { create: vi.fn().mockResolvedValue(null) } } };
		await expect(createStripeCheckoutSession(stripe, snapshot, options)).rejects.toThrow(
			/provider/i
		);
	});

	it.each([
		[
			'a PaymentIntent ID',
			{
				payment_intent: 'pi_test_persisted',
				url: 'https://checkout.stripe.com/c/pay_test_persisted'
			}
		],
		[
			'an exact configured custom host',
			{ payment_intent: null, url: 'https://pay.club.example/session' }
		]
	])('accepts a valid provider Session with %s', async (_label, providerOverride) => {
		const { snapshot, options } = persistedStripeFixture();
		const session = {
			id: 'cs_test_persisted_checkout',
			object: 'checkout.session',
			livemode: false,
			mode: 'payment',
			ui_mode: 'hosted_page',
			status: 'open',
			payment_status: 'unpaid',
			currency: 'cad',
			amount_total: snapshot.order.totalCents,
			client_reference_id: snapshot.order.id,
			metadata: {
				service: 'marianopolis-book-delivery',
				schema_version: '1',
				order_id: snapshot.order.id,
				checkout_attempt_id: snapshot.attempt.id
			},
			customer_email: snapshot.order.customerEmail,
			payment_method_types: ['card'],
			success_url: `https://club.example/books/order-confirmation/${PUBLIC_REFERENCE}`,
			cancel_url: 'https://club.example/books/checkout',
			created: 1786651200,
			expires_at: 1786737600,
			...providerOverride
		};
		const stripe = { checkout: { sessions: { create: vi.fn().mockResolvedValue(session) } } };
		await expect(
			createStripeCheckoutSession(stripe, snapshot, {
				...options,
				stripeCheckoutHost: providerOverride.url.includes('pay.club.example')
					? 'pay.club.example'
					: null
			})
		).resolves.toMatchObject({
			id: session.id,
			paymentIntentId: providerOverride.payment_intent
		});
	});

	it('accepts a valid live-mode provider Session with a live key', async () => {
		const { snapshot, options } = persistedStripeFixture();
		const session = {
			id: 'cs_live_persisted_checkout',
			object: 'checkout.session',
			livemode: true,
			mode: 'payment',
			ui_mode: 'hosted_page',
			status: 'open',
			payment_status: 'unpaid',
			currency: 'cad',
			amount_total: snapshot.order.totalCents,
			client_reference_id: snapshot.order.id,
			metadata: {
				service: 'marianopolis-book-delivery',
				schema_version: '1',
				order_id: snapshot.order.id,
				checkout_attempt_id: snapshot.attempt.id
			},
			customer_email: snapshot.order.customerEmail,
			payment_method_types: ['card'],
			success_url: `https://club.example/books/order-confirmation/${PUBLIC_REFERENCE}`,
			cancel_url: 'https://club.example/books/checkout',
			created: 1786651200,
			expires_at: 1786737600,
			payment_intent: null,
			url: 'https://checkout.stripe.com/c/pay_live_persisted'
		};
		const stripe = { checkout: { sessions: { create: vi.fn().mockResolvedValue(session) } } };
		await expect(
			createStripeCheckoutSession(stripe, snapshot, {
				...options,
				stripeSecretKey: 'sk_live_example'
			})
		).resolves.toMatchObject({ id: session.id });
	});

	it('accepts only the exact configured custom Checkout hostname', async () => {
		expect(
			isSecureCheckoutRedirectUrl('https://pay.club.example/session', 'pay.club.example')
		).toBe(true);
		expect(
			isSecureCheckoutRedirectUrl('https://evil.pay.club.example/session', 'pay.club.example')
		).toBe(false);
		expect(
			isSecureCheckoutRedirectUrl('https://pay.club.example.evil/session', 'pay.club.example')
		).toBe(false);
		expect(isSecureCheckoutRedirectUrl('https://checkout.stripe.com/session', null)).toBe(true);
		expect(isSecureCheckoutRedirectUrl('https://evil.checkout.stripe.com/session', null)).toBe(
			false
		);
	});

	it('requires a configured secret before constructing a Stripe client', () => {
		expect(() => createStripeClient('')).toThrow(/configuration/i);
		expect(createStripeClient(' sk_test_example ')).toBeInstanceOf(Object);
	});

	it.each([
		[undefined],
		[''],
		['http://checkout.stripe.com/session'],
		['https://user:password@checkout.stripe.com/session'],
		['not a URL'],
		[`https://checkout.stripe.com/${'a'.repeat(2000)}`]
	])('rejects an unsafe checkout redirect value %#', (value) => {
		expect(isSecureCheckoutRedirectUrl(value)).toBe(false);
	});

	it.each([
		null,
		{},
		{ checkout: null },
		{ checkout: { sessions: null } },
		{ checkout: { sessions: { create: null } } }
	])('rejects malformed Stripe checkout client %#', async (client) => {
		await expect(
			createStripeCheckoutSession(
				/** @type {any} */ (client),
				/** @type {any} */ ({}),
				/** @type {any} */ ({})
			)
		).rejects.toThrow(/client/i);
	});
});

describe('retrieveReadyStripeCheckoutSession', () => {
	function fixture() {
		const order = {
			id: '10000000-0000-4000-8000-000000000001',
			publicReference: PUBLIC_REFERENCE,
			customerEmail: 'ada@example.com',
			currency: 'cad',
			taxCents: 0,
			totalCents: 1800
		};
		const attempt = {
			id: '20000000-0000-4000-8000-000000000001',
			stripeIdempotencyKey: 'mpc-book-checkout-v1:20000000-0000-4000-8000-000000000001',
			status: 'ready',
			stripeSessionId: 'cs_test_persisted_checkout'
		};
		const session = {
			id: attempt.stripeSessionId,
			object: 'checkout.session',
			livemode: false,
			mode: 'payment',
			ui_mode: 'hosted_page',
			status: 'open',
			payment_status: 'unpaid',
			currency: 'cad',
			amount_total: 1800,
			client_reference_id: order.id,
			metadata: {
				service: 'marianopolis-book-delivery',
				schema_version: '1',
				order_id: order.id,
				checkout_attempt_id: attempt.id
			},
			customer_email: order.customerEmail,
			payment_method_types: ['card'],
			success_url: `https://club.example/books/order-confirmation/${PUBLIC_REFERENCE}`,
			cancel_url: 'https://club.example/books/checkout',
			created: 1786651200,
			expires_at: 1786737600,
			payment_intent: null,
			url: 'https://checkout.stripe.com/c/pay_test_persisted'
		};
		return {
			snapshot: {
				order,
				attempt,
				lines: [
					{
						label: 'Book',
						quantity: 1,
						unitAmountCents: 1800,
						lineAmountCents: 1800
					}
				]
			},
			session,
			options: {
				appOrigin: 'https://club.example',
				stripeCheckoutHost: null,
				stripeSecretKey: 'sk_test_example',
				now: new Date(1786651300 * 1000)
			}
		};
	}

	it('retrieves the persisted Session ID and applies the full provider validation contract', async () => {
		const { snapshot, session, options } = fixture();
		const retrieve = vi.fn().mockResolvedValue(session);
		const stripe = { checkout: { sessions: { create: vi.fn(), retrieve } } };

		await expect(retrieveReadyStripeCheckoutSession(stripe, snapshot, options)).resolves.toEqual({
			id: session.id,
			url: session.url,
			paymentIntentId: null,
			expiresAt: new Date(session.expires_at * 1000)
		});
		expect(retrieve).toHaveBeenCalledWith(snapshot.attempt.stripeSessionId);
	});

	it('rejects a provider Session different from the persisted ready Session', async () => {
		const { snapshot, session, options } = fixture();
		const retrieve = vi.fn().mockResolvedValue({ ...session, id: 'cs_test_other' });
		const stripe = { checkout: { sessions: { create: vi.fn(), retrieve } } };

		await expect(retrieveReadyStripeCheckoutSession(stripe, snapshot, options)).rejects.toThrow(
			/provider|session/i
		);
	});

	it('rejects a non-ready attempt before retrieval', async () => {
		const { snapshot, options } = fixture();
		const retrieve = vi.fn();
		const stripe = { checkout: { sessions: { create: vi.fn(), retrieve } } };

		await expect(
			retrieveReadyStripeCheckoutSession(
				stripe,
				{ ...snapshot, attempt: { ...snapshot.attempt, status: 'created' } },
				options
			)
		).rejects.toThrow(/attempt/i);
		expect(retrieve).not.toHaveBeenCalled();
	});

	it('rejects a ready-attempt client without retrieval support', async () => {
		const { snapshot, options } = fixture();
		await expect(
			retrieveReadyStripeCheckoutSession(
				{ checkout: { sessions: { create: vi.fn() } } },
				snapshot,
				options
			)
		).rejects.toThrow(/client/i);
	});
});

describe('retrieveStripeCheckoutSession', () => {
	it('retrieves expanded checkout details through an injected server client', async () => {
		const retrieve = vi.fn().mockResolvedValue({
			id: 'cs_test_book_delivery',
			payment_status: 'paid'
		});
		const stripe = {
			checkout: {
				sessions: {
					create: vi.fn(),
					retrieve
				}
			}
		};

		const session = await retrieveStripeCheckoutSession(stripe, 'cs_test_book_delivery');

		expect(session).toEqual({ id: 'cs_test_book_delivery', payment_status: 'paid' });
		expect(retrieve).toHaveBeenCalledWith('cs_test_book_delivery', {
			expand: ['line_items']
		});
	});

	it('rejects malformed session IDs before calling the provider', async () => {
		const retrieve = vi.fn();
		const stripe = {
			checkout: {
				sessions: {
					create: vi.fn(),
					retrieve
				}
			}
		};

		await expect(retrieveStripeCheckoutSession(stripe, 'not-a-session-id')).rejects.toThrow(
			/session id/i
		);
		expect(retrieve).not.toHaveBeenCalled();
	});

	it('rejects a checkout client without session retrieval support', async () => {
		await expect(
			retrieveStripeCheckoutSession(
				{ checkout: { sessions: { create: vi.fn() } } },
				'cs_test_valid'
			)
		).rejects.toThrow(/client/i);
	});
});
