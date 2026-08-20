import { and, asc, eq } from 'drizzle-orm';
import { auditLog, books, bookstores, courseBooks, courses, teachers } from '../db/schema';
import { withDatabaseTransaction } from '../db/transaction.js';
import { normalizeApprovedHttpsUrl } from './repository.js';

const RESOURCES = new Set(['teachers', 'courses', 'bookstores', 'books', 'assignments']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,6})\.\d{2}$/u;
const MAX_STAFF_RECORDS = 200;
const STAFF_EMAIL = 'team@marihacks.com';

const RESOURCE_DEFINITIONS = Object.freeze({
	teachers: Object.freeze({
		table: teachers,
		type: 'teacher',
		createFields: ['slug', 'name'],
		updateFields: ['slug', 'name']
	}),
	courses: Object.freeze({
		table: courses,
		type: 'course',
		createFields: ['teacherId', 'code', 'title'],
		updateFields: ['teacherId', 'code', 'title']
	}),
	bookstores: Object.freeze({
		table: bookstores,
		type: 'bookstore',
		createFields: ['name', 'serviceFee'],
		updateFields: ['name', 'serviceFee']
	}),
	books: Object.freeze({
		table: books,
		type: 'book',
		createFields: ['bookstoreId', 'title', 'author', 'isbn', 'retailerUrl', 'coverUrl', 'price'],
		updateFields: ['bookstoreId', 'title', 'author', 'isbn', 'retailerUrl', 'coverUrl', 'price']
	}),
	assignments: Object.freeze({
		table: courseBooks,
		type: 'course_book',
		createFields: ['courseId', 'bookId', 'position'],
		updateFields: ['position']
	})
});

export class StaffCatalogueValidationError extends Error {
	/** @param {Record<string, string>} fieldErrors */
	constructor(fieldErrors) {
		super('Catalogue entry is invalid');
		this.name = 'StaffCatalogueValidationError';
		this.code = 'STAFF_CATALOGUE_INVALID';
		this.fieldErrors = Object.freeze({ ...fieldErrors });
	}
}

export class StaffCatalogueConflictError extends Error {
	constructor() {
		super('Catalogue entry changed');
		this.name = 'StaffCatalogueConflictError';
		this.code = 'STAFF_CATALOGUE_CONFLICT';
	}
}

export class StaffCatalogueUnavailableError extends Error {
	constructor() {
		super('Staff catalogue is unavailable');
		this.name = 'StaffCatalogueUnavailableError';
		this.code = 'STAFF_CATALOGUE_UNAVAILABLE';
	}
}

/** @param {Record<string, string>} [fieldErrors] @returns {never} */
function invalid(fieldErrors = { _form: 'Check the entry and try again.' }) {
	throw new StaffCatalogueValidationError(fieldErrors);
}

/** @returns {never} */
function conflict() {
	throw new StaffCatalogueConflictError();
}

/** @returns {never} */
function unavailable() {
	throw new StaffCatalogueUnavailableError();
}

/** @param {unknown} resource */
function resourceDefinition(resource) {
	if (typeof resource !== 'string' || !RESOURCES.has(resource)) return invalid();
	return /** @type {any} */ (RESOURCE_DEFINITIONS)[resource];
}

/** @param {unknown} value @param {number} maximum @param {string} field @param {Record<string, string>} errors */
function textField(value, maximum, field, errors) {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > maximum ||
		value !== value.trim() ||
		value.includes('\0') ||
		value.includes('\r') ||
		value.includes('\n')
	) {
		errors[field] = 'Enter a valid value.';
		return '';
	}
	return value;
}

/** @param {unknown} value @param {number} maximum @param {string} field @param {Record<string, string>} errors */
function optionalTextField(value, maximum, field, errors) {
	if (value === '') return null;
	return textField(value, maximum, field, errors);
}

/** @param {unknown} value @param {string} field @param {Record<string, string>} errors */
function uuidField(value, field, errors) {
	if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
		errors[field] = 'Choose a valid entry.';
		return '';
	}
	return value;
}

/** @param {unknown} value @param {string} field @param {Record<string, string>} errors */
function moneyField(value, field, errors) {
	if (typeof value !== 'string' || !MONEY_PATTERN.test(value)) {
		errors[field] = 'Use dollars and cents, such as 12.50.';
		return 0;
	}
	const [dollars, cents] = value.split('.');
	return Number(dollars) * 100 + Number(cents);
}

/** @param {string} value */
function validIsbn(value) {
	if (/^\d{13}$/u.test(value)) {
		let sum = 0;
		for (let index = 0; index < 13; index += 1) {
			sum += Number(value[index]) * (index % 2 === 0 ? 1 : 3);
		}
		return sum % 10 === 0;
	}
	if (!/^\d{9}[\dX]$/u.test(value)) return false;
	let sum = 0;
	for (let index = 0; index < 10; index += 1) {
		const character = value[index];
		const digit = character === 'X' ? 10 : Number(character);
		sum += digit * (10 - index);
	}
	return sum % 11 === 0;
}

/** @param {unknown} value @param {Record<string, string>} errors */
function isbnField(value, errors) {
	if (value === '') return null;
	if (typeof value !== 'string' || value.length > 32 || value !== value.trim()) {
		errors.isbn = 'Enter a valid ISBN-10 or ISBN-13.';
		return null;
	}
	const normalized = value.replace(/[ -]/gu, '').toUpperCase();
	if (!validIsbn(normalized)) {
		errors.isbn = 'Enter a valid ISBN-10 or ISBN-13.';
		return null;
	}
	return normalized;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {ReadonlySet<string>} approvedHostnames
 * @param {Record<string, string>} errors
 * @param {boolean} optional
 */
function urlField(value, field, approvedHostnames, errors, optional) {
	if (optional && value === '') return null;
	try {
		return normalizeApprovedHttpsUrl(value, approvedHostnames);
	} catch {
		errors[field] = 'Use an approved HTTPS link.';
		return null;
	}
}

/**
 * @param {unknown} resource
 * @param {unknown} mode
 * @param {unknown} input
 * @param {ReadonlySet<string>} approvedHostnames
 */
export function normalizeStaffCatalogueInput(resource, mode, input, approvedHostnames) {
	const definition = resourceDefinition(resource);
	if (
		(mode !== 'create' && mode !== 'update') ||
		input === null ||
		typeof input !== 'object' ||
		Array.isArray(input) ||
		!(approvedHostnames instanceof Set)
	) {
		return invalid();
	}
	const fields = /** @type {string[]} */ (
		mode === 'create' ? definition.createFields : definition.updateFields
	);
	const keys = Object.keys(input);
	if (
		keys.length !== fields.length ||
		keys.some((key) => !fields.includes(key)) ||
		fields.some((field) => !Object.hasOwn(input, field))
	) {
		return invalid();
	}

	const values = /** @type {Record<string, any>} */ (input);
	/** @type {Record<string, string>} */
	const errors = {};
	let normalized;
	if (resource === 'teachers') {
		const slug = textField(values.slug, 120, 'slug', errors);
		if (slug && !SLUG_PATTERN.test(slug)) errors.slug = 'Use lowercase words separated by hyphens.';
		normalized = { slug, name: textField(values.name, 160, 'name', errors) };
	} else if (resource === 'courses') {
		normalized = {
			teacherId: uuidField(values.teacherId, 'teacherId', errors),
			code: textField(values.code, 64, 'code', errors),
			title: textField(values.title, 200, 'title', errors)
		};
	} else if (resource === 'bookstores') {
		const serviceFeeCents = moneyField(values.serviceFee, 'serviceFee', errors);
		if (!errors.serviceFee && (serviceFeeCents < 500 || serviceFeeCents > 700)) {
			errors.serviceFee = 'The service fee must be between $5.00 and $7.00.';
		}
		normalized = {
			name: textField(values.name, 160, 'name', errors),
			serviceFeeCents
		};
	} else if (resource === 'books') {
		normalized = {
			bookstoreId: uuidField(values.bookstoreId, 'bookstoreId', errors),
			title: textField(values.title, 240, 'title', errors),
			author: optionalTextField(values.author, 200, 'author', errors),
			isbn: isbnField(values.isbn, errors),
			retailerUrl: urlField(values.retailerUrl, 'retailerUrl', approvedHostnames, errors, false),
			coverUrl: urlField(values.coverUrl, 'coverUrl', approvedHostnames, errors, true),
			priceCents: moneyField(values.price, 'price', errors)
		};
	} else {
		const position =
			typeof values.position === 'string' && /^(?:0|[1-9]\d{0,3})$/u.test(values.position)
				? Number(values.position)
				: -1;
		if (position < 0) errors.position = 'Use a whole number from 0 through 9999.';
		normalized =
			mode === 'create'
				? {
						courseId: uuidField(values.courseId, 'courseId', errors),
						bookId: uuidField(values.bookId, 'bookId', errors),
						position
					}
				: { position };
	}
	if (Object.keys(errors).length > 0) return invalid(errors);
	return normalized;
}

/** @param {unknown} value */
export function normalizeStaffCatalogueSearch(value) {
	if (typeof value !== 'string') return invalid({ q: 'Search is invalid.' });
	const normalized = value.trim();
	if (
		normalized.length > 100 ||
		normalized.includes('\0') ||
		normalized.includes('\r') ||
		normalized.includes('\n')
	) {
		return invalid({ q: 'Search is invalid.' });
	}
	return normalized;
}

const teacherSelection = {
	id: teachers.id,
	slug: teachers.slug,
	name: teachers.name,
	active: teachers.active,
	version: teachers.version,
	createdAt: teachers.createdAt,
	updatedAt: teachers.updatedAt
};
const courseSelection = {
	id: courses.id,
	teacherId: courses.teacherId,
	code: courses.code,
	title: courses.title,
	active: courses.active,
	version: courses.version,
	createdAt: courses.createdAt,
	updatedAt: courses.updatedAt,
	teacherName: teachers.name,
	teacherActive: teachers.active
};
const bookstoreSelection = {
	id: bookstores.id,
	name: bookstores.name,
	serviceFeeCents: bookstores.serviceFeeCents,
	active: bookstores.active,
	version: bookstores.version,
	createdAt: bookstores.createdAt,
	updatedAt: bookstores.updatedAt
};
const bookSelection = {
	id: books.id,
	bookstoreId: books.bookstoreId,
	title: books.title,
	author: books.author,
	isbn: books.isbn,
	retailerUrl: books.retailerUrl,
	coverUrl: books.coverUrl,
	priceCents: books.priceCents,
	active: books.active,
	version: books.version,
	createdAt: books.createdAt,
	updatedAt: books.updatedAt,
	bookstoreName: bookstores.name,
	bookstoreActive: bookstores.active
};
const assignmentSelection = {
	id: courseBooks.id,
	courseId: courseBooks.courseId,
	bookId: courseBooks.bookId,
	position: courseBooks.position,
	active: courseBooks.active,
	version: courseBooks.version,
	createdAt: courseBooks.createdAt,
	updatedAt: courseBooks.updatedAt,
	courseCode: courses.code,
	courseTitle: courses.title,
	courseActive: courses.active,
	teacherName: teachers.name,
	teacherActive: teachers.active,
	bookTitle: books.title,
	bookActive: books.active,
	bookstoreName: bookstores.name,
	bookstoreActive: bookstores.active
};

/** @param {any} transaction @param {string} resource */
function baseQuery(transaction, resource) {
	if (resource === 'teachers') return transaction.select(teacherSelection).from(teachers);
	if (resource === 'courses') {
		return transaction
			.select(courseSelection)
			.from(courses)
			.innerJoin(teachers, eq(courses.teacherId, teachers.id));
	}
	if (resource === 'bookstores') return transaction.select(bookstoreSelection).from(bookstores);
	if (resource === 'books') {
		return transaction
			.select(bookSelection)
			.from(books)
			.innerJoin(bookstores, eq(books.bookstoreId, bookstores.id));
	}
	return transaction
		.select(assignmentSelection)
		.from(courseBooks)
		.innerJoin(courses, eq(courseBooks.courseId, courses.id))
		.innerJoin(teachers, eq(courses.teacherId, teachers.id))
		.innerJoin(books, eq(courseBooks.bookId, books.id))
		.innerJoin(bookstores, eq(books.bookstoreId, bookstores.id));
}

/** @param {any} transaction @param {string} resource */
function listRows(transaction, resource) {
	const query = baseQuery(transaction, resource);
	if (resource === 'teachers')
		return query.orderBy(asc(teachers.name), asc(teachers.id)).limit(201);
	if (resource === 'courses') return query.orderBy(asc(courses.code), asc(courses.id)).limit(201);
	if (resource === 'bookstores')
		return query.orderBy(asc(bookstores.name), asc(bookstores.id)).limit(201);
	if (resource === 'books') return query.orderBy(asc(books.title), asc(books.id)).limit(201);
	return query.orderBy(asc(courseBooks.position), asc(courseBooks.id)).limit(201);
}

/** @param {any} transaction @param {string} resource @param {string} id @param {boolean} lock */
function oneRow(transaction, resource, id, lock) {
	const definition = resourceDefinition(resource);
	let query = baseQuery(transaction, resource).where(eq(definition.table.id, id)).limit(2);
	if (lock) query = query.for('update');
	return query;
}

/** @param {any} row */
function baseRecord(row) {
	if (
		row === null ||
		typeof row !== 'object' ||
		!UUID_PATTERN.test(row.id) ||
		typeof row.active !== 'boolean' ||
		!Number.isSafeInteger(row.version) ||
		row.version < 1 ||
		!(row.createdAt instanceof Date) ||
		!(row.updatedAt instanceof Date)
	) {
		return unavailable();
	}
	return {
		id: row.id,
		active: row.active,
		version: row.version,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

/** @param {unknown} value @param {number} maximum */
function storedText(value, maximum) {
	if (typeof value !== 'string' || value.length === 0 || value.length > maximum)
		return unavailable();
	return value;
}

/** @param {any} row @param {string} resource @param {ReadonlySet<string>} approvedHostnames */
function recordDto(row, resource, approvedHostnames) {
	const base = baseRecord(row);
	if (resource === 'teachers') {
		return {
			...base,
			slug: storedText(row.slug, 120),
			name: storedText(row.name, 160),
			effectiveActive: row.active,
			blockedBy: []
		};
	}
	if (resource === 'courses') {
		if (!UUID_PATTERN.test(row.teacherId) || typeof row.teacherActive !== 'boolean') unavailable();
		return {
			...base,
			teacherId: row.teacherId,
			teacherName: storedText(row.teacherName, 160),
			code: storedText(row.code, 64),
			title: storedText(row.title, 200),
			effectiveActive: row.active && row.teacherActive,
			blockedBy: row.teacherActive ? [] : ['teacher']
		};
	}
	if (resource === 'bookstores') {
		if (
			!Number.isSafeInteger(row.serviceFeeCents) ||
			row.serviceFeeCents < 500 ||
			row.serviceFeeCents > 700
		)
			unavailable();
		return {
			...base,
			name: storedText(row.name, 160),
			serviceFeeCents: row.serviceFeeCents,
			effectiveActive: row.active,
			blockedBy: []
		};
	}
	if (resource === 'books') {
		if (
			!UUID_PATTERN.test(row.bookstoreId) ||
			typeof row.bookstoreActive !== 'boolean' ||
			!Number.isSafeInteger(row.priceCents) ||
			row.priceCents < 0
		)
			unavailable();
		return {
			...base,
			bookstoreId: row.bookstoreId,
			bookstoreName: storedText(row.bookstoreName, 160),
			title: storedText(row.title, 240),
			author: row.author === null ? null : storedText(row.author, 200),
			isbn: row.isbn === null ? null : storedText(row.isbn, 32),
			retailerUrl: normalizeApprovedHttpsUrl(row.retailerUrl, approvedHostnames),
			coverUrl: normalizeApprovedHttpsUrl(row.coverUrl, approvedHostnames, { optional: true }),
			priceCents: row.priceCents,
			effectiveActive: row.active && row.bookstoreActive,
			blockedBy: row.bookstoreActive ? [] : ['bookstore']
		};
	}
	if (
		!UUID_PATTERN.test(row.courseId) ||
		!UUID_PATTERN.test(row.bookId) ||
		!Number.isSafeInteger(row.position) ||
		row.position < 0 ||
		[row.courseActive, row.teacherActive, row.bookActive, row.bookstoreActive].some(
			(value) => typeof value !== 'boolean'
		)
	)
		unavailable();
	const blockedBy = [];
	if (!row.courseActive) blockedBy.push('course');
	if (!row.teacherActive) blockedBy.push('teacher');
	if (!row.bookActive) blockedBy.push('book');
	if (!row.bookstoreActive) blockedBy.push('bookstore');
	return {
		...base,
		courseId: row.courseId,
		bookId: row.bookId,
		position: row.position,
		courseCode: storedText(row.courseCode, 64),
		courseTitle: storedText(row.courseTitle, 200),
		teacherName: storedText(row.teacherName, 160),
		bookTitle: storedText(row.bookTitle, 240),
		bookstoreName: storedText(row.bookstoreName, 160),
		effectiveActive: row.active && blockedBy.length === 0,
		blockedBy
	};
}

/** @param {any} record @param {string} resource */
function searchableText(record, resource) {
	if (resource === 'teachers') return `${record.slug}\n${record.name}`;
	if (resource === 'courses') return `${record.code}\n${record.title}\n${record.teacherName}`;
	if (resource === 'bookstores') return record.name;
	if (resource === 'books') {
		return `${record.title}\n${record.author ?? ''}\n${record.isbn ?? ''}\n${record.bookstoreName}`;
	}
	return `${record.courseCode}\n${record.courseTitle}\n${record.teacherName}\n${record.bookTitle}\n${record.bookstoreName}`;
}

/** @param {unknown} id */
function validId(id) {
	if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return invalid();
	return id;
}

/** @param {unknown} version */
function validVersion(version) {
	if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1)
		return invalid();
	return version;
}

/** @param {unknown} actor */
function validActor(actor) {
	if (
		actor === null ||
		typeof actor !== 'object' ||
		Array.isArray(actor) ||
		typeof (/** @type {any} */ (actor).userId) !== 'string' ||
		/** @type {any} */ (actor).userId.length === 0 ||
		/** @type {any} */ (actor).userId.length > 255 ||
		/** @type {any} */ (actor).email !== STAFF_EMAIL ||
		typeof (/** @type {any} */ (actor).requestId) !== 'string' ||
		!UUID_PATTERN.test(/** @type {any} */ (actor).requestId)
	) {
		return invalid();
	}
	return /** @type {{ userId: string, email: string, requestId: string }} */ (actor);
}

/** @param {unknown} approvedHostnames */
function approvedHostSet(approvedHostnames) {
	if (
		!Array.isArray(approvedHostnames) ||
		approvedHostnames.length === 0 ||
		approvedHostnames.length > 32 ||
		new Set(approvedHostnames).size !== approvedHostnames.length
	) {
		return unavailable();
	}
	const set = new Set(approvedHostnames);
	try {
		for (const hostname of approvedHostnames) {
			normalizeApprovedHttpsUrl(`https://${hostname}/`, set);
		}
	} catch {
		return unavailable();
	}
	return set;
}

/** @param {unknown} error */
function databaseErrorCode(error) {
	if (!(error instanceof Error)) return null;
	const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
	return descriptor && typeof descriptor.value === 'string' ? descriptor.value : null;
}

/** @template T @param {() => Promise<T>} operation */
async function sanitized(operation) {
	try {
		return await operation();
	} catch (error) {
		if (
			error instanceof StaffCatalogueValidationError ||
			error instanceof StaffCatalogueConflictError ||
			error instanceof StaffCatalogueUnavailableError
		)
			throw error;
		if (['23503', '23505'].includes(databaseErrorCode(error) ?? '')) return invalid();
		return unavailable();
	}
}

/** @param {any} transaction @param {any} table @param {string} id @param {string} field */
async function requireRelationship(transaction, table, id, field) {
	const rows = await transaction
		.select({ id: table.id })
		.from(table)
		.where(eq(table.id, id))
		.limit(2)
		.for('key share');
	if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.id !== id) {
		return invalid({ [field]: 'The selected entry no longer exists.' });
	}
}

/** @param {any} transaction @param {string} resource @param {Record<string, any>} values */
async function requireRelationships(transaction, resource, values) {
	if (resource === 'courses') {
		await requireRelationship(transaction, teachers, values.teacherId, 'teacherId');
	} else if (resource === 'books') {
		await requireRelationship(transaction, bookstores, values.bookstoreId, 'bookstoreId');
	} else if (resource === 'assignments') {
		await requireRelationship(transaction, courses, values.courseId, 'courseId');
		await requireRelationship(transaction, books, values.bookId, 'bookId');
	}
}

/** @param {Record<string, any>} previous @param {Record<string, any>} next */
function changedFields(previous, next) {
	return Object.keys(next)
		.filter((field) => previous[field] !== next[field])
		.sort();
}

/**
 * @param {any} transaction
 * @param {{ definition: any, resourceId: string, action: string, actor: any, previousState: any, nextState: any }} entry
 */
async function appendAudit(transaction, entry) {
	await transaction.insert(auditLog).values({
		orderId: null,
		resourceType: entry.definition.type,
		resourceId: entry.resourceId,
		actorKind: 'staff',
		staffUserId: entry.actor.userId,
		staffIdentity: entry.actor.email,
		action: entry.action,
		previousState: entry.previousState,
		nextState: entry.nextState,
		requestId: entry.actor.requestId,
		providerEventId: null
	});
}

/**
 * @param {{ databaseUrl: string, approvedHostnames: string[], runTransaction?: typeof withDatabaseTransaction, getNow?: () => Date }} configuration
 */
export function createStaffCatalogueRepository({
	databaseUrl,
	approvedHostnames,
	runTransaction = withDatabaseTransaction,
	getNow = () => new Date()
}) {
	if (
		typeof databaseUrl !== 'string' ||
		databaseUrl.length === 0 ||
		databaseUrl !== databaseUrl.trim() ||
		typeof runTransaction !== 'function' ||
		typeof getNow !== 'function'
	)
		return unavailable();
	const hosts = approvedHostSet(approvedHostnames);
	const transact = (/** @type {any} */ operation) => runTransaction(operation, { databaseUrl });

	return Object.freeze({
		/** @param {string} resource @param {unknown} search */
		async listStaffCatalogue(resource, search) {
			resourceDefinition(resource);
			const normalizedSearch = normalizeStaffCatalogueSearch(search);
			return sanitized(async () => {
				const rows = await transact((/** @type {any} */ transaction) =>
					listRows(transaction, resource)
				);
				if (!Array.isArray(rows) || rows.length > MAX_STAFF_RECORDS) unavailable();
				const records = rows.map((row) => recordDto(row, resource, hosts));
				const needle = normalizedSearch.toLowerCase();
				return {
					records: needle
						? records.filter((record) =>
								searchableText(record, resource).toLowerCase().includes(needle)
							)
						: records,
					totalCount: records.length
				};
			});
		},

		/** @param {string} resource @param {unknown} id */
		async getStaffCatalogueRecord(resource, id) {
			resourceDefinition(resource);
			const recordId = validId(id);
			return sanitized(async () => {
				const rows = await transact((/** @type {any} */ transaction) =>
					oneRow(transaction, resource, recordId, false)
				);
				if (!Array.isArray(rows) || rows.length > 1) unavailable();
				return rows.length === 0 ? null : recordDto(rows[0], resource, hosts);
			});
		},

		/** @param {string} resource @param {unknown} input @param {unknown} actor */
		async createStaffCatalogueRecord(resource, input, actor) {
			const definition = resourceDefinition(resource);
			const normalized = normalizeStaffCatalogueInput(resource, 'create', input, hosts);
			const staffActor = validActor(actor);
			return sanitized(() =>
				transact(async (/** @type {any} */ transaction) => {
					await requireRelationships(transaction, resource, normalized);
					const rows = await transaction
						.insert(definition.table)
						.values({ ...normalized, active: true, version: 1 })
						.returning();
					const created = rows?.[0];
					if (
						!created ||
						!UUID_PATTERN.test(created.id) ||
						created.version !== 1 ||
						created.active !== true
					)
						unavailable();
					const fields = Object.keys(normalized).sort();
					await appendAudit(transaction, {
						definition,
						resourceId: created.id,
						action: `catalogue.${definition.type}.created`,
						actor: staffActor,
						previousState: null,
						nextState: { active: true, version: 1, changedFields: fields }
					});
					return { id: created.id, active: true, version: 1 };
				})
			);
		},

		/** @param {string} resource @param {unknown} id @param {unknown} version @param {unknown} input @param {unknown} actor */
		async updateStaffCatalogueRecord(resource, id, version, input, actor) {
			const definition = resourceDefinition(resource);
			const recordId = validId(id);
			const expectedVersion = validVersion(version);
			const normalized = normalizeStaffCatalogueInput(resource, 'update', input, hosts);
			const staffActor = validActor(actor);
			return sanitized(() =>
				transact(async (/** @type {any} */ transaction) => {
					const rows = await oneRow(transaction, resource, recordId, true);
					if (!Array.isArray(rows) || rows.length !== 1) conflict();
					const current = recordDto(rows[0], resource, hosts);
					if (current.version !== expectedVersion) conflict();
					const fields = changedFields(current, normalized);
					if (fields.length === 0) invalid({ _form: 'There are no changes to save.' });
					await requireRelationships(transaction, resource, {
						...current,
						...normalized
					});
					const nextVersion = current.version + 1;
					const updatedRows = await transaction
						.update(definition.table)
						.set({ ...normalized, version: nextVersion, updatedAt: getNow() })
						.where(
							and(eq(definition.table.id, recordId), eq(definition.table.version, expectedVersion))
						)
						.returning();
					const updated = updatedRows?.[0];
					if (!updated || updated.id !== recordId || updated.version !== nextVersion) conflict();
					await appendAudit(transaction, {
						definition,
						resourceId: recordId,
						action: `catalogue.${definition.type}.updated`,
						actor: staffActor,
						previousState: { active: current.active, version: current.version },
						nextState: {
							active: current.active,
							version: nextVersion,
							changedFields: fields
						}
					});
					return { id: recordId, active: current.active, version: nextVersion };
				})
			);
		},

		/** @param {string} resource @param {unknown} id @param {unknown} version @param {unknown} active @param {unknown} actor */
		async setStaffCatalogueRecordActive(resource, id, version, active, actor) {
			const definition = resourceDefinition(resource);
			const recordId = validId(id);
			const expectedVersion = validVersion(version);
			if (typeof active !== 'boolean') return invalid();
			const staffActor = validActor(actor);
			return sanitized(() =>
				transact(async (/** @type {any} */ transaction) => {
					const rows = await oneRow(transaction, resource, recordId, true);
					if (!Array.isArray(rows) || rows.length !== 1) conflict();
					const current = recordDto(rows[0], resource, hosts);
					if (current.version !== expectedVersion) conflict();
					if (current.active === active) invalid({ _form: 'This entry is already in that state.' });
					const nextVersion = current.version + 1;
					const updatedRows = await transaction
						.update(definition.table)
						.set({ active, version: nextVersion, updatedAt: getNow() })
						.where(
							and(eq(definition.table.id, recordId), eq(definition.table.version, expectedVersion))
						)
						.returning();
					const updated = updatedRows?.[0];
					if (
						!updated ||
						updated.id !== recordId ||
						updated.version !== nextVersion ||
						updated.active !== active
					)
						conflict();
					await appendAudit(transaction, {
						definition,
						resourceId: recordId,
						action: `catalogue.${definition.type}.${active ? 'activated' : 'deactivated'}`,
						actor: staffActor,
						previousState: { active: current.active, version: current.version },
						nextState: { active, version: nextVersion, changedFields: ['active'] }
					});
					return { id: recordId, active, version: nextVersion };
				})
			);
		}
	});
}
