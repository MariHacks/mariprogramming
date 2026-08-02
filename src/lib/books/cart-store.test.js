import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBookCartStore } from './cart-store';

/**
 * @typedef {{ items: { bookId: string, quantity: number }[] }} Cart
 * @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, valueAt: (key: string) => string | null }} MemoryStorage
 */

/**
 * @param {Record<string, string>} [initialEntries]
 * @returns {MemoryStorage}
 */
function createMemoryStorage(initialEntries = {}) {
	const entries = new Map(Object.entries(initialEntries));

	return {
		getItem(key) {
			return entries.get(key) ?? null;
		},
		setItem(key, value) {
			entries.set(key, String(value));
		},
		valueAt(key) {
			return entries.get(key) ?? null;
		}
	};
}

/**
 * @param {ReturnType<typeof createBookCartStore>} store
 */
function observe(store) {
	/** @type {Cart[]} */
	const values = [];
	const unsubscribe = store.subscribe((value) => values.push(value));

	return { values, unsubscribe };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createBookCartStore', () => {
	it('hydrates valid saved selections into one canonical line per book', () => {
		const storage = createMemoryStorage({
			'test-cart': JSON.stringify({
				items: [
					{ bookId: 'antigone', quantity: 1 },
					{ bookId: 'antigone', quantity: 2 },
					'bescherelle'
				]
			})
		});
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);

		store.hydrate();

		expect(observation.values).toEqual([
			{ items: [] },
			{
				items: [
					{ bookId: 'antigone', quantity: 3 },
					{ bookId: 'bescherelle', quantity: 1 }
				]
			}
		]);
		expect(storage.valueAt('test-cart')).toBe(
			JSON.stringify({
				items: [
					{ bookId: 'antigone', quantity: 3 },
					{ bookId: 'bescherelle', quantity: 1 }
				]
			})
		);
		observation.unsubscribe();
	});

	it.each([
		['malformed JSON', '{not-json'],
		['a non-object root', JSON.stringify(['antigone'])],
		['a missing items array', JSON.stringify({ version: 1 })],
		['an invalid cart item', JSON.stringify({ items: [{ bookId: 'antigone', quantity: 1.5 }] })]
	])('resets %s to a persisted empty cart', (_case, savedValue) => {
		const storage = createMemoryStorage({ 'test-cart': savedValue });
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);

		expect(() => store.hydrate()).not.toThrow();
		expect(observation.values.at(-1)).toEqual({ items: [] });
		expect(storage.valueAt('test-cart')).toBe('{"items":[]}');
		observation.unsubscribe();
	});

	it('is safe to construct and mutate without a browser storage global', () => {
		vi.stubGlobal('window', undefined);
		const firstStore = createBookCartStore();
		const secondStore = createBookCartStore();
		const firstObservation = observe(firstStore);
		const secondObservation = observe(secondStore);

		expect(() => {
			firstStore.hydrate();
			firstStore.addBooks(['antigone']);
			firstStore.setSelected('antigone', true);
			firstStore.setQuantity('antigone', 2);
		}).not.toThrow();
		expect(firstObservation.values.at(-1)).toEqual({
			items: [{ bookId: 'antigone', quantity: 2 }]
		});
		expect(secondObservation.values).toEqual([{ items: [] }]);
		firstObservation.unsubscribe();
		secondObservation.unsubscribe();
	});

	it('persists each add, selection, and quantity mutation immediately', () => {
		const storage = createMemoryStorage();
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);

		store.addBooks(['antigone', { bookId: 'antigone', quantity: 2 }]);
		expect(storage.valueAt('test-cart')).toBe('{"items":[{"bookId":"antigone","quantity":3}]}');

		store.setSelected('bescherelle', true);
		expect(storage.valueAt('test-cart')).toBe(
			'{"items":[{"bookId":"antigone","quantity":3},{"bookId":"bescherelle","quantity":1}]}'
		);

		store.setSelected('antigone', false);
		expect(storage.valueAt('test-cart')).toBe('{"items":[{"bookId":"bescherelle","quantity":1}]}');

		store.setQuantity('bescherelle', 4);
		expect(storage.valueAt('test-cart')).toBe('{"items":[{"bookId":"bescherelle","quantity":4}]}');
		expect(observation.values).toEqual([
			{ items: [] },
			{ items: [{ bookId: 'antigone', quantity: 3 }] },
			{
				items: [
					{ bookId: 'antigone', quantity: 3 },
					{ bookId: 'bescherelle', quantity: 1 }
				]
			},
			{ items: [{ bookId: 'bescherelle', quantity: 1 }] },
			{ items: [{ bookId: 'bescherelle', quantity: 4 }] }
		]);
		observation.unsubscribe();
	});

	it('clears the current state and persists the canonical empty cart', () => {
		const storage = createMemoryStorage();
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);

		store.addBooks(['antigone']);
		store.clear();

		expect(observation.values.at(-1)).toEqual({ items: [] });
		expect(storage.valueAt('test-cart')).toBe('{"items":[]}');
		observation.unsubscribe();
	});
});
