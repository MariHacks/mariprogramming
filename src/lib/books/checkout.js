import { calculateCart, createCart } from './cart';
import { catalogue } from './catalogue';

const REQUEST_FIELDS = ['items', 'name', 'email'];
const ITEM_FIELDS = ['bookId', 'quantity'];
const MAX_ITEM_COUNT = 32;
const MAX_BOOK_ID_LENGTH = 120;
const MAX_QUANTITY_PER_ITEM = 99;
const MAX_TOTAL_BOOKS = 99;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN =
	/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

/**
 * @typedef {{
 *   kind: 'book' | 'fee' | 'tax',
 *   id: string,
 *   label: string,
 *   bookstoreId?: string,
 *   quantity: number,
 *   unitAmountCents: number,
 *   amountCents: number
 * }} CheckoutLine
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

/**
 * @param {Record<string, unknown>} value
 * @param {string[]} fields
 * @param {string} label
 */
function assertExactFields(value, fields, label) {
	for (const field of fields) {
		if (!Object.prototype.hasOwnProperty.call(value, field)) {
			throw new Error(`${label} must include ${field}`);
		}
	}

	if (Object.keys(value).some((field) => !fields.includes(field))) {
		throw new Error(`${label} contains unsupported fields`);
	}
}

/**
 * @param {unknown} value
 * @param {string} label
 * @param {number} maximumLength
 * @returns {string}
 */
function normalizeString(value, label, maximumLength) {
	if (typeof value !== 'string' || value.length > maximumLength) {
		throw new Error(`${label} must be a bounded string`);
	}

	const normalized = value.trim();
	if (!normalized) {
		throw new Error(`${label} is required`);
	}

	return normalized;
}

/** @param {unknown} value */
function normalizeName(value) {
	return normalizeString(value, 'Guest name', MAX_NAME_LENGTH).replace(/\s+/gu, ' ');
}

/** @param {unknown} value */
function normalizeEmail(value) {
	const email = normalizeString(value, 'Guest email', MAX_EMAIL_LENGTH);
	const [localPart] = email.split('@');
	if (
		!EMAIL_PATTERN.test(email) ||
		localPart.startsWith('.') ||
		localPart.endsWith('.') ||
		localPart.includes('..')
	) {
		throw new Error('Guest email must be valid');
	}

	return email;
}

/**
 * @param {unknown} value
 * @returns {{ bookId: string, quantity: number }[]}
 */
function normalizeItems(value) {
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error('Checkout items must include at least one book');
	}

	if (value.length > MAX_ITEM_COUNT) {
		throw new Error(`Checkout items cannot exceed ${MAX_ITEM_COUNT} entries`);
	}

	return value.map((item) => {
		if (!isPlainObject(item)) {
			throw new Error('Checkout item must be an object');
		}

		assertExactFields(item, ITEM_FIELDS, 'Checkout item');
		const bookId = normalizeString(item.bookId, 'Book ID', MAX_BOOK_ID_LENGTH);
		const quantity = item.quantity;

		if (
			typeof quantity !== 'number' ||
			!Number.isSafeInteger(quantity) ||
			quantity < 1 ||
			quantity > MAX_QUANTITY_PER_ITEM
		) {
			throw new Error(`Book quantity must be a safe integer from 1 to ${MAX_QUANTITY_PER_ITEM}`);
		}

		return { bookId, quantity };
	});
}

/**
 * @param {{ items: { bookId: string, quantity: number }[] }} cart
 */
function assertCanonicalCartBounds(cart) {
	const bookCount = cart.items.reduce((total, item) => total + item.quantity, 0);

	if (
		cart.items.some((item) => item.quantity > MAX_QUANTITY_PER_ITEM) ||
		bookCount > MAX_TOTAL_BOOKS
	) {
		throw new Error(`Checkout canonical quantity cannot exceed ${MAX_TOTAL_BOOKS}`);
	}

	return bookCount;
}

/**
 * @param {{ bookId: string, title: string, bookstoreId: string, quantity: number, unitPriceCents: number, amountCents: number }} line
 * @returns {CheckoutLine}
 */
function createBookDescriptor(line) {
	return {
		kind: 'book',
		id: line.bookId,
		label: line.title,
		bookstoreId: line.bookstoreId,
		quantity: line.quantity,
		unitAmountCents: line.unitPriceCents,
		amountCents: line.amountCents
	};
}

/**
 * @param {{ bookstoreId: string, label: string, amountCents: number }} fee
 * @returns {CheckoutLine}
 */
function createFeeDescriptor(fee) {
	return {
		kind: 'fee',
		id: `fee:${fee.bookstoreId}`,
		label: fee.label,
		bookstoreId: fee.bookstoreId,
		quantity: 1,
		unitAmountCents: fee.amountCents,
		amountCents: fee.amountCents
	};
}

/**
 * Rebuilds a trusted checkout order from browser-supplied IDs, quantities, and guest contact only.
 *
 * @param {unknown} request
 * @param {import('./catalogue').Catalogue} [priceCatalogue]
 */
export function createCheckoutOrder(request, priceCatalogue = catalogue) {
	if (!isPlainObject(request)) {
		throw new Error('Checkout request must be an object');
	}

	assertExactFields(request, REQUEST_FIELDS, 'Checkout request');
	const guest = {
		name: normalizeName(request.name),
		email: normalizeEmail(request.email)
	};
	const cart = createCart(normalizeItems(request.items));
	const bookCount = assertCanonicalCartBounds(cart);
	const summary = calculateCart(priceCatalogue, cart);
	/** @type {CheckoutLine[]} */
	const lineItems = [
		...summary.lines.map(createBookDescriptor),
		...summary.fees.map(createFeeDescriptor)
	];

	if (summary.taxCents > 0) {
		lineItems.push({
			kind: 'tax',
			id: 'tax',
			label: 'Tax',
			quantity: 1,
			unitAmountCents: summary.taxCents,
			amountCents: summary.taxCents
		});
	}

	return {
		guest,
		cart,
		summary,
		lineItems,
		metadata: {
			service: 'Marianopolis Book Delivery',
			bookCount: String(bookCount)
		}
	};
}
