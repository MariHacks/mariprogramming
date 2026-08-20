import { describe, expect, it, vi } from 'vitest';
import {
	CHECKOUT_REQUEST_STORAGE_KEY,
	getOrCreateCheckoutRequestId,
	retireCheckoutRequestId
} from './checkout-request.js';

const REQUEST_ID = `ckr1_${Buffer.alloc(32, 1).toString('base64url')}`;
const NEXT_REQUEST_ID = `ckr1_${Buffer.alloc(32, 2).toString('base64url')}`;

/** @param {number} byte */
function randomSource(byte) {
	return {
		getRandomValues: vi.fn((target) => {
			expect(target).toBeInstanceOf(Uint8Array);
			expect(target).toHaveLength(32);
			target.fill(byte);
			return target;
		})
	};
}

/** @param {string | null} [initialValue] */
function memoryStorage(initialValue = null) {
	let value = initialValue;
	return {
		getItem: vi.fn(() => value),
		setItem: vi.fn((_key, next) => {
			value = next;
		}),
		removeItem: vi.fn(() => {
			value = null;
		})
	};
}

describe('browser checkout request ID', () => {
	it('reuses one persisted random ID across retries without storing checkout data', () => {
		const storage = memoryStorage();
		const crypto = randomSource(1);

		expect(getOrCreateCheckoutRequestId({ storage, crypto })).toBe(REQUEST_ID);
		expect(getOrCreateCheckoutRequestId({ storage, crypto })).toBe(REQUEST_ID);
		expect(crypto.getRandomValues).toHaveBeenCalledOnce();
		expect(storage.setItem).toHaveBeenCalledOnce();
		expect(storage.setItem).toHaveBeenCalledWith(
			CHECKOUT_REQUEST_STORAGE_KEY,
			JSON.stringify({ v: 1, id: REQUEST_ID })
		);
		expect(JSON.stringify(storage)).not.toContain('email');
	});

	it.each([
		null,
		'',
		'not-json',
		JSON.stringify({ v: 2, id: REQUEST_ID }),
		JSON.stringify({ v: 1, id: 'ckr1_short' }),
		JSON.stringify({ v: 1, id: REQUEST_ID, email: 'ada@example.com' })
	])('replaces malformed persisted value %#', (persisted) => {
		const storage = memoryStorage(persisted);
		expect(getOrCreateCheckoutRequestId({ storage, crypto: randomSource(2) })).toBe(
			NEXT_REQUEST_ID
		);
		expect(storage.setItem).toHaveBeenCalledWith(
			CHECKOUT_REQUEST_STORAGE_KEY,
			JSON.stringify({ v: 1, id: NEXT_REQUEST_ID })
		);
	});

	it('still returns one strong in-memory ID when session storage is unavailable', () => {
		const storage = {
			getItem: vi.fn(() => {
				throw new Error('storage blocked');
			}),
			setItem: vi.fn(() => {
				throw new Error('storage blocked');
			})
		};

		expect(getOrCreateCheckoutRequestId({ storage, crypto: randomSource(1) })).toBe(REQUEST_ID);
	});

	it.each([
		['a missing storage', { storage: null, crypto: randomSource(1) }],
		['a missing random generator', { storage: memoryStorage(), crypto: null }],
		[
			'a malformed random result',
			{ storage: memoryStorage(), crypto: { getRandomValues: () => new Uint8Array(31) } }
		]
	])('fails closed for %s', (_label, options) => {
		expect(() => getOrCreateCheckoutRequestId(/** @type {any} */ (options))).toThrow(
			/checkout request id/i
		);
	});
});

describe('browser checkout request retirement', () => {
	it('removes only the exact request ID confirmed by the persisted order', () => {
		const storage = memoryStorage(JSON.stringify({ v: 1, id: REQUEST_ID }));

		expect(retireCheckoutRequestId({ storage, expectedRequestId: REQUEST_ID })).toBe(true);
		expect(storage.removeItem).toHaveBeenCalledWith(CHECKOUT_REQUEST_STORAGE_KEY);
	});

	it.each([
		['a newer concurrent request', JSON.stringify({ v: 1, id: NEXT_REQUEST_ID })],
		['malformed state', 'not-json'],
		['missing state', null]
	])('preserves %s', (_label, value) => {
		const storage = memoryStorage(value);

		expect(retireCheckoutRequestId({ storage, expectedRequestId: REQUEST_ID })).toBe(false);
		expect(storage.removeItem).not.toHaveBeenCalled();
	});

	it('fails closed when storage is blocked', () => {
		const storage = {
			getItem: vi.fn(() => {
				throw new Error('blocked');
			}),
			setItem: vi.fn(),
			removeItem: vi.fn()
		};

		expect(retireCheckoutRequestId({ storage, expectedRequestId: REQUEST_ID })).toBe(false);
		expect(storage.removeItem).not.toHaveBeenCalled();
	});

	it('rejects malformed dependencies without touching storage', () => {
		const storage = memoryStorage(JSON.stringify({ v: 1, id: REQUEST_ID }));

		expect(retireCheckoutRequestId({ storage, expectedRequestId: 'ckr1_invalid' })).toBe(false);
		expect(storage.getItem).not.toHaveBeenCalled();
	});
});
