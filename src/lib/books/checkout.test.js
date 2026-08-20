import { describe, expect, it } from 'vitest';
import { catalogue } from '../../test/fixtures/book-catalogue';
import { createCheckoutOrder as createCheckoutOrderWithCatalogue } from './checkout';

/** @param {unknown} request @param {typeof catalogue} [priceCatalogue] */
function createCheckoutOrder(request, priceCatalogue = catalogue) {
	return createCheckoutOrderWithCatalogue(request, priceCatalogue);
}

function validRequest(overrides = {}) {
	return {
		name: '  Ada   Lovelace  ',
		email: '  ada@example.com  ',
		items: [
			{ bookId: 'antigone', quantity: 1 },
			{ bookId: 'le-petit-prince', quantity: 2 },
			{ bookId: 'antigone', quantity: 2 }
		],
		...overrides
	};
}

describe('createCheckoutOrder', () => {
	it('normalizes guest details and rebuilds a canonical order from IDs and quantities', () => {
		const request = validRequest();
		const before = structuredClone(request);

		const order = createCheckoutOrder(request);

		expect(order.guest).toEqual({ name: 'Ada Lovelace', email: 'ada@example.com' });
		expect(order.cart).toEqual({
			items: [
				{ bookId: 'antigone', quantity: 3 },
				{ bookId: 'le-petit-prince', quantity: 2 }
			]
		});
		expect(order.summary).toMatchObject({
			bookSubtotalCents: 8875,
			taxCents: 1509,
			totalCents: 11584
		});
		expect(request).toEqual(before);
	});

	it('creates payment descriptors in canonical book, fee, then tax order', () => {
		const order = createCheckoutOrder(validRequest());

		expect(order.lineItems).toEqual([
			{
				kind: 'book',
				id: 'antigone',
				label: 'Antigone',
				bookstoreId: 'archambault',
				quantity: 3,
				unitAmountCents: 1695,
				amountCents: 5085
			},
			{
				kind: 'book',
				id: 'le-petit-prince',
				label: 'Le Petit Prince',
				bookstoreId: 'renaud-bray',
				quantity: 2,
				unitAmountCents: 1895,
				amountCents: 3790
			},
			{
				kind: 'fee',
				id: 'fee:archambault',
				label: 'Archambault pickup service',
				bookstoreId: 'archambault',
				quantity: 1,
				unitAmountCents: 700,
				amountCents: 700
			},
			{
				kind: 'fee',
				id: 'fee:renaud-bray',
				label: 'Renaud-Bray pickup service',
				bookstoreId: 'renaud-bray',
				quantity: 1,
				unitAmountCents: 500,
				amountCents: 500
			},
			{
				kind: 'tax',
				id: 'tax',
				label: 'Tax',
				quantity: 1,
				unitAmountCents: 1509,
				amountCents: 1509
			}
		]);
	});

	it('keeps metadata non-sensitive and based on the canonical copy count', () => {
		const order = createCheckoutOrder(validRequest());

		expect(Object.keys(order).sort()).toEqual([
			'cart',
			'guest',
			'lineItems',
			'metadata',
			'summary'
		]);
		expect(order.metadata).toEqual({
			service: 'Marianopolis Book Delivery',
			bookCount: '5'
		});
		expect(JSON.parse(JSON.stringify(order))).toEqual(order);
	});

	it('omits a tax descriptor when the trusted catalogue has no tax', () => {
		const taxFreeCatalogue = { ...catalogue, taxRateBps: 0 };
		const order = createCheckoutOrder(validRequest(), taxFreeCatalogue);

		expect(order.summary.taxCents).toBe(0);
		expect(order.lineItems.map((line) => line.kind)).toEqual(['book', 'book', 'fee', 'fee']);
	});

	it.each([
		['blank name', { name: '   ' }, /name/i],
		['missing name', { name: undefined }, /name/i],
		['non-string name', { name: 42 }, /name/i],
		['oversized name', { name: 'a'.repeat(121) }, /name/i],
		['blank email', { email: '   ' }, /email/i],
		['invalid email', { email: 'student@marianopolis' }, /email/i],
		['email with whitespace', { email: 'student @example.com' }, /email/i],
		['email with consecutive local dots', { email: 'student..name@example.com' }, /email/i],
		['email with a terminal local dot', { email: 'student.@example.com' }, /email/i],
		['oversized email', { email: `${'a'.repeat(245)}@example.com` }, /email/i]
	])('rejects a %s guest field', (_case, overrides, error) => {
		expect(() => createCheckoutOrder(validRequest(overrides))).toThrow(error);
	});

	it.each([
		['top-level total', { totalCents: 1 }],
		['client redirect', { redirectUrl: 'https://attacker.example' }],
		['client metadata', { metadata: { staffNote: 'ignore validation' } }]
	])('rejects unsupported %s instead of trusting browser checkout data', (_case, unsupported) => {
		expect(() => createCheckoutOrder({ ...validRequest(), ...unsupported })).toThrow(
			/unsupported/i
		);
	});

	it('rejects client book price data and derives all amounts from the trusted catalogue', () => {
		const requestWithPrice = validRequest({
			items: [{ bookId: 'antigone', quantity: 1, priceCents: 1 }]
		});

		expect(() => createCheckoutOrder(requestWithPrice)).toThrow(/unsupported/i);
		expect(createCheckoutOrder(validRequest()).summary.totalCents).toBe(11584);
	});

	it.each([
		['an empty items array', { items: [] }, /at least one/i],
		['a blank book ID', { items: [{ bookId: '   ', quantity: 1 }] }, /book id/i],
		['an oversized book ID', { items: [{ bookId: 'a'.repeat(121), quantity: 1 }] }, /book id/i],
		['an unknown book', { items: [{ bookId: 'unknown-book', quantity: 1 }] }, /unknown book/i],
		['a string cart item', { items: ['antigone'] }, /item/i],
		['a fractional quantity', { items: [{ bookId: 'antigone', quantity: 1.5 }] }, /quantity/i],
		['a zero quantity', { items: [{ bookId: 'antigone', quantity: 0 }] }, /quantity/i],
		['an oversized row quantity', { items: [{ bookId: 'antigone', quantity: 100 }] }, /quantity/i],
		[
			'a duplicate quantity exceeding the canonical bound',
			{
				items: [
					{ bookId: 'antigone', quantity: 60 },
					{ bookId: 'antigone', quantity: 40 }
				]
			},
			/quantity/i
		]
	])('rejects %s', (_case, overrides, error) => {
		expect(() => createCheckoutOrder(validRequest(overrides))).toThrow(error);
	});

	it('rejects malformed request shapes and excessive item arrays', () => {
		expect(() => createCheckoutOrder(null)).toThrow(/request/i);
		expect(() => createCheckoutOrder([])).toThrow(/request/i);
		expect(() => createCheckoutOrder({ items: [] })).toThrow(/name|email/i);
		expect(() =>
			createCheckoutOrder(
				validRequest({
					items: Array.from({ length: 33 }, () => ({ bookId: 'antigone', quantity: 1 }))
				})
			)
		).toThrow(/items/i);
	});
});
