/**
 * @typedef {{ bookId: string, quantity: number }} CartItem
 * @typedef {{ items: CartItem[] }} Cart
 * @typedef {string | CartItem} BookSelection
 * @typedef {{ id: string, title: string, priceCents: number, bookstoreId: string }} PricedBook
 * @typedef {{ id: string, name: string, serviceFeeCents: number }} PricedBookstore
 * @typedef {{ taxRateBps: number, books: PricedBook[], bookstores: PricedBookstore[] }} PriceCatalogue
 */

/**
 * @param {string} bookId
 */
function assertBookId(bookId) {
	if (typeof bookId !== 'string' || bookId.length === 0) {
		throw new Error('Book ID must be a non-empty string');
	}
}

/**
 * @param {number} quantity
 */
function assertIntegerQuantity(quantity) {
	if (!Number.isSafeInteger(quantity)) {
		throw new Error('Book quantity must be a safe integer quantity');
	}
}

/**
 * @param {number} value
 * @param {string} label
 * @returns {number}
 */
function assertNonNegativeSafeInteger(value, label) {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new Error(`${label} must be a non-negative safe integer`);
	}

	return value;
}

/**
 * @param {number} left
 * @param {number} right
 * @param {string} label
 * @returns {number}
 */
function addSafeIntegers(left, right, label) {
	return assertNonNegativeSafeInteger(left + right, label);
}

/**
 * @param {number} left
 * @param {number} right
 * @param {string} label
 * @returns {number}
 */
function multiplySafeIntegers(left, right, label) {
	return assertNonNegativeSafeInteger(left * right, label);
}

/**
 * @param {CartItem[]} items
 * @param {BookSelection[]} selections
 * @returns {Cart}
 */
function mergeSelections(items, selections) {
	const quantities = new Map();

	for (const selection of [...items, ...selections]) {
		const bookId = typeof selection === 'string' ? selection : selection.bookId;
		const quantity = typeof selection === 'string' ? 1 : selection.quantity;

		assertBookId(bookId);
		assertIntegerQuantity(quantity);
		if (quantity <= 0) {
			throw new Error('Added book quantity must be greater than zero');
		}

		quantities.set(
			bookId,
			addSafeIntegers(quantities.get(bookId) ?? 0, quantity, 'Merged book quantity')
		);
	}

	return {
		items: Array.from(quantities, ([bookId, quantity]) => ({ bookId, quantity }))
	};
}

/**
 * @param {BookSelection[]} [itemsOrBookIds]
 * @returns {Cart}
 */
export function createCart(itemsOrBookIds = []) {
	return mergeSelections([], itemsOrBookIds);
}

/**
 * @param {Cart} cart
 * @param {BookSelection[]} selections
 * @returns {Cart}
 */
export function addBooks(cart, selections) {
	return mergeSelections(cart.items, selections);
}

/**
 * @param {Cart} cart
 * @param {string} bookId
 * @param {boolean} selected
 * @returns {Cart}
 */
export function setBookSelected(cart, bookId, selected) {
	assertBookId(bookId);
	const canonicalCart = createCart(cart.items);

	if (!selected) {
		return {
			items: canonicalCart.items.filter((item) => item.bookId !== bookId)
		};
	}

	if (canonicalCart.items.some((item) => item.bookId === bookId)) {
		return canonicalCart;
	}

	return addBooks(canonicalCart, [bookId]);
}

/**
 * @param {Cart} cart
 * @param {string} bookId
 * @param {number} quantity
 * @returns {Cart}
 */
export function setBookQuantity(cart, bookId, quantity) {
	assertBookId(bookId);
	assertIntegerQuantity(quantity);
	const canonicalCart = createCart(cart.items);

	if (quantity <= 0) {
		return {
			items: canonicalCart.items.filter((item) => item.bookId !== bookId)
		};
	}

	const existingItem = canonicalCart.items.find((item) => item.bookId === bookId);
	if (!existingItem) {
		return {
			items: [...canonicalCart.items, { bookId, quantity }]
		};
	}

	return {
		items: canonicalCart.items.map((item) => (item.bookId === bookId ? { bookId, quantity } : item))
	};
}

/**
 * @param {PriceCatalogue} priceCatalogue
 * @param {Cart} cart
 */
export function calculateCart(priceCatalogue, cart) {
	assertNonNegativeSafeInteger(priceCatalogue.taxRateBps, 'Tax rate basis points');
	const booksById = new Map(priceCatalogue.books.map((book) => [book.id, book]));
	const bookstoresById = new Map(
		priceCatalogue.bookstores.map((bookstore) => [bookstore.id, bookstore])
	);
	const representedBookstores = new Set();
	const lines = createCart(cart.items).items.map(({ bookId, quantity }) => {
		const book = booksById.get(bookId);
		if (!book) {
			throw new Error(`Unknown book: ${bookId}`);
		}

		if (!bookstoresById.has(book.bookstoreId)) {
			throw new Error(`Unknown bookstore: ${book.bookstoreId}`);
		}

		assertNonNegativeSafeInteger(book.priceCents, 'Book price in cents');
		representedBookstores.add(book.bookstoreId);
		return {
			bookId: book.id,
			title: book.title,
			bookstoreId: book.bookstoreId,
			quantity,
			unitPriceCents: book.priceCents,
			amountCents: multiplySafeIntegers(book.priceCents, quantity, 'Book line amount in cents')
		};
	});
	const bookSubtotalCents = lines.reduce(
		(subtotal, line) => addSafeIntegers(subtotal, line.amountCents, 'Book subtotal in cents'),
		0
	);
	const fees = Array.from(representedBookstores, (bookstoreId) => {
		const bookstore = bookstoresById.get(bookstoreId);
		if (!bookstore) {
			throw new Error(`Unknown bookstore: ${bookstoreId}`);
		}

		assertNonNegativeSafeInteger(bookstore.serviceFeeCents, 'Bookstore service fee in cents');
		return {
			bookstoreId,
			label: `${bookstore.name} pickup service`,
			amountCents: bookstore.serviceFeeCents
		};
	});
	const feeSubtotalCents = fees.reduce(
		(subtotal, fee) => addSafeIntegers(subtotal, fee.amountCents, 'Fee subtotal in cents'),
		0
	);
	const preTaxTotalCents = addSafeIntegers(
		bookSubtotalCents,
		feeSubtotalCents,
		'Pre-tax total in cents'
	);
	const taxNumerator = multiplySafeIntegers(
		preTaxTotalCents,
		priceCatalogue.taxRateBps,
		'Tax numerator'
	);
	const taxCents = assertNonNegativeSafeInteger(
		Math.round(taxNumerator / 10000),
		'Tax amount in cents'
	);
	const totalCents = addSafeIntegers(preTaxTotalCents, taxCents, 'Cart total in cents');

	return {
		bookSubtotalCents,
		taxCents,
		fees,
		totalCents,
		lines
	};
}
