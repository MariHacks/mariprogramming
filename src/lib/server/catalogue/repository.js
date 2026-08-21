import { isIP } from 'node:net';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { readRuntimeEnvironment } from '../config/environment';
import { books, bookstores, courseBooks, courses, teachers } from '../db/schema';
import { withDatabaseTransaction } from '../db/transaction';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const DISALLOWED_HOST_SUFFIXES = new Set([
	'alt',
	'arpa',
	'example',
	'home',
	'internal',
	'invalid',
	'lan',
	'local',
	'localdomain',
	'localhost',
	'onion',
	'private',
	'test'
]);
const MAX_URL_LENGTH = 2048;
const MAX_SELECTIONS = 25;
const MAX_QUANTITY = 10;

/**
 * @typedef {{ bookId: string, quantity: number }} BookSelection
 * @typedef {{
 *   teacherId: string, teacherSlug: string, teacherName: string,
 *   courseId: string, courseCode: string, courseTitle: string, courseBookPosition: number,
 *   bookId: string, bookTitle: string, bookAuthor: string | null, bookIsbn: string | null,
 *   bookPriceCents: number, bookRetailerUrl: string, bookCoverUrl: string | null,
 *   bookstoreId: string, bookstoreName: string, bookstoreServiceFeeCents: number
 * }} CatalogueRow
 * @typedef {{
 *   id: string, code: string, title: string, teacher: { slug: string, name: string },
 *   books: Array<{
 *     id: string, title: string, author: string | null, isbn: string | null, priceCents: number,
 *     storefrontUrl: string, coverUrl: string | null,
 *     bookstore: { id: string, name: string, serviceFeeCents: number }
 *   }>
 * }} CourseDto
 */

export class CatalogueInputError extends Error {
	constructor() {
		super('Book selection is unavailable');
		this.name = 'CatalogueInputError';
		this.code = 'CATALOGUE_SELECTION_INVALID';
	}
}

export class CatalogueUnavailableError extends Error {
	constructor() {
		super('Book catalogue is unavailable');
		this.name = 'CatalogueUnavailableError';
		this.code = 'CATALOGUE_UNAVAILABLE';
	}
}

/** @returns {never} */
function unavailable() {
	throw new CatalogueUnavailableError();
}

/** @returns {never} */
function invalidSelection() {
	throw new CatalogueInputError();
}

/** @param {string} hostname */
function isSafeHostname(hostname) {
	if (
		!hostname ||
		hostname.length > 253 ||
		hostname !== hostname.toLowerCase() ||
		hostname.includes('xn--') ||
		isIP(hostname.startsWith('[') ? hostname.slice(1, -1) : hostname) !== 0
	) {
		return false;
	}

	const labels = hostname.split('.');
	return (
		labels.length >= 2 &&
		!DISALLOWED_HOST_SUFFIXES.has(/** @type {string} */ (labels.at(-1))) &&
		labels.every((label) => HOST_LABEL_PATTERN.test(label))
	);
}

/**
 * Normalizes a stored navigation/image URL only after exact-host allowlisting. It never fetches it.
 *
 * @param {unknown} value
 * @param {ReadonlySet<string>} approvedHostnames
 * @param {{ optional?: boolean }} [options]
 * @returns {string | null}
 */
export function normalizeApprovedHttpsUrl(value, approvedHostnames, { optional = false } = {}) {
	if (value === null && optional) return null;
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) {
		return unavailable();
	}

	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		return unavailable();
	}

	if (
		parsed.protocol !== 'https:' ||
		parsed.username ||
		parsed.password ||
		parsed.port ||
		parsed.hash ||
		!isSafeHostname(parsed.hostname) ||
		!approvedHostnames.has(parsed.hostname)
	) {
		return unavailable();
	}

	return parsed.toString();
}

/**
 * @param {unknown} value
 * @param {number} maximum
 * @param {{ nullable?: boolean }} [options]
 * @returns {string | null}
 */
function boundedString(value, maximum, { nullable = false } = {}) {
	if (nullable && value === null) return null;
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > maximum ||
		value !== value.trim()
	) {
		return unavailable();
	}
	return value;
}

/** @param {unknown} value @param {number} [minimum] @param {number} [maximum] @returns {number} */
function safeCents(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		value < minimum ||
		value > maximum
	)
		return unavailable();
	return value;
}

/** @param {number} left @param {number} right */
function addCents(left, right) {
	return safeCents(left + right);
}

/** @param {number} left @param {number} right */
function multiplyCents(left, right) {
	return safeCents(left * right);
}

/** @param {string} left @param {string} right */
function compareText(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}

/** @param {unknown} approvedHostnames @returns {ReadonlySet<string>} */
function validateHostnameConfiguration(approvedHostnames) {
	if (
		!Array.isArray(approvedHostnames) ||
		approvedHostnames.length === 0 ||
		approvedHostnames.length > 32
	) {
		return unavailable();
	}

	const unique = new Set(approvedHostnames);
	if (
		unique.size !== approvedHostnames.length ||
		[...unique].some((host) => !isSafeHostname(host))
	) {
		return unavailable();
	}
	return unique;
}

/** @param {unknown} taxRateBps */
function validateTaxRate(taxRateBps) {
	return safeCents(taxRateBps, 0, 10000);
}

/** @param {unknown} teacherSlug @param {unknown} courseId */
function validateCourseLocator(teacherSlug, courseId) {
	if (
		typeof teacherSlug !== 'string' ||
		teacherSlug.length > 120 ||
		!SLUG_PATTERN.test(teacherSlug) ||
		typeof courseId !== 'string' ||
		!UUID_PATTERN.test(courseId)
	) {
		return invalidSelection();
	}
}

/** @param {unknown} selections @returns {BookSelection[]} */
function validateSelections(selections) {
	if (!Array.isArray(selections) || selections.length === 0 || selections.length > MAX_SELECTIONS) {
		return invalidSelection();
	}

	const seen = new Set();
	return selections.map((selection) => {
		if (
			selection === null ||
			typeof selection !== 'object' ||
			Array.isArray(selection) ||
			Object.keys(selection).some((key) => !['bookId', 'quantity'].includes(key)) ||
			typeof selection.bookId !== 'string' ||
			!UUID_PATTERN.test(selection.bookId) ||
			!Number.isSafeInteger(selection.quantity) ||
			selection.quantity < 1 ||
			selection.quantity > MAX_QUANTITY ||
			seen.has(selection.bookId)
		) {
			return invalidSelection();
		}
		seen.add(selection.bookId);
		return { bookId: selection.bookId, quantity: selection.quantity };
	});
}

/** @param {{ teacherSlug: string, courseId: string, selections: unknown }} request */
function normalizeQuoteRequest({ teacherSlug, courseId, selections }) {
	validateCourseLocator(teacherSlug, courseId);
	return { teacherSlug, courseId, selections: validateSelections(selections) };
}

const catalogueSelection = {
	teacherId: teachers.id,
	teacherSlug: teachers.slug,
	teacherName: teachers.name,
	courseId: courses.id,
	courseCode: courses.code,
	courseTitle: courses.title,
	courseBookPosition: courseBooks.position,
	bookId: books.id,
	bookTitle: books.title,
	bookAuthor: books.author,
	bookIsbn: books.isbn,
	bookPriceCents: books.priceCents,
	bookRetailerUrl: books.retailerUrl,
	bookCoverUrl: books.coverUrl,
	bookstoreId: bookstores.id,
	bookstoreName: bookstores.name,
	bookstoreServiceFeeCents: bookstores.serviceFeeCents
};

/** @param {any} transaction */
function activeJoin(transaction) {
	return transaction
		.select(catalogueSelection)
		.from(courses)
		.innerJoin(teachers, eq(courses.teacherId, teachers.id))
		.innerJoin(courseBooks, eq(courseBooks.courseId, courses.id))
		.innerJoin(books, eq(courseBooks.bookId, books.id))
		.innerJoin(bookstores, eq(books.bookstoreId, bookstores.id));
}

function activeConditions() {
	return [
		eq(teachers.active, true),
		eq(courses.active, true),
		eq(courseBooks.active, true),
		eq(books.active, true),
		eq(bookstores.active, true)
	];
}

/** @param {any} row @param {ReadonlySet<string>} approvedHostnames @returns {CatalogueRow} */
function validateRow(row, approvedHostnames) {
	if (
		row === null ||
		typeof row !== 'object' ||
		!UUID_PATTERN.test(row.teacherId) ||
		!UUID_PATTERN.test(row.courseId) ||
		!UUID_PATTERN.test(row.bookId) ||
		!UUID_PATTERN.test(row.bookstoreId) ||
		!SLUG_PATTERN.test(row.teacherSlug) ||
		!Number.isSafeInteger(row.courseBookPosition) ||
		row.courseBookPosition < 0
	) {
		return unavailable();
	}

	return {
		teacherId: row.teacherId,
		teacherSlug: /** @type {string} */ (boundedString(row.teacherSlug, 120)),
		teacherName: /** @type {string} */ (boundedString(row.teacherName, 160)),
		courseId: row.courseId,
		courseCode: /** @type {string} */ (boundedString(row.courseCode, 64)),
		courseTitle: /** @type {string} */ (boundedString(row.courseTitle, 200)),
		courseBookPosition: row.courseBookPosition,
		bookId: row.bookId,
		bookTitle: /** @type {string} */ (boundedString(row.bookTitle, 240)),
		bookAuthor: boundedString(row.bookAuthor, 200, { nullable: true }),
		bookIsbn: boundedString(row.bookIsbn, 32, { nullable: true }),
		bookPriceCents: safeCents(row.bookPriceCents),
		bookRetailerUrl: /** @type {string} */ (
			normalizeApprovedHttpsUrl(row.bookRetailerUrl, approvedHostnames)
		),
		bookCoverUrl: normalizeApprovedHttpsUrl(row.bookCoverUrl, approvedHostnames, {
			optional: true
		}),
		bookstoreId: row.bookstoreId,
		bookstoreName: /** @type {string} */ (boundedString(row.bookstoreName, 160)),
		bookstoreServiceFeeCents: safeCents(row.bookstoreServiceFeeCents, 500, 700)
	};
}

/** @param {CatalogueRow} left @param {CatalogueRow} right */
function compareRows(left, right) {
	return (
		compareText(left.teacherName, right.teacherName) ||
		compareText(left.teacherSlug, right.teacherSlug) ||
		compareText(left.courseCode, right.courseCode) ||
		compareText(left.courseId, right.courseId) ||
		left.courseBookPosition - right.courseBookPosition ||
		compareText(left.bookTitle, right.bookTitle) ||
		compareText(left.bookId, right.bookId)
	);
}

/** @param {any[]} rows @param {ReadonlySet<string>} approvedHostnames @returns {CourseDto | null} */
function courseDto(rows, approvedHostnames) {
	if (rows.length === 0) return null;
	const validatedRows = rows.map((row) => validateRow(row, approvedHostnames)).sort(compareRows);
	const first = validatedRows[0];
	if (
		validatedRows.some(
			(row) =>
				row.courseId !== first.courseId ||
				row.courseCode !== first.courseCode ||
				row.courseTitle !== first.courseTitle ||
				row.teacherId !== first.teacherId ||
				row.teacherSlug !== first.teacherSlug ||
				row.teacherName !== first.teacherName
		) ||
		new Set(validatedRows.map((row) => row.bookId)).size !== validatedRows.length
	) {
		return unavailable();
	}

	return {
		id: first.courseId,
		code: first.courseCode,
		title: first.courseTitle,
		teacher: { slug: first.teacherSlug, name: first.teacherName },
		books: validatedRows.map((row) => ({
			id: row.bookId,
			title: row.bookTitle,
			author: row.bookAuthor,
			isbn: row.bookIsbn,
			priceCents: row.bookPriceCents,
			storefrontUrl: row.bookRetailerUrl,
			coverUrl: row.bookCoverUrl,
			bookstore: {
				id: row.bookstoreId,
				name: row.bookstoreName,
				serviceFeeCents: row.bookstoreServiceFeeCents
			}
		}))
	};
}

/** @param {any[]} rows @param {ReadonlySet<string>} approvedHostnames @returns {CourseDto[]} */
function listDtos(rows, approvedHostnames) {
	/** @type {Map<string, any[]>} */
	const grouped = new Map();
	for (const row of rows) {
		const key = typeof row?.courseId === 'string' ? row.courseId : unavailable();
		const group = grouped.get(key) ?? [];
		group.push(row);
		grouped.set(key, group);
	}
	return [...grouped.values()]
		.map((group) => /** @type {CourseDto} */ (courseDto(group, approvedHostnames)))
		.sort(
			(left, right) =>
				compareText(left.teacher.name, right.teacher.name) ||
				compareText(left.teacher.slug, right.teacher.slug) ||
				compareText(left.code, right.code) ||
				compareText(left.id, right.id)
		);
}

/** @param {any} value */
function freezeQuote(value) {
	for (const line of value.lines) Object.freeze(line);
	Object.freeze(value.lines);
	return Object.freeze(value);
}

/**
 * @param {any[]} rows
 * @param {BookSelection[]} selections
 * @param {number} taxRateBps
 * @param {ReadonlySet<string>} approvedHostnames
 */
function buildQuote(rows, selections, taxRateBps, approvedHostnames) {
	const validatedRows = rows.map((row) => validateRow(row, approvedHostnames)).sort(compareRows);
	const byBook = new Map();
	for (const row of validatedRows) {
		if (byBook.has(row.bookId)) return invalidSelection();
		byBook.set(row.bookId, row);
	}
	if (byBook.size !== selections.length) return invalidSelection();

	const bookLines = selections
		.map(({ bookId, quantity }) => {
			const row = byBook.get(bookId);
			if (!row) return invalidSelection();
			return {
				kind: 'book',
				label: row.bookTitle,
				isbn: row.bookIsbn,
				bookId: row.bookId,
				teacherId: row.teacherId,
				teacherName: row.teacherName,
				courseId: row.courseId,
				courseCode: row.courseCode,
				courseTitle: row.courseTitle,
				bookstoreId: row.bookstoreId,
				bookstoreName: row.bookstoreName,
				quantity,
				unitAmountCents: row.bookPriceCents,
				lineAmountCents: multiplyCents(row.bookPriceCents, quantity)
			};
		})
		.sort((left, right) => compareRows(byBook.get(left.bookId), byBook.get(right.bookId)));

	const bookstoresById = new Map();
	for (const row of validatedRows) {
		const existing = bookstoresById.get(row.bookstoreId);
		if (
			existing &&
			(existing.name !== row.bookstoreName ||
				existing.serviceFeeCents !== row.bookstoreServiceFeeCents)
		) {
			return unavailable();
		}
		bookstoresById.set(row.bookstoreId, {
			name: row.bookstoreName,
			serviceFeeCents: row.bookstoreServiceFeeCents
		});
	}

	const feeLines = [...bookstoresById]
		.sort(([leftId], [rightId]) => compareText(leftId, rightId))
		.map(([bookstoreId, bookstore]) => ({
			kind: 'service_fee',
			label: `${bookstore.name} pickup service`,
			isbn: null,
			bookId: null,
			teacherId: null,
			teacherName: null,
			courseId: null,
			courseCode: null,
			courseTitle: null,
			bookstoreId,
			bookstoreName: bookstore.name,
			quantity: 1,
			unitAmountCents: bookstore.serviceFeeCents,
			lineAmountCents: bookstore.serviceFeeCents
		}));

	const subtotalCents = bookLines.reduce((total, line) => addCents(total, line.lineAmountCents), 0);
	const serviceFeeCents = feeLines.reduce(
		(total, line) => addCents(total, line.lineAmountCents),
		0
	);
	const preTaxCents = addCents(subtotalCents, serviceFeeCents);
	const taxCents = safeCents(Math.round(multiplyCents(subtotalCents, taxRateBps) / 10000));
	return freezeQuote({
		currency: 'cad',
		subtotalCents,
		serviceFeeCents,
		taxCents,
		totalCents: addCents(preTaxCents, taxCents),
		taxRateBps,
		lines: [...bookLines, ...feeLines]
	});
}

/** @template T @param {() => Promise<T>} operation @returns {Promise<T>} */
function redactUnexpected(operation) {
	return operation().catch((error) => {
		if (error instanceof CatalogueInputError) throw error;
		throw new CatalogueUnavailableError();
	});
}

/**
 * Creates the server-only public catalogue boundary. The allowlist and legally approved tax rate
 * are explicit dependencies; there is no permissive production default.
 *
 * @param {{
 *   approvedHostnames: string[],
 *   taxRateBps: number,
 *   databaseUrl?: string,
 *   runTransaction?: typeof withDatabaseTransaction
 * }} configuration
 */
export function createCatalogueRepository({
	approvedHostnames,
	taxRateBps,
	databaseUrl,
	runTransaction = withDatabaseTransaction
}) {
	let normalizedHosts;
	let normalizedTaxRate;
	let runtimeDatabaseUrl;
	try {
		normalizedHosts = validateHostnameConfiguration(approvedHostnames);
		normalizedTaxRate = validateTaxRate(taxRateBps);
		runtimeDatabaseUrl = databaseUrl ?? readRuntimeEnvironment().databaseUrl;
		if (typeof runtimeDatabaseUrl !== 'string' || runtimeDatabaseUrl.length === 0) unavailable();
	} catch {
		return unavailable();
	}

	/** @param {(transaction: any) => Promise<any>} operation */
	const transact = (operation) => runTransaction(operation, { databaseUrl: runtimeDatabaseUrl });
	/**
	 * @param {any} transaction
	 * @param {{ teacherSlug: string, courseId: string, selections: BookSelection[] }} request
	 */
	const quoteInTransaction = async (transaction, { teacherSlug, courseId, selections }) => {
		const selectedIds = selections.map(({ bookId }) => bookId);
		const rows = await activeJoin(transaction)
			.where(
				and(
					...activeConditions(),
					eq(teachers.slug, teacherSlug),
					eq(courses.id, courseId),
					inArray(books.id, selectedIds)
				)
			)
			.orderBy(asc(courseBooks.position), asc(books.title), asc(books.id))
			.for('update');
		return buildQuote(rows, selections, normalizedTaxRate, normalizedHosts);
	};

	return Object.freeze({
		async listActiveCourseSummaries() {
			return redactUnexpected(async () => {
				const rows = await transact((transaction) =>
					activeJoin(transaction)
						.where(and(...activeConditions()))
						.orderBy(
							asc(teachers.name),
							asc(teachers.slug),
							asc(courses.code),
							asc(courses.id),
							asc(courseBooks.position),
							asc(books.title),
							asc(books.id)
						)
				);
				return listDtos(rows, normalizedHosts);
			});
		},

		/** @param {string} teacherSlug @param {string} courseId */
		async getActiveCourseDetail(teacherSlug, courseId) {
			validateCourseLocator(teacherSlug, courseId);
			return redactUnexpected(async () => {
				const rows = await transact((transaction) =>
					activeJoin(transaction)
						.where(
							and(...activeConditions(), eq(teachers.slug, teacherSlug), eq(courses.id, courseId))
						)
						.orderBy(asc(courseBooks.position), asc(books.title), asc(books.id))
				);
				return courseDto(rows, normalizedHosts);
			});
		},

		/** @param {any} transaction @param {{ teacherSlug: string, courseId: string, selections: unknown }} request */
		async quoteSelectedBooksInTransaction(transaction, request) {
			const normalizedRequest = normalizeQuoteRequest(request);
			return redactUnexpected(() => quoteInTransaction(transaction, normalizedRequest));
		},

		/** @param {{ teacherSlug: string, courseId: string, selections: unknown }} request */
		async quoteSelectedBooks(request) {
			const normalizedRequest = normalizeQuoteRequest(request);
			return redactUnexpected(() =>
				transact((transaction) => quoteInTransaction(transaction, normalizedRequest))
			);
		}
	});
}
