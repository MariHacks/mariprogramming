import { describe, expect, it } from 'vitest';
import { addBooks, calculateCart, createCart, setBookQuantity, setBookSelected } from './cart';

const fixture = {
	taxRateBps: 1498,
	bookstores: [
		{ id: 'renaud-bray', name: 'Renaud-Bray', serviceFeeCents: 500 },
		{ id: 'archambault', name: 'Archambault', serviceFeeCents: 700 }
	],
	books: [
		{
			id: 'le-petit-prince',
			title: 'Le Petit Prince',
			priceCents: 1895,
			bookstoreId: 'renaud-bray'
		},
		{ id: 'bescherelle', title: 'Bescherelle', priceCents: 2995, bookstoreId: 'renaud-bray' },
		{ id: 'antigone', title: 'Antigone', priceCents: 1695, bookstoreId: 'archambault' }
	]
};

describe('cart mutations', () => {
	it('creates one canonical line per book and merges duplicate quantities', () => {
		expect(
			createCart([
				'le-petit-prince',
				{ bookId: 'le-petit-prince', quantity: 2 },
				{ bookId: 'antigone', quantity: 1 }
			])
		).toEqual({
			items: [
				{ bookId: 'le-petit-prince', quantity: 3 },
				{ bookId: 'antigone', quantity: 1 }
			]
		});
	});

	it('adds selections without mutating the existing cart or selections', () => {
		const cart = createCart([{ bookId: 'bescherelle', quantity: 2 }]);
		const selections = [
			{ bookId: 'bescherelle', quantity: 1 },
			{ bookId: 'antigone', quantity: 2 }
		];
		const cartBefore = structuredClone(cart);
		const selectionsBefore = structuredClone(selections);

		expect(addBooks(cart, selections)).toEqual({
			items: [
				{ bookId: 'bescherelle', quantity: 3 },
				{ bookId: 'antigone', quantity: 2 }
			]
		});
		expect(cart).toEqual(cartBefore);
		expect(selections).toEqual(selectionsBefore);
	});

	it('adds an absent selected book once and preserves an existing quantity', () => {
		const selected = setBookSelected(createCart(), 'antigone', true);

		expect(selected).toEqual({ items: [{ bookId: 'antigone', quantity: 1 }] });
		expect(
			setBookSelected(createCart([{ bookId: 'antigone', quantity: 3 }]), 'antigone', true)
		).toEqual({ items: [{ bookId: 'antigone', quantity: 3 }] });
	});

	it('removes a line when a selected book is unselected without changing the source cart', () => {
		const cart = createCart(['antigone', 'bescherelle']);
		const result = setBookSelected(cart, 'antigone', false);

		expect(result.items).toEqual([{ bookId: 'bescherelle', quantity: 1 }]);
		expect(cart.items).toEqual([
			{ bookId: 'antigone', quantity: 1 },
			{ bookId: 'bescherelle', quantity: 1 }
		]);
	});

	it('sets a positive integer quantity and removes the line at zero or below', () => {
		const cart = createCart(['antigone']);

		expect(setBookQuantity(cart, 'antigone', 4)).toEqual({
			items: [{ bookId: 'antigone', quantity: 4 }]
		});
		expect(setBookQuantity(cart, 'antigone', 0)).toEqual({ items: [] });
		expect(setBookQuantity(cart, 'antigone', -2)).toEqual({ items: [] });
		expect(cart).toEqual({ items: [{ bookId: 'antigone', quantity: 1 }] });
	});

	it('rejects fractional quantities instead of creating ambiguous prices', () => {
		expect(() => setBookQuantity(createCart(), 'antigone', 1.5)).toThrow(/integer quantity/i);
		expect(() => addBooks(createCart(), [{ bookId: 'antigone', quantity: 1.5 }])).toThrow(
			/integer quantity/i
		);
	});
});

describe('calculateCart', () => {
	it('charges one service fee for multiple books from the same bookstore', () => {
		const result = calculateCart(fixture, {
			items: [
				{ bookId: 'le-petit-prince', quantity: 1 },
				{ bookId: 'bescherelle', quantity: 1 }
			]
		});

		expect(result).toEqual({
			bookSubtotalCents: 4890,
			taxCents: 807,
			fees: [{ bookstoreId: 'renaud-bray', label: 'Renaud-Bray pickup service', amountCents: 500 }],
			totalCents: 6197,
			lines: [
				{
					bookId: 'le-petit-prince',
					title: 'Le Petit Prince',
					bookstoreId: 'renaud-bray',
					quantity: 1,
					unitPriceCents: 1895,
					amountCents: 1895
				},
				{
					bookId: 'bescherelle',
					title: 'Bescherelle',
					bookstoreId: 'renaud-bray',
					quantity: 1,
					unitPriceCents: 2995,
					amountCents: 2995
				}
			]
		});
	});

	it('charges each represented bookstore once and includes quantity in the subtotal', () => {
		const result = calculateCart(
			fixture,
			createCart([{ bookId: 'le-petit-prince', quantity: 2 }, 'bescherelle', 'antigone'])
		);

		expect(result.bookSubtotalCents).toBe(8480);
		expect(result.fees).toEqual([
			{ bookstoreId: 'renaud-bray', label: 'Renaud-Bray pickup service', amountCents: 500 },
			{ bookstoreId: 'archambault', label: 'Archambault pickup service', amountCents: 700 }
		]);
		expect(result.taxCents).toBe(1450);
		expect(result.totalCents).toBe(11130);
	});

	it('returns exact zero totals for an empty cart', () => {
		expect(calculateCart(fixture, createCart())).toEqual({
			bookSubtotalCents: 0,
			taxCents: 0,
			fees: [],
			totalCents: 0,
			lines: []
		});
	});

	it('throws when a cart line names an unknown book', () => {
		expect(() => calculateCart(fixture, createCart(['missing-book']))).toThrow(
			/unknown book: missing-book/i
		);
	});

	it('throws when a selected book names an unknown bookstore', () => {
		const invalidFixture = {
			...fixture,
			books: [{ id: 'orphan', title: 'Orphan', priceCents: 1000, bookstoreId: 'missing-store' }]
		};

		expect(() => calculateCart(invalidFixture, createCart(['orphan']))).toThrow(
			/unknown bookstore: missing-store/i
		);
	});
});
