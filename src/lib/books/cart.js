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
	if (!Number.isInteger(quantity)) {
		throw new Error('Book quantity must be an integer quantity');
	}
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

		quantities.set(bookId, (quantities.get(bookId) ?? 0) + quantity);
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

		representedBookstores.add(book.bookstoreId);
		return {
			bookId: book.id,
			title: book.title,
			bookstoreId: book.bookstoreId,
			quantity,
			unitPriceCents: book.priceCents,
			amountCents: book.priceCents * quantity
		};
	});
	const bookSubtotalCents = lines.reduce((subtotal, line) => subtotal + line.amountCents, 0);
	const fees = Array.from(representedBookstores, (bookstoreId) => {
		const bookstore = bookstoresById.get(bookstoreId);
		if (!bookstore) {
			throw new Error(`Unknown bookstore: ${bookstoreId}`);
		}

		return {
			bookstoreId,
			label: `${bookstore.name} pickup service`,
			amountCents: bookstore.serviceFeeCents
		};
	});
	const feeSubtotalCents = fees.reduce((subtotal, fee) => subtotal + fee.amountCents, 0);
	const taxCents = Math.round(
		((bookSubtotalCents + feeSubtotalCents) * priceCatalogue.taxRateBps) / 10000
	);

	return {
		bookSubtotalCents,
		taxCents,
		fees,
		totalCents: bookSubtotalCents + feeSubtotalCents + taxCents,
		lines
	};
}
