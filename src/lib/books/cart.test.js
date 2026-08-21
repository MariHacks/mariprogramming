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
	it('rejects missing book IDs and non-positive additions', () => {
		expect(() => createCart([''])).toThrow(/non-empty string/i);
		expect(() => createCart([{ bookId: 'antigone', quantity: 0 }])).toThrow(/greater than zero/i);
		expect(() => createCart([{ courseId: '', bookId: 'antigone', quantity: 1 }])).toThrow(
			/course ID.*non-empty string/i
		);
		expect(() =>
			createCart([{ courseId: /** @type {any} */ (42), bookId: 'antigone', quantity: 1 }])
		).toThrow(/course ID.*non-empty string/i);
	});

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

		expect(setBookQuantity(createCart(), 'antigone', 2)).toEqual({
			items: [{ bookId: 'antigone', quantity: 2 }]
		});
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

	it('rejects unsafe quantities', () => {
		expect(() => setBookQuantity(createCart(), 'antigone', Number.MAX_SAFE_INTEGER + 1)).toThrow(
			/safe integer quantity/i
		);
	});

	it('rejects an unsafe quantity merge', () => {
		expect(() =>
			createCart([
				{ bookId: 'antigone', quantity: Number.MAX_SAFE_INTEGER },
				{ bookId: 'antigone', quantity: 1 }
			])
		).toThrow(/merged book quantity.*safe integer/i);
	});

	it('keeps the same book assignment distinct across two courses', () => {
		const cart = createCart([
			{ courseId: 'course-a', bookId: 'shared-book', quantity: 1 },
			{ courseId: 'course-b', bookId: 'shared-book', quantity: 2 }
		]);

		expect(cart).toEqual({
			items: [
				{ courseId: 'course-a', bookId: 'shared-book', quantity: 1 },
				{ courseId: 'course-b', bookId: 'shared-book', quantity: 2 }
			]
		});
		expect(setBookQuantity(cart, 'shared-book', 4, 'course-a')).toEqual({
			items: [
				{ courseId: 'course-a', bookId: 'shared-book', quantity: 4 },
				{ courseId: 'course-b', bookId: 'shared-book', quantity: 2 }
			]
		});
		expect(setBookSelected(cart, 'shared-book', false, 'course-b')).toEqual({
			items: [{ courseId: 'course-a', bookId: 'shared-book', quantity: 1 }]
		});
		expect(setBookSelected(createCart(), 'shared-book', true, 'course-a')).toEqual({
			items: [{ courseId: 'course-a', bookId: 'shared-book', quantity: 1 }]
		});
		expect(setBookQuantity(createCart(), 'shared-book', 3, 'course-a')).toEqual({
			items: [{ courseId: 'course-a', bookId: 'shared-book', quantity: 3 }]
		});
	});
});

describe('calculateCart', () => {
	it('matches price rows by course and book instead of an ambiguous book ID', () => {
		const result = calculateCart(
			{
				taxRateBps: 0,
				bookstores: [{ id: 'store', name: 'Store', serviceFeeCents: 500 }],
				books: [
					{
						id: 'shared-book',
						courseId: 'course-a',
						title: 'Course A edition',
						priceCents: 1000,
						bookstoreId: 'store'
					},
					{
						id: 'shared-book',
						courseId: 'course-b',
						title: 'Course B edition',
						priceCents: 2000,
						bookstoreId: 'store'
					}
				]
			},
			createCart([
				{ courseId: 'course-a', bookId: 'shared-book', quantity: 1 },
				{ courseId: 'course-b', bookId: 'shared-book', quantity: 1 }
			])
		);

		expect(result.lines).toEqual([
			expect.objectContaining({
				courseId: 'course-a',
				bookId: 'shared-book',
				title: 'Course A edition',
				amountCents: 1000
			}),
			expect.objectContaining({
				courseId: 'course-b',
				bookId: 'shared-book',
				title: 'Course B edition',
				amountCents: 2000
			})
		]);
		expect(result.fees).toHaveLength(1);
		expect(result.totalCents).toBe(3500);
		expect(() =>
			calculateCart(
				{
					taxRateBps: 0,
					bookstores: [{ id: 'store', name: 'Store', serviceFeeCents: 500 }],
					books: [
						{
							id: 'shared-book',
							courseId: 'course-a',
							title: 'A',
							priceCents: 1000,
							bookstoreId: 'store'
						},
						{
							id: 'shared-book',
							courseId: 'course-b',
							title: 'B',
							priceCents: 1000,
							bookstoreId: 'store'
						}
					]
				},
				createCart(['shared-book'])
			)
		).toThrow(/ambiguous book/i);
		expect(
			calculateCart(
				{
					taxRateBps: 0,
					bookstores: [{ id: 'store', name: 'Store', serviceFeeCents: 500 }],
					books: [
						{
							id: 'single-book',
							courseId: 'course-a',
							title: 'Single edition',
							priceCents: 1000,
							bookstoreId: 'store'
						}
					]
				},
				createCart(['single-book'])
			).lines[0]
		).toMatchObject({ courseId: 'course-a', bookId: 'single-book' });
	});
	it('charges GST on the book subtotal only and leaves the service fee untaxed', () => {
		const result = calculateCart(
			{ ...fixture, taxRateBps: 500 },
			{
				items: [
					{ bookId: 'le-petit-prince', quantity: 1 },
					{ bookId: 'bescherelle', quantity: 1 }
				]
			}
		);

		expect(result.bookSubtotalCents).toBe(4890);
		expect(result.fees).toEqual([
			{ bookstoreId: 'renaud-bray', label: 'Renaud-Bray pickup service', amountCents: 500 }
		]);
		expect(result.taxCents).toBe(245);
		expect(result.totalCents).toBe(5635);
	});

	it('charges one service fee for multiple books from the same bookstore', () => {
		const result = calculateCart(fixture, {
			items: [
				{ bookId: 'le-petit-prince', quantity: 1 },
				{ bookId: 'bescherelle', quantity: 1 }
			]
		});

		expect(result).toEqual({
			bookSubtotalCents: 4890,
			taxCents: 733,
			fees: [{ bookstoreId: 'renaud-bray', label: 'Renaud-Bray pickup service', amountCents: 500 }],
			totalCents: 6123,
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
		expect(result.taxCents).toBe(1270);
		expect(result.totalCents).toBe(10950);
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

	it.each([
		['fractional', 1000.25],
		['negative', -1],
		['unsafe', Number.MAX_SAFE_INTEGER + 1]
	])('rejects a %s selected book price', (_case, priceCents) => {
		const invalidFixture = structuredClone(fixture);
		invalidFixture.books[0].priceCents = priceCents;

		expect(() => calculateCart(invalidFixture, createCart(['le-petit-prince']))).toThrow(
			/book price.*non-negative safe integer/i
		);
	});

	it.each([
		['fractional', 500.5],
		['negative', -1],
		['unsafe', Number.MAX_SAFE_INTEGER + 1]
	])('rejects a %s represented bookstore fee', (_case, serviceFeeCents) => {
		const invalidFixture = structuredClone(fixture);
		invalidFixture.bookstores[0].serviceFeeCents = serviceFeeCents;

		expect(() => calculateCart(invalidFixture, createCart(['le-petit-prince']))).toThrow(
			/bookstore service fee.*non-negative safe integer/i
		);
	});

	it.each([
		['fractional', 1498.5],
		['negative', -1],
		['unsafe', Number.MAX_SAFE_INTEGER + 1]
	])('rejects a %s tax rate', (_case, taxRateBps) => {
		const invalidFixture = { ...fixture, taxRateBps };

		expect(() => calculateCart(invalidFixture, createCart(['le-petit-prince']))).toThrow(
			/tax rate.*non-negative safe integer/i
		);
	});

	it('rejects an unsafe quantity-by-price product', () => {
		const invalidFixture = structuredClone(fixture);
		invalidFixture.books[0].priceCents = Number.MAX_SAFE_INTEGER;

		expect(() =>
			calculateCart(invalidFixture, createCart([{ bookId: 'le-petit-prince', quantity: 2 }]))
		).toThrow(/book line amount.*safe integer/i);
	});

	it('rejects an unsafe book subtotal', () => {
		const invalidFixture = structuredClone(fixture);
		invalidFixture.books[0].priceCents = Number.MAX_SAFE_INTEGER;
		invalidFixture.books[1].priceCents = 1;

		expect(() =>
			calculateCart(invalidFixture, createCart(['le-petit-prince', 'bescherelle']))
		).toThrow(/book subtotal.*safe integer/i);
	});

	it('rejects an unsafe fee subtotal', () => {
		const invalidFixture = structuredClone(fixture);
		invalidFixture.books[0].priceCents = 0;
		invalidFixture.books[2].priceCents = 0;
		invalidFixture.bookstores[0].serviceFeeCents = Number.MAX_SAFE_INTEGER;
		invalidFixture.bookstores[1].serviceFeeCents = 1;

		expect(() =>
			calculateCart(invalidFixture, createCart(['le-petit-prince', 'antigone']))
		).toThrow(/fee subtotal.*safe integer/i);
	});

	it('rejects an unsafe pre-tax total', () => {
		const invalidFixture = structuredClone(fixture);
		invalidFixture.books[0].priceCents = Number.MAX_SAFE_INTEGER;
		invalidFixture.bookstores[0].serviceFeeCents = 1;

		expect(() => calculateCart(invalidFixture, createCart(['le-petit-prince']))).toThrow(
			/pre-tax total.*safe integer/i
		);
	});

	it('rejects an unsafe tax numerator', () => {
		const invalidFixture = structuredClone(fixture);
		invalidFixture.taxRateBps = 2;
		invalidFixture.books[0].priceCents = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
		invalidFixture.bookstores[0].serviceFeeCents = 0;

		expect(() => calculateCart(invalidFixture, createCart(['le-petit-prince']))).toThrow(
			/tax numerator.*safe integer/i
		);
	});

	it('rejects an unsafe final total', () => {
		const invalidFixture = structuredClone(fixture);
		invalidFixture.taxRateBps = 1;
		invalidFixture.books[0].priceCents = Number.MAX_SAFE_INTEGER;
		invalidFixture.bookstores[0].serviceFeeCents = 0;

		expect(() => calculateCart(invalidFixture, createCart(['le-petit-prince']))).toThrow(
			/cart total.*safe integer/i
		);
	});

	it('ignores malformed monetary data outside the selected cart', () => {
		const catalogueWithUnselectedInvalidData = {
			...fixture,
			books: [
				...fixture.books,
				{
					id: 'unselected',
					title: 'Unselected',
					priceCents: 12.5,
					bookstoreId: 'unused-store'
				}
			],
			bookstores: [
				...fixture.bookstores,
				{ id: 'unused-store', name: 'Unused Store', serviceFeeCents: -1 }
			]
		};

		const result = calculateCart(
			catalogueWithUnselectedInvalidData,
			createCart(['le-petit-prince'])
		);

		expect(result.bookSubtotalCents).toBe(1895);
		expect(result.fees).toEqual([
			{ bookstoreId: 'renaud-bray', label: 'Renaud-Bray pickup service', amountCents: 500 }
		]);
		expect(result.taxCents).toBe(284);
		expect(result.totalCents).toBe(2679);
	});

	it('rejects a bookstore identifier that changes while pricing a line', () => {
		let readCount = 0;
		const unstableBook = {
			id: 'unstable',
			title: 'Unstable',
			priceCents: 1000,
			get bookstoreId() {
				readCount += 1;
				return readCount === 1 ? 'renaud-bray' : 'missing-store';
			}
		};

		expect(() =>
			calculateCart({ ...fixture, books: [unstableBook] }, createCart(['unstable']))
		).toThrow(/unknown bookstore: missing-store/i);
	});
});
