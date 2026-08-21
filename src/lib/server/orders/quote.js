import { CatalogueInputError, CatalogueUnavailableError } from '../catalogue/repository.js';

/** @returns {never} */
function unavailable() {
	throw new CatalogueUnavailableError();
}

/** @param {number} value */
function safeCents(value) {
	if (!Number.isSafeInteger(value) || value < 0) unavailable();
	return value;
}

/** @param {number} left @param {number} right */
function addCents(left, right) {
	return safeCents(left + right);
}

/** @param {unknown} value */
function validLine(value) {
	if (
		value === null ||
		typeof value !== 'object' ||
		!['book', 'service_fee'].includes(/** @type {any} */ (value).kind) ||
		typeof (/** @type {any} */ (value).bookstoreId) !== 'string' ||
		typeof (/** @type {any} */ (value).bookstoreName) !== 'string' ||
		!Number.isSafeInteger(/** @type {any} */ (value).quantity) ||
		/** @type {any} */ (value).quantity < 1 ||
		!Number.isSafeInteger(/** @type {any} */ (value).unitAmountCents) ||
		/** @type {any} */ (value).unitAmountCents < 0 ||
		/** @type {any} */ (value).lineAmountCents !==
			/** @type {any} */ (value).quantity * /** @type {any} */ (value).unitAmountCents
	) {
		unavailable();
	}
	return /** @type {any} */ (value);
}

/** @param {any} value */
function freezeQuote(value) {
	for (const line of value.lines) Object.freeze(line);
	Object.freeze(value.lines);
	return Object.freeze(value);
}

/**
 * Quotes every selected teacher-course list on the same outer transaction so its row locks stay
 * held until WU6 persists the order. Course quote primitives prove each association; this merger
 * then removes duplicated bookstore fees and calculates tax once for the complete cart.
 *
 * @param {unknown} transaction
 * @param {ReturnType<import('./request.js').normalizeCheckoutRequest>} canonicalRequest
 * @param {unknown} repository
 */
export async function quoteCheckoutCoursesInTransaction(transaction, canonicalRequest, repository) {
	if (
		transaction === null ||
		typeof transaction !== 'object' ||
		repository === null ||
		typeof repository !== 'object' ||
		typeof (/** @type {any} */ (repository).quoteSelectedBooksInTransaction) !== 'function'
	) {
		unavailable();
	}

	try {
		const courseQuotes = [];
		for (const course of canonicalRequest.courses) {
			courseQuotes.push(
				await /** @type {any} */ (repository).quoteSelectedBooksInTransaction(transaction, {
					teacherSlug: course.teacherSlug,
					courseId: course.courseId,
					selections: course.selections
				})
			);
		}
		const first = courseQuotes[0];
		if (!first || first.currency !== 'cad') unavailable();
		const taxRateBps = safeCents(first.taxRateBps);
		if (taxRateBps > 10000) unavailable();

		const books = [];
		const fees = new Map();
		for (const quote of courseQuotes) {
			if (
				quote.currency !== 'cad' ||
				quote.taxRateBps !== taxRateBps ||
				!Array.isArray(quote.lines)
			) {
				unavailable();
			}
			for (const rawLine of quote.lines) {
				const line = validLine(rawLine);
				if (line.kind === 'book') {
					books.push({ ...line });
					continue;
				}
				const existing = fees.get(line.bookstoreId);
				if (
					existing &&
					(existing.bookstoreName !== line.bookstoreName ||
						existing.unitAmountCents !== line.unitAmountCents ||
						existing.label !== line.label)
				) {
					unavailable();
				}
				fees.set(line.bookstoreId, { ...line });
			}
		}
		books.sort(
			(left, right) =>
				left.courseId.localeCompare(right.courseId) || left.bookId.localeCompare(right.bookId)
		);
		const feeLines = [...fees.values()].sort((left, right) =>
			left.bookstoreId.localeCompare(right.bookstoreId)
		);
		const subtotalCents = books.reduce((total, line) => addCents(total, line.lineAmountCents), 0);
		const serviceFeeCents = feeLines.reduce(
			(total, line) => addCents(total, line.lineAmountCents),
			0
		);
		const preTax = addCents(subtotalCents, serviceFeeCents);
		const taxCents = safeCents(Math.round(safeCents(subtotalCents * taxRateBps) / 10000));
		return freezeQuote({
			currency: 'cad',
			subtotalCents,
			serviceFeeCents,
			taxCents,
			totalCents: addCents(preTax, taxCents),
			taxRateBps,
			lines: [...books, ...feeLines]
		});
	} catch (error) {
		if (error instanceof CatalogueInputError || error instanceof CatalogueUnavailableError) {
			throw error;
		}
		throw new CatalogueUnavailableError();
	}
}
