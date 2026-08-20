import {
	createHash,
	createHmac,
	randomBytes as nodeRandomBytes,
	randomUUID as nodeRandomUUID,
	timingSafeEqual
} from 'node:crypto';

const CHECKOUT_REQUEST_FIELDS = ['courses', 'email', 'name', 'requestId'];
const CHECKOUT_COURSE_FIELDS = ['courseId', 'items', 'teacherSlug'];
const CHECKOUT_ITEM_FIELDS = ['bookId', 'quantity'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REQUEST_ID_PATTERN = /^ckr1_[A-Za-z0-9_-]{43}$/u;
const TEACHER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const EMAIL_PATTERN =
	/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/iu;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const PUBLIC_REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_SELECTIONS = 25;
const MAX_COURSES = 25;
const MAX_QUANTITY = 10;
const MAX_TOTAL_QUANTITY = 99;

export const CHECKOUT_CAPABILITY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export class CheckoutRequestError extends Error {
	constructor() {
		super('Checkout request is invalid');
		this.name = 'CheckoutRequestError';
		this.code = 'CHECKOUT_REQUEST_INVALID';
	}
}

/** @returns {never} */
function invalidRequest() {
	throw new CheckoutRequestError();
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	);
}

/** @param {Record<string, unknown>} value @param {string[]} fields */
function requireExactFields(value, fields) {
	const keys = Object.keys(value);
	if (
		keys.length !== fields.length ||
		fields.some((field) => !Object.prototype.hasOwnProperty.call(value, field)) ||
		keys.some((field) => !fields.includes(field))
	) {
		invalidRequest();
	}
}

/** @param {unknown} value @param {number} maximum */
function boundedTrimmedString(value, maximum) {
	if (typeof value !== 'string' || value.length === 0 || value.length > maximum) invalidRequest();
	const normalized = value.trim();
	if (!normalized || /\p{Cc}/u.test(normalized)) {
		invalidRequest();
	}
	return normalized;
}

/** @param {unknown} value */
function normalizeEmail(value) {
	const email = boundedTrimmedString(value, 254).toLowerCase();
	const [localPart] = email.split('@');
	if (
		!EMAIL_PATTERN.test(email) ||
		localPart.startsWith('.') ||
		localPart.endsWith('.') ||
		localPart.includes('..')
	) {
		invalidRequest();
	}
	return email;
}

/** @param {unknown} value */
function normalizeName(value) {
	return boundedTrimmedString(value, 120).replace(/\s+/gu, ' ');
}

/** @param {unknown} value */
function normalizeSelections(value) {
	if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SELECTIONS) {
		invalidRequest();
	}
	const selections = value.map((selection) => {
		if (!isPlainObject(selection)) invalidRequest();
		requireExactFields(selection, CHECKOUT_ITEM_FIELDS);
		if (
			typeof selection.bookId !== 'string' ||
			!UUID_PATTERN.test(selection.bookId) ||
			!Number.isSafeInteger(selection.quantity) ||
			/** @type {number} */ (selection.quantity) < 1 ||
			/** @type {number} */ (selection.quantity) > MAX_QUANTITY
		) {
			invalidRequest();
		}
		return Object.freeze({
			bookId: selection.bookId,
			quantity: /** @type {number} */ (selection.quantity)
		});
	});
	selections.sort((left, right) => left.bookId.localeCompare(right.bookId));
	if (new Set(selections.map(({ bookId }) => bookId)).size !== selections.length) invalidRequest();
	return Object.freeze(selections);
}

/** @param {unknown} value */
function normalizeCourses(value) {
	if (!Array.isArray(value) || value.length === 0 || value.length > MAX_COURSES) invalidRequest();
	const courses = value.map((course) => {
		if (!isPlainObject(course)) invalidRequest();
		requireExactFields(course, CHECKOUT_COURSE_FIELDS);
		if (
			typeof course.teacherSlug !== 'string' ||
			course.teacherSlug.length > 120 ||
			!TEACHER_SLUG_PATTERN.test(course.teacherSlug) ||
			typeof course.courseId !== 'string' ||
			!UUID_PATTERN.test(course.courseId)
		) {
			invalidRequest();
		}
		const selections = normalizeSelections(course.items);
		return Object.freeze({
			teacherSlug: course.teacherSlug,
			courseId: course.courseId,
			selections
		});
	});
	courses.sort(
		(left, right) =>
			left.courseId.localeCompare(right.courseId) ||
			left.teacherSlug.localeCompare(right.teacherSlug)
	);
	if (new Set(courses.map(({ courseId }) => courseId)).size !== courses.length) invalidRequest();
	const allSelections = courses.flatMap(({ selections }) => selections);
	if (
		allSelections.length > MAX_SELECTIONS ||
		allSelections.reduce((total, { quantity }) => total + quantity, 0) > MAX_TOTAL_QUANTITY
	) {
		invalidRequest();
	}
	return Object.freeze(courses);
}

/**
 * @param {unknown} value
 */
export function normalizeCheckoutRequest(value) {
	if (!isPlainObject(value)) invalidRequest();
	requireExactFields(value, CHECKOUT_REQUEST_FIELDS);
	if (typeof value.requestId !== 'string' || !REQUEST_ID_PATTERN.test(value.requestId)) {
		invalidRequest();
	}
	return Object.freeze({
		version: 1,
		clientRequestId: value.requestId,
		customerName: normalizeName(value.name),
		customerEmail: normalizeEmail(value.email),
		courses: normalizeCourses(value.courses)
	});
}

/**
 * The request ID routes retries but is deliberately excluded from the intent fingerprint. A
 * keyed digest keeps retained fingerprints from becoming an offline name/email dictionary.
 *
 * @param {ReturnType<typeof normalizeCheckoutRequest>} canonicalRequest
 * @param {{ integrityKey: unknown }} options
 */
export function fingerprintCheckoutRequest(canonicalRequest, { integrityKey }) {
	if (
		typeof integrityKey !== 'string' ||
		integrityKey.length < 32 ||
		integrityKey.length > 2048 ||
		integrityKey !== integrityKey.trim() ||
		!isPlainObject(canonicalRequest) ||
		canonicalRequest.version !== 1 ||
		typeof canonicalRequest.clientRequestId !== 'string' ||
		!REQUEST_ID_PATTERN.test(canonicalRequest.clientRequestId)
	) {
		invalidRequest();
	}
	const canonicalIntent = {
		version: canonicalRequest.version,
		customerName: canonicalRequest.customerName,
		customerEmail: canonicalRequest.customerEmail,
		courses: canonicalRequest.courses
	};
	return createHmac('sha256', integrityKey)
		.update(`checkout-request-fingerprint\0v1\0${JSON.stringify(canonicalIntent)}`)
		.digest('hex');
}

/** @param {unknown} value */
export function hashConfirmationCapability(value) {
	if (typeof value !== 'string' || !CAPABILITY_PATTERN.test(value)) invalidRequest();
	return createHash('sha256').update(`confirmation-capability-hash\0v1\0${value}`).digest('hex');
}

/** @param {unknown} capability @param {unknown} expectedHash */
export function verifyConfirmationCapabilityHash(capability, expectedHash) {
	if (typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/u.test(expectedHash)) {
		invalidRequest();
	}
	const actual = Buffer.from(hashConfirmationCapability(capability), 'hex');
	return timingSafeEqual(actual, Buffer.from(expectedHash, 'hex'));
}

/**
 * The plaintext capability must be reissuable after a committed response is lost while the
 * database still stores only its hash. A dedicated secret-keyed PRF makes retries deterministic
 * without using any authentication, rate-limit, cron, or provider secret.
 *
 * @param {{ capabilityKey: unknown, orderId: unknown, attemptId: unknown }} input
 */
export function createConfirmationCapability({ capabilityKey, orderId, attemptId }) {
	if (
		typeof capabilityKey !== 'string' ||
		capabilityKey.length < 32 ||
		capabilityKey.length > 2048 ||
		capabilityKey !== capabilityKey.trim() ||
		typeof orderId !== 'string' ||
		!UUID_V4_PATTERN.test(orderId) ||
		typeof attemptId !== 'string' ||
		!UUID_V4_PATTERN.test(attemptId)
	) {
		invalidRequest();
	}
	return createHmac('sha256', capabilityKey)
		.update(`confirmation-capability\0v1\0${orderId}\0${attemptId}`)
		.digest('base64url');
}

/** @param {Buffer} entropy */
function publicReference(entropy) {
	let reference = 'MPC-';
	for (let index = 0; index < 12; index += 1) {
		reference += PUBLIC_REFERENCE_ALPHABET[entropy[index] % PUBLIC_REFERENCE_ALPHABET.length];
	}
	return reference;
}

/**
 * @param {{
 *   randomUUID?: () => string,
 *   randomBytes?: (length: number) => Buffer,
 *   now?: Date,
 *   capabilityKey?: unknown
 * }} [options]
 */
export function createCheckoutIdentifiers({
	randomUUID = nodeRandomUUID,
	randomBytes = nodeRandomBytes,
	now = new Date(),
	capabilityKey
} = {}) {
	const orderId = randomUUID();
	const attemptId = randomUUID();
	const entropy = randomBytes(32);
	if (
		!UUID_V4_PATTERN.test(orderId) ||
		!UUID_V4_PATTERN.test(attemptId) ||
		!Buffer.isBuffer(entropy) ||
		entropy.length !== 32 ||
		!(now instanceof Date) ||
		!Number.isFinite(now.getTime())
	) {
		invalidRequest();
	}
	const confirmationCapability = createConfirmationCapability({
		capabilityKey,
		orderId,
		attemptId
	});
	return Object.freeze({
		orderId,
		attemptId,
		publicReference: publicReference(entropy),
		stripeIdempotencyKey: `mpc-book-checkout-v1:${attemptId}`,
		confirmationCapability,
		confirmationTokenHash: hashConfirmationCapability(confirmationCapability),
		confirmationExpiresAt: new Date(now.getTime() + CHECKOUT_CAPABILITY_LIFETIME_MS)
	});
}
