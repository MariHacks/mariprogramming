/**
 * @typedef {{ courseId?: string, bookId: string, quantity: number }} CartItem
 * @typedef {{ items: CartItem[] }} Cart
 * @typedef {string | CartItem} BookSelection
 * @typedef {{ id: string, courseId?: string, title: string, priceCents: number, bookstoreId: string }} PricedBook
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

/** @param {unknown} courseId */
function assertCourseId(courseId) {
	if (courseId !== undefined && (typeof courseId !== 'string' || courseId.length === 0)) {
		throw new Error('Course ID must be a non-empty string');
	}
}

/** @param {string | undefined} courseId @param {string} bookId */
export function cartSelectionKey(courseId, bookId) {
	assertCourseId(courseId);
	assertBookId(bookId);
	return JSON.stringify([courseId ?? null, bookId]);
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
		const courseId = typeof selection === 'string' ? undefined : selection.courseId;
		const quantity = typeof selection === 'string' ? 1 : selection.quantity;

		assertBookId(bookId);
		assertCourseId(courseId);
		assertIntegerQuantity(quantity);
		if (quantity <= 0) {
			throw new Error('Added book quantity must be greater than zero');
		}

		const key = cartSelectionKey(courseId, bookId);
		const existing = quantities.get(key);
		quantities.set(key, {
			...(courseId === undefined ? {} : { courseId }),
			bookId,
			quantity: addSafeIntegers(existing?.quantity ?? 0, quantity, 'Merged book quantity')
		});
	}

	return {
		items: Array.from(quantities.values())
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
 * @param {string} [courseId]
 * @returns {Cart}
 */
export function setBookSelected(cart, bookId, selected, courseId) {
	assertBookId(bookId);
	assertCourseId(courseId);
	const canonicalCart = createCart(cart.items);
	const key = cartSelectionKey(courseId, bookId);

	if (!selected) {
		return {
			items: canonicalCart.items.filter(
				(item) => cartSelectionKey(item.courseId, item.bookId) !== key
			)
		};
	}

	if (canonicalCart.items.some((item) => cartSelectionKey(item.courseId, item.bookId) === key)) {
		return canonicalCart;
	}

	return addBooks(canonicalCart, [
		courseId === undefined ? bookId : { courseId, bookId, quantity: 1 }
	]);
}

/**
 * @param {Cart} cart
 * @param {string} bookId
 * @param {number} quantity
 * @param {string} [courseId]
 * @returns {Cart}
 */
export function setBookQuantity(cart, bookId, quantity, courseId) {
	assertBookId(bookId);
	assertCourseId(courseId);
	assertIntegerQuantity(quantity);
	const canonicalCart = createCart(cart.items);
	const key = cartSelectionKey(courseId, bookId);

	if (quantity <= 0) {
		return {
			items: canonicalCart.items.filter(
				(item) => cartSelectionKey(item.courseId, item.bookId) !== key
			)
		};
	}

	const existingItem = canonicalCart.items.find(
		(item) => cartSelectionKey(item.courseId, item.bookId) === key
	);
	if (!existingItem) {
		return {
			items: [
				...canonicalCart.items,
				{ ...(courseId === undefined ? {} : { courseId }), bookId, quantity }
			]
		};
	}

	return {
		items: canonicalCart.items.map((item) =>
			cartSelectionKey(item.courseId, item.bookId) === key ? { ...item, quantity } : item
		)
	};
}

/**
 * @param {PriceCatalogue} priceCatalogue
 * @param {Cart} cart
 */
export function calculateCart(priceCatalogue, cart) {
	assertNonNegativeSafeInteger(priceCatalogue.taxRateBps, 'Tax rate basis points');
	const booksBySelection = new Map(
		priceCatalogue.books.map((book) => [cartSelectionKey(book.courseId, book.id), book])
	);
	const booksById = new Map();
	for (const book of priceCatalogue.books) {
		const matches = booksById.get(book.id) ?? [];
		matches.push(book);
		booksById.set(book.id, matches);
	}
	const bookstoresById = new Map(
		priceCatalogue.bookstores.map((bookstore) => [bookstore.id, bookstore])
	);
	const representedBookstores = new Set();
	const lines = createCart(cart.items).items.map(({ courseId, bookId, quantity }) => {
		const candidates = booksById.get(bookId) ?? [];
		const book =
			courseId === undefined
				? candidates.length === 1
					? candidates[0]
					: undefined
				: booksBySelection.get(cartSelectionKey(courseId, bookId));
		if (!book) {
			throw new Error(
				candidates.length > 1 ? `Ambiguous book: ${bookId}` : `Unknown book: ${bookId}`
			);
		}

		if (!bookstoresById.has(book.bookstoreId)) {
			throw new Error(`Unknown bookstore: ${book.bookstoreId}`);
		}

		assertNonNegativeSafeInteger(book.priceCents, 'Book price in cents');
		representedBookstores.add(book.bookstoreId);
		return {
			...(courseId === undefined && book.courseId === undefined
				? {}
				: { courseId: courseId ?? book.courseId }),
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
