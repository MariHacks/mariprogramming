// @vitest-environment node

import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
	CHECKOUT_CAPABILITY_LIFETIME_MS,
	CheckoutRequestError,
	createConfirmationCapability,
	createCheckoutIdentifiers,
	fingerprintCheckoutRequest,
	hashConfirmationCapability,
	normalizeCheckoutRequest,
	verifyConfirmationCapabilityHash
} from './request.js';

const INTEGRITY_KEY = 'checkout-capability-secret-kept-separate-1234567890';
const REQUEST_ID = `ckr1_${Buffer.alloc(32, 1).toString('base64url')}`;
const OTHER_REQUEST_ID = `ckr1_${Buffer.alloc(32, 2).toString('base64url')}`;
const COURSE_ID = '22222222-2222-4222-8222-222222222222';
const BOOK_A = '33333333-3333-4333-8333-333333333333';
const BOOK_B = '44444444-4444-4444-8444-444444444444';

function validRequest(overrides = {}) {
	return {
		requestId: REQUEST_ID,
		name: '  Ada   Lovelace  ',
		email: '  ADA@EXAMPLE.COM  ',
		courses: [
			{
				teacherSlug: 'prof-y-boulanger',
				courseId: COURSE_ID,
				items: [
					{ bookId: BOOK_B, quantity: 2 },
					{ bookId: BOOK_A, quantity: 1 }
				]
			}
		],
		...overrides
	};
}

describe('canonical guest checkout request', () => {
	it('normalizes contact, sorts unique selections, and creates a stable keyed fingerprint without the request ID', () => {
		const canonical = normalizeCheckoutRequest(validRequest());

		expect(canonical).toEqual({
			version: 1,
			clientRequestId: REQUEST_ID,
			customerName: 'Ada Lovelace',
			customerEmail: 'ada@example.com',
			courses: [
				{
					teacherSlug: 'prof-y-boulanger',
					courseId: COURSE_ID,
					selections: [
						{ bookId: BOOK_A, quantity: 1 },
						{ bookId: BOOK_B, quantity: 2 }
					]
				}
			]
		});
		expect(Object.isFrozen(canonical)).toBe(true);
		expect(Object.isFrozen(canonical.courses)).toBe(true);
		expect(Object.isFrozen(canonical.courses[0])).toBe(true);
		expect(Object.isFrozen(canonical.courses[0].selections)).toBe(true);
		expect(Object.isFrozen(canonical.courses[0].selections[0])).toBe(true);
		expect(/** @type {any} */ (canonical).requestFingerprint).toBeUndefined();

		const equivalent = normalizeCheckoutRequest({
			...validRequest(),
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			courses: [
				{
					...validRequest().courses[0],
					items: [...validRequest().courses[0].items].reverse()
				}
			]
		});
		expect(equivalent).toEqual(canonical);
		const fingerprint = fingerprintCheckoutRequest(canonical, { integrityKey: INTEGRITY_KEY });
		expect(fingerprint).toMatch(/^[0-9a-f]{64}$/u);
		expect(fingerprintCheckoutRequest(equivalent, { integrityKey: INTEGRITY_KEY })).toBe(
			fingerprint
		);
		expect(
			fingerprintCheckoutRequest(
				normalizeCheckoutRequest({ ...validRequest(), requestId: OTHER_REQUEST_ID }),
				{ integrityKey: INTEGRITY_KEY }
			)
		).toBe(fingerprint);
		const canonicalIntent = {
			version: canonical.version,
			customerName: canonical.customerName,
			customerEmail: canonical.customerEmail,
			courses: canonical.courses
		};
		expect(fingerprint).toBe(
			createHmac('sha256', INTEGRITY_KEY)
				.update(`checkout-request-fingerprint\0v1\0${JSON.stringify(canonicalIntent)}`)
				.digest('hex')
		);
	});

	it.each([undefined, 'short', ` ${INTEGRITY_KEY}`])(
		'fails closed when the request fingerprint key is invalid (%#)',
		(integrityKey) => {
			const canonical = normalizeCheckoutRequest(validRequest());
			expect(() => fingerprintCheckoutRequest(canonical, { integrityKey })).toThrow(
				CheckoutRequestError
			);
		}
	);

	it.each([
		['a non-object request', null],
		['an array request', []],
		[
			'a missing field',
			(() => {
				const request = /** @type {any} */ (validRequest());
				delete request.email;
				return request;
			})()
		],
		['an unknown field', { ...validRequest(), totalCents: 1 }],
		[
			'an unprefixed request ID',
			{ ...validRequest(), requestId: Buffer.alloc(32, 1).toString('base64url') }
		],
		['a short request ID', { ...validRequest(), requestId: 'ckr1_short' }],
		['a padded request ID', { ...validRequest(), requestId: `${REQUEST_ID}=` }],
		[
			'a malformed teacher slug',
			{ ...validRequest(), courses: [{ ...validRequest().courses[0], teacherSlug: '../teacher' }] }
		],
		[
			'an oversized teacher slug',
			{
				...validRequest(),
				courses: [{ ...validRequest().courses[0], teacherSlug: 'a'.repeat(121) }]
			}
		],
		[
			'a malformed course ID',
			{ ...validRequest(), courses: [{ ...validRequest().courses[0], courseId: 'course-1' }] }
		],
		['an empty name', { ...validRequest(), name: '   ' }],
		['an oversized name', { ...validRequest(), name: 'a'.repeat(121) }],
		['a controlled name', { ...validRequest(), name: 'Ada\u0007Lovelace' }],
		['a malformed email', { ...validRequest(), email: 'not-an-email' }],
		['an oversized email', { ...validRequest(), email: `${'a'.repeat(250)}@example.com` }],
		['no courses', { ...validRequest(), courses: [] }],
		['a non-object course', { ...validRequest(), courses: [null] }],
		[
			'an unknown course field',
			{ ...validRequest(), courses: [{ ...validRequest().courses[0], priceCents: 1 }] }
		],
		['no books', { ...validRequest(), courses: [{ ...validRequest().courses[0], items: [] }] }],
		[
			'too many books',
			{
				...validRequest(),
				courses: [
					{
						...validRequest().courses[0],
						items: Array.from({ length: 26 }, (_, index) => ({
							bookId: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
							quantity: 1
						}))
					}
				]
			}
		],
		[
			'a non-object book',
			{ ...validRequest(), courses: [{ ...validRequest().courses[0], items: [null] }] }
		],
		[
			'an unknown book field',
			{
				...validRequest(),
				courses: [
					{ ...validRequest().courses[0], items: [{ bookId: BOOK_A, quantity: 1, priceCents: 1 }] }
				]
			}
		],
		[
			'a malformed book ID',
			{
				...validRequest(),
				courses: [{ ...validRequest().courses[0], items: [{ bookId: 'book-a', quantity: 1 }] }]
			}
		],
		[
			'a zero quantity',
			{
				...validRequest(),
				courses: [{ ...validRequest().courses[0], items: [{ bookId: BOOK_A, quantity: 0 }] }]
			}
		],
		[
			'an excessive quantity',
			{
				...validRequest(),
				courses: [{ ...validRequest().courses[0], items: [{ bookId: BOOK_A, quantity: 11 }] }]
			}
		],
		[
			'a fractional quantity',
			{
				...validRequest(),
				courses: [{ ...validRequest().courses[0], items: [{ bookId: BOOK_A, quantity: 1.5 }] }]
			}
		],
		[
			'a duplicated book',
			{
				...validRequest(),
				courses: [
					{
						...validRequest().courses[0],
						items: [
							{ bookId: BOOK_A, quantity: 1 },
							{ bookId: BOOK_A, quantity: 2 }
						]
					}
				]
			}
		],
		[
			'more than 25 books across courses',
			{
				...validRequest(),
				courses: Array.from({ length: 13 }, (_, courseIndex) => ({
					teacherSlug: `prof-${courseIndex}`,
					courseId: `${String(courseIndex + 1).padStart(8, '0')}-0000-4000-8000-000000000000`,
					items: [
						{
							bookId: `${String(courseIndex * 2 + 1).padStart(8, '0')}-0000-4000-8000-000000000000`,
							quantity: 1
						},
						{
							bookId: `${String(courseIndex * 2 + 2).padStart(8, '0')}-0000-4000-8000-000000000000`,
							quantity: 1
						}
					]
				}))
			}
		],
		[
			'more than 99 total copies',
			{
				...validRequest(),
				courses: [
					{
						...validRequest().courses[0],
						items: Array.from({ length: 10 }, (_, index) => ({
							bookId: `${String(index + 1).padStart(8, '0')}-0000-4000-8000-000000000000`,
							quantity: 10
						}))
					}
				]
			}
		],
		[
			'a duplicated course',
			{ ...validRequest(), courses: [validRequest().courses[0], validRequest().courses[0]] }
		],
		['an uppercase request ID', { ...validRequest(), requestId: REQUEST_ID.toUpperCase() }]
	])('rejects %s before any trusted lookup', (_label, request) => {
		expect(() => normalizeCheckoutRequest(request)).toThrow(CheckoutRequestError);
	});

	it('keeps the same assigned book distinct when it is selected for two courses', () => {
		const canonical = normalizeCheckoutRequest({
			...validRequest(),
			courses: [
				{ ...validRequest().courses[0], items: [{ bookId: BOOK_A, quantity: 1 }] },
				{
					teacherSlug: 'prof-other',
					courseId: '55555555-5555-4555-8555-555555555555',
					items: [{ bookId: BOOK_A, quantity: 1 }]
				}
			]
		});

		expect(canonical.courses).toHaveLength(2);
		expect(canonical.courses.flatMap(({ selections }) => selections)).toHaveLength(2);
	});
});

describe('checkout identifiers and confirmation capability', () => {
	it('generates random internal IDs, a stable provider key, a human reference, and only a capability hash for storage', () => {
		const randomUUID = vi
			.fn()
			.mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
			.mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
		const randomBytes = vi.fn((length) => {
			expect(length).toBe(32);
			return Buffer.alloc(32, 7);
		});
		const now = new Date('2026-08-13T18:00:00.000Z');

		const generated = createCheckoutIdentifiers({
			randomUUID,
			randomBytes,
			now,
			capabilityKey: 'checkout-capability-secret-kept-separate-1234567890'
		});

		expect(generated).toMatchObject({
			orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			attemptId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
			stripeIdempotencyKey: 'mpc-book-checkout-v1:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
		});
		expect(generated.publicReference).toMatch(/^MPC-[A-HJ-NP-Z2-9]{12}$/u);
		expect(generated.confirmationCapability).toMatch(/^[A-Za-z0-9_-]{43}$/u);
		expect(generated.confirmationTokenHash).toBe(
			createHash('sha256')
				.update(`confirmation-capability-hash\0v1\0${generated.confirmationCapability}`)
				.digest('hex')
		);
		expect(generated.confirmationExpiresAt.toISOString()).toBe(
			new Date(now.getTime() + CHECKOUT_CAPABILITY_LIFETIME_MS).toISOString()
		);
		expect(Object.keys(generated)).not.toContain('confirmationToken');
		expect(Object.isFrozen(generated)).toBe(true);
	});

	it('re-derives the same 256-bit capability from the dedicated secret and stable order identity', () => {
		const capabilityKey = 'checkout-capability-secret-kept-separate-1234567890';
		const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
		const attemptId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
		const first = createConfirmationCapability({ capabilityKey, orderId, attemptId });
		const retry = createConfirmationCapability({ capabilityKey, orderId, attemptId });

		expect(first).toBe(retry);
		expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/u);
		expect(
			createConfirmationCapability({
				capabilityKey,
				orderId,
				attemptId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
			})
		).not.toBe(first);
	});

	it.each([
		[
			'a short capability key',
			{
				capabilityKey: 'short',
				orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				attemptId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
			}
		],
		[
			'a padded capability key',
			{
				capabilityKey: ' capability-secret-kept-separate-1234567890',
				orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				attemptId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
			}
		],
		[
			'a malformed order ID',
			{
				capabilityKey: 'capability-secret-kept-separate-1234567890',
				orderId: 'not-an-id',
				attemptId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
			}
		],
		[
			'a malformed attempt ID',
			{
				capabilityKey: 'capability-secret-kept-separate-1234567890',
				orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				attemptId: 'not-an-id'
			}
		]
	])('rejects %s before deriving a capability', (_label, input) => {
		expect(() => createConfirmationCapability(input)).toThrow(CheckoutRequestError);
	});

	it('hashes only an exact 256-bit base64url capability', () => {
		const capability = Buffer.alloc(32, 19).toString('base64url');
		const hash = createHash('sha256')
			.update(`confirmation-capability-hash\0v1\0${capability}`)
			.digest('hex');
		expect(hashConfirmationCapability(capability)).toBe(hash);
		expect(verifyConfirmationCapabilityHash(capability, hash)).toBe(true);
		expect(verifyConfirmationCapabilityHash(Buffer.alloc(32, 20).toString('base64url'), hash)).toBe(
			false
		);
		for (const invalid of ['', 'short', `${capability}=`, ` ${capability}`, null]) {
			expect(() => hashConfirmationCapability(invalid)).toThrow(CheckoutRequestError);
		}
		for (const invalidHash of ['', '0'.repeat(63), 'G'.repeat(64), null]) {
			expect(() => verifyConfirmationCapabilityHash(capability, invalidHash)).toThrow(
				CheckoutRequestError
			);
		}
	});

	it.each([
		[
			'a bad clock',
			{
				now: new Date('invalid'),
				capabilityKey: 'checkout-capability-secret-kept-separate-1234567890'
			}
		],
		[
			'a malformed order UUID',
			{
				randomUUID: vi.fn(() => 'not-a-uuid'),
				capabilityKey: 'checkout-capability-secret-kept-separate-1234567890'
			}
		],
		[
			'short random bytes',
			{
				randomBytes: vi.fn(() => Buffer.alloc(31)),
				capabilityKey: 'checkout-capability-secret-kept-separate-1234567890'
			}
		],
		[
			'non-buffer random bytes',
			{
				randomBytes: vi.fn(() => new Uint8Array(32)),
				capabilityKey: 'checkout-capability-secret-kept-separate-1234567890'
			}
		],
		['a missing capability key', {}]
	])('fails closed for %s', (_label, overrides) => {
		expect(() => createCheckoutIdentifiers(/** @type {any} */ (overrides))).toThrow(
			CheckoutRequestError
		);
	});
});
