import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBookCartStore } from './cart-store';
import { cartSelectionKey } from './cart';

/**
 * @typedef {{ items: { bookId: string, quantity: number }[] }} Cart
 * @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, valueAt: (key: string) => string | null }} MemoryStorage
 * @typedef {ReturnType<typeof createBookCartStore>} BookCartStore
 */

const FIRST_ORDER_REFERENCE = 'MPC-23456789ABCD';
const SECOND_ORDER_REFERENCE = 'MPC-3456789ABCDE';

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

function serializedLocks() {
	let tail = Promise.resolve();
	return {
		request: vi.fn(
			(
				/** @type {string} */ _name,
				/** @type {{ mode: 'exclusive' }} */ _options,
				/** @type {() => Promise<boolean> | boolean} */ operation
			) => {
				const result = tail.then(operation);
				tail = result.then(
					() => undefined,
					() => undefined
				);
				return result;
			}
		)
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createBookCartStore', () => {
	it('hydrates a missing saved cart to the canonical empty value', () => {
		const storage = createMemoryStorage();
		const store = createBookCartStore('test-cart', storage);

		expect(store.hydrate()).toBe(true);
		expect(storage.valueAt('test-cart')).toBe('{"items":[]}');
	});

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

	it('uses the browser lock manager when no lock dependency is supplied', async () => {
		const storage = createMemoryStorage();
		const locks = serializedLocks();
		vi.stubGlobal('navigator', { locks });
		const store = createBookCartStore('test-cart', storage);

		await expect(store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [])).resolves.toBe(true);
		expect(locks.request).toHaveBeenCalledWith(
			'mpc:book-cart:test-cart',
			{ mode: 'exclusive' },
			expect.any(Function)
		);
	});

	it('uses one lock namespace for every persisted cart mutation', async () => {
		const storage = createMemoryStorage({ 'test-cart': '{"items":[]}' });
		const locks = serializedLocks();
		const store = createBookCartStore('test-cart', storage, locks);

		await store.hydrate();
		await store.addBooks([{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }]);
		await store.setSelected('book-b', true, 'course-b');
		await store.setQuantity('book-a', 2, 'course-a');
		await store.reconcile(
			new Set([cartSelectionKey('course-a', 'book-a'), cartSelectionKey('course-b', 'book-b')])
		);
		await store.clear();

		expect(locks.request).toHaveBeenCalledTimes(6);
		for (const call of locks.request.mock.calls) {
			expect(call.slice(0, 2)).toEqual(['mpc:book-cart:test-cart', { mode: 'exclusive' }]);
		}
	});

	it('uses an unlocked server fallback when navigator is unavailable', async () => {
		vi.stubGlobal('navigator', undefined);
		const storage = createMemoryStorage({ 'test-cart': '{"items":[]}' });
		const store = createBookCartStore('test-cart', storage);

		await expect(store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [])).resolves.toBe(true);
	});

	it('preserves browser cart state when cross-tab locking is unavailable', async () => {
		vi.stubGlobal('navigator', {});
		vi.stubGlobal('window', {
			localStorage: createMemoryStorage({ 'mari-book-cart': '{"items":[]}' })
		});
		const store = createBookCartStore();

		await expect(store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [])).resolves.toBe(false);
	});

	it('fails closed for every persisted mutation when browser locking is unavailable', async () => {
		const savedCart = JSON.stringify({
			items: [{ courseId: 'course-a', bookId: 'book-a', quantity: 2 }]
		});
		const storage = createMemoryStorage({ 'mari-book-cart': savedCart });
		vi.stubGlobal('navigator', {});
		vi.stubGlobal('window', { localStorage: storage });
		const store = createBookCartStore();
		const observation = observe(store);

		expect(await store.hydrate()).toBe(false);
		expect(await store.addBooks([{ courseId: 'course-b', bookId: 'book-b', quantity: 1 }])).toBe(
			false
		);
		expect(await store.setSelected('book-c', true, 'course-c')).toBe(false);
		expect(await store.setQuantity('book-a', 4, 'course-a')).toBe(false);
		expect(await store.reconcile(new Set([cartSelectionKey('course-a', 'book-a')]))).toBeNull();
		expect(await store.clear()).toBe(false);

		expect(storage.valueAt('mari-book-cart')).toBe(savedCart);
		expect(observation.values).toEqual([{ items: [] }]);
		observation.unsubscribe();
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

	it('reconciles persisted selections against active books and reports removed items', () => {
		const storage = createMemoryStorage();
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);
		store.setQuantity('active-book', 2);
		store.setQuantity('inactive-book', 1);

		expect(store.reconcile(new Set(['active-book']))).toEqual({ removedCount: 1 });
		expect(observation.values.at(-1)).toEqual({
			items: [{ bookId: 'active-book', quantity: 2 }]
		});
		expect(storage.valueAt('test-cart')).toBe('{"items":[{"bookId":"active-book","quantity":2}]}');
		observation.unsubscribe();
	});

	it('leaves an already valid cart unchanged during reconciliation', () => {
		const storage = createMemoryStorage();
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);
		store.setQuantity('active-book', 2);
		const updateCount = observation.values.length;

		expect(store.reconcile(new Set(['active-book']))).toEqual({ removedCount: 0 });
		expect(observation.values).toHaveLength(updateCount);
		observation.unsubscribe();
	});

	it('persists and reconciles composite course-book assignments independently', () => {
		const storage = createMemoryStorage();
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);
		store.setQuantity('shared-book', 1, 'course-a');
		store.setQuantity('shared-book', 2, 'course-b');

		expect(observation.values.at(-1)).toEqual({
			items: [
				{ courseId: 'course-a', bookId: 'shared-book', quantity: 1 },
				{ courseId: 'course-b', bookId: 'shared-book', quantity: 2 }
			]
		});
		expect(store.reconcile(new Set([cartSelectionKey('course-b', 'shared-book')]))).toEqual({
			removedCount: 1
		});
		expect(observation.values.at(-1)).toEqual({
			items: [{ courseId: 'course-b', bookId: 'shared-book', quantity: 2 }]
		});
		observation.unsubscribe();
	});

	it('consumes only the purchased quantities from the authorized order', async () => {
		const storage = createMemoryStorage({
			'test-cart': JSON.stringify({
				items: [
					{ courseId: 'course-a', bookId: 'shared-book', quantity: 3 },
					{ courseId: 'course-b', bookId: 'shared-book', quantity: 2 },
					{ courseId: 'course-c', bookId: 'other-book', quantity: 1 }
				]
			})
		});
		const store = createBookCartStore('test-cart', storage, serializedLocks());
		const observation = observe(store);
		store.hydrate();

		await expect(
			store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
				{ courseId: 'course-a', bookId: 'shared-book', quantity: 2 },
				{ courseId: 'course-b', bookId: 'shared-book', quantity: 2 }
			])
		).resolves.toBe(true);

		expect(observation.values.at(-1)).toEqual({
			items: [
				{ courseId: 'course-a', bookId: 'shared-book', quantity: 1 },
				{ courseId: 'course-c', bookId: 'other-book', quantity: 1 }
			]
		});
		expect(JSON.parse(storage.valueAt('test-cart') ?? '')).toEqual({
			items: [
				{ courseId: 'course-a', bookId: 'shared-book', quantity: 1 },
				{ courseId: 'course-c', bookId: 'other-book', quantity: 1 }
			],
			consumedOrderReferences: [FIRST_ORDER_REFERENCE]
		});
		observation.unsubscribe();
	});

	it('records order consumption atomically and never subtracts the same order twice', async () => {
		const storage = createMemoryStorage({
			'test-cart': JSON.stringify({
				items: [{ courseId: 'course-a', bookId: 'book-a', quantity: 3 }]
			})
		});
		const locks = serializedLocks();
		const firstStore = createBookCartStore('test-cart', storage, locks);
		const secondStore = createBookCartStore('test-cart', storage, locks);

		const results = await Promise.all([
			firstStore.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }
			]),
			secondStore.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }
			])
		]);

		expect(results).toEqual([true, true]);
		expect(JSON.parse(storage.valueAt('test-cart') ?? '')).toEqual({
			items: [{ courseId: 'course-a', bookId: 'book-a', quantity: 2 }],
			consumedOrderReferences: [FIRST_ORDER_REFERENCE]
		});
	});

	it('serializes different order cleanups without losing unrelated cart changes', async () => {
		const storage = createMemoryStorage({
			'test-cart': JSON.stringify({
				items: [
					{ courseId: 'course-a', bookId: 'book-a', quantity: 2 },
					{ courseId: 'course-b', bookId: 'book-b', quantity: 2 }
				]
			})
		});
		const locks = serializedLocks();
		const firstStore = createBookCartStore('test-cart', storage, locks);
		const secondStore = createBookCartStore('test-cart', storage, locks);

		await Promise.all([
			firstStore.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }
			]),
			secondStore.consumeConfirmedOrder(SECOND_ORDER_REFERENCE, [
				{ courseId: 'course-b', bookId: 'book-b', quantity: 1 }
			])
		]);

		expect(JSON.parse(storage.valueAt('test-cart') ?? '')).toEqual({
			items: [
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 },
				{ courseId: 'course-b', bookId: 'book-b', quantity: 1 }
			],
			consumedOrderReferences: [FIRST_ORDER_REFERENCE, SECOND_ORDER_REFERENCE]
		});
	});

	it('serializes a concurrent add behind order cleanup without losing either change', async () => {
		const storage = createMemoryStorage({
			'test-cart': JSON.stringify({
				items: [
					{ courseId: 'course-a', bookId: 'book-a', quantity: 2 },
					{ courseId: 'course-b', bookId: 'book-b', quantity: 1 }
				]
			})
		});
		const locks = serializedLocks();
		const cleanupStore = createBookCartStore('test-cart', storage, locks);
		const shoppingStore = createBookCartStore('test-cart', storage, locks);
		const originalSetItem = storage.setItem.bind(storage);
		/** @type {Promise<boolean> | boolean | undefined} */
		let concurrentAdd;
		let didInterleave = false;
		storage.setItem = (key, value) => {
			const next = JSON.parse(value);
			if (!didInterleave && next.consumedOrderReferences?.includes(FIRST_ORDER_REFERENCE)) {
				didInterleave = true;
				concurrentAdd = shoppingStore.addBooks([
					{ courseId: 'course-c', bookId: 'book-c', quantity: 1 }
				]);
			}
			originalSetItem(key, value);
		};

		await expect(
			cleanupStore.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }
			])
		).resolves.toBe(true);
		await concurrentAdd;

		expect(didInterleave).toBe(true);
		expect(JSON.parse(storage.valueAt('test-cart') ?? '')).toEqual({
			items: [
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 },
				{ courseId: 'course-b', bookId: 'book-b', quantity: 1 },
				{ courseId: 'course-c', bookId: 'book-c', quantity: 1 }
			],
			consumedOrderReferences: [FIRST_ORDER_REFERENCE]
		});
	});

	it('serializes concurrent quantity and selection changes behind order cleanup', async () => {
		const storage = createMemoryStorage({
			'test-cart': JSON.stringify({
				items: [
					{ courseId: 'course-a', bookId: 'book-a', quantity: 2 },
					{ courseId: 'course-b', bookId: 'book-b', quantity: 1 }
				]
			})
		});
		const locks = serializedLocks();
		const cleanupStore = createBookCartStore('test-cart', storage, locks);
		const shoppingStore = createBookCartStore('test-cart', storage, locks);
		const originalSetItem = storage.setItem.bind(storage);
		/** @type {Array<Promise<boolean> | boolean>} */
		const concurrentMutations = [];
		let didInterleave = false;
		storage.setItem = (key, value) => {
			const next = JSON.parse(value);
			if (!didInterleave && next.consumedOrderReferences?.includes(FIRST_ORDER_REFERENCE)) {
				didInterleave = true;
				concurrentMutations.push(
					shoppingStore.setQuantity('book-b', 3, 'course-b'),
					shoppingStore.setSelected('book-c', true, 'course-c')
				);
			}
			originalSetItem(key, value);
		};

		await expect(
			cleanupStore.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }
			])
		).resolves.toBe(true);
		await Promise.all(concurrentMutations);

		expect(didInterleave).toBe(true);
		expect(JSON.parse(storage.valueAt('test-cart') ?? '')).toEqual({
			items: [
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 },
				{ courseId: 'course-b', bookId: 'book-b', quantity: 3 },
				{ courseId: 'course-c', bookId: 'book-c', quantity: 1 }
			],
			consumedOrderReferences: [FIRST_ORDER_REFERENCE]
		});
	});

	it('preserves the consumption marker through later cart mutations', async () => {
		const storage = createMemoryStorage({
			'test-cart': JSON.stringify({
				items: [{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }]
			})
		});
		const store = createBookCartStore('test-cart', storage, serializedLocks());

		await store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
			{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }
		]);
		await expect(store.setQuantity('book-b', 2, 'course-b')).resolves.toBe(true);

		expect(JSON.parse(storage.valueAt('test-cart') ?? '')).toEqual({
			items: [{ courseId: 'course-b', bookId: 'book-b', quantity: 2 }],
			consumedOrderReferences: [FIRST_ORDER_REFERENCE]
		});
		await expect(
			store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
				{ courseId: 'course-b', bookId: 'book-b', quantity: 1 }
			])
		).resolves.toBe(true);
	});

	it.each([
		['a non-array marker', { items: [], consumedOrderReferences: 'not-an-array' }],
		['a malformed marker', { items: [], consumedOrderReferences: ['MPC-invalid'] }],
		[
			'a duplicate marker',
			{ items: [], consumedOrderReferences: [FIRST_ORDER_REFERENCE, FIRST_ORDER_REFERENCE] }
		]
	])('resets persisted cart state with %s', (_label, savedCart) => {
		const storage = createMemoryStorage({ 'test-cart': JSON.stringify(savedCart) });
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);

		store.hydrate();

		expect(observation.values.at(-1)).toEqual({ items: [] });
		expect(storage.valueAt('test-cart')).toBe('{"items":[]}');
		observation.unsubscribe();
	});

	it('fails closed when mutation finds malformed persisted state', () => {
		const storage = createMemoryStorage({ 'test-cart': 'not-json' });
		const setItem = vi.spyOn(storage, 'setItem');
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);

		expect(store.setQuantity('book-a', 1, 'course-a')).toBe(false);

		expect(setItem).not.toHaveBeenCalled();
		expect(storage.valueAt('test-cart')).toBe('not-json');
		expect(observation.values).toEqual([{ items: [] }]);
		observation.unsubscribe();
	});

	it('does not mutate in-memory state when an unlocked persistence write fails', () => {
		const storage = {
			getItem: vi.fn(() => '{"items":[]}'),
			setItem: vi.fn(() => {
				throw new Error('storage blocked');
			})
		};
		const store = createBookCartStore('test-cart', storage);
		const observation = observe(store);

		expect(store.setQuantity('book-a', 1, 'course-a')).toBe(false);
		expect(observation.values).toEqual([{ items: [] }]);
		observation.unsubscribe();
	});

	it.each([
		['hydrate', (/** @type {BookCartStore} */ store) => store.hydrate(), false],
		[
			'add',
			(/** @type {BookCartStore} */ store) =>
				store.addBooks([{ courseId: 'course-c', bookId: 'book-c', quantity: 1 }]),
			false
		],
		[
			'selection',
			(/** @type {BookCartStore} */ store) => store.setSelected('book-c', true, 'course-c'),
			false
		],
		[
			'quantity',
			(/** @type {BookCartStore} */ store) => store.setQuantity('book-a', 4, 'course-a'),
			false
		],
		[
			'reconciliation',
			(/** @type {BookCartStore} */ store) =>
				store.reconcile(new Set([cartSelectionKey('course-a', 'book-a')])),
			null
		],
		['clear', (/** @type {BookCartStore} */ store) => store.clear(), false],
		[
			'confirmation cleanup',
			(/** @type {BookCartStore} */ store) =>
				store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
					{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }
				]),
			false
		]
	])(
		'fails closed during %s when persisted state cannot be read',
		async (_label, mutate, expected) => {
			const savedCart = JSON.stringify({
				items: [
					{ courseId: 'course-a', bookId: 'book-a', quantity: 2 },
					{ courseId: 'course-b', bookId: 'book-b', quantity: 1 }
				],
				consumedOrderReferences: [SECOND_ORDER_REFERENCE]
			});
			const storage = createMemoryStorage({ 'test-cart': savedCart });
			vi.spyOn(storage, 'getItem').mockImplementation(() => {
				throw new Error('storage read blocked');
			});
			const setItem = vi.spyOn(storage, 'setItem');
			const store = createBookCartStore('test-cart', storage, serializedLocks());
			const observation = observe(store);

			expect(await mutate(store)).toEqual(expected);
			expect(setItem).not.toHaveBeenCalled();
			expect(storage.valueAt('test-cart')).toBe(savedCart);
			expect(observation.values).toEqual([{ items: [] }]);
			observation.unsubscribe();
		}
	);

	it('rejects duplicate confirmed selections whose merged quantity overflows', async () => {
		const storage = createMemoryStorage();
		const store = createBookCartStore('test-cart', storage, serializedLocks());

		await expect(
			store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
				{ courseId: 'course-a', bookId: 'book-a', quantity: Number.MAX_SAFE_INTEGER },
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }
			])
		).resolves.toBe(false);
	});

	it('fails closed without changing the store when persistence fails', async () => {
		const persisted = JSON.stringify({
			items: [{ courseId: 'course-a', bookId: 'book-a', quantity: 2 }]
		});
		const storage = {
			getItem: vi.fn(() => persisted),
			setItem: vi.fn(() => {
				throw new Error('storage blocked');
			})
		};
		const store = createBookCartStore('test-cart', storage, serializedLocks());
		const observation = observe(store);

		await expect(
			store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [
				{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }
			])
		).resolves.toBe(false);
		expect(observation.values.at(-1)).toEqual({ items: [] });
		expect(storage.setItem).toHaveBeenCalledOnce();
		observation.unsubscribe();
	});

	it('fails closed when the browser lock manager rejects', async () => {
		const storage = createMemoryStorage({ 'test-cart': '{"items":[]}' });
		const locks = {
			request: vi.fn(async () => {
				throw new Error('lock unavailable');
			})
		};
		const store = createBookCartStore('test-cart', storage, /** @type {any} */ (locks));

		await expect(store.consumeConfirmedOrder(FIRST_ORDER_REFERENCE, [])).resolves.toBe(false);
	});

	it('does not partially mutate ordinary cart state when the lock manager rejects', async () => {
		const savedCart = JSON.stringify({
			items: [{ courseId: 'course-a', bookId: 'book-a', quantity: 2 }]
		});
		const storage = createMemoryStorage({ 'test-cart': savedCart });
		const setItem = vi.spyOn(storage, 'setItem');
		const locks = {
			request: vi.fn(async () => {
				throw new Error('lock unavailable');
			})
		};
		const store = createBookCartStore('test-cart', storage, /** @type {any} */ (locks));
		const observation = observe(store);

		expect(await store.hydrate()).toBe(false);
		expect(await store.addBooks(['book-b'])).toBe(false);
		expect(await store.setSelected('book-c', true)).toBe(false);
		expect(await store.setQuantity('book-a', 4, 'course-a')).toBe(false);
		expect(await store.reconcile(new Set([cartSelectionKey('course-a', 'book-a')]))).toBeNull();
		expect(await store.clear()).toBe(false);

		expect(setItem).not.toHaveBeenCalled();
		expect(storage.valueAt('test-cart')).toBe(savedCart);
		expect(observation.values).toEqual([{ items: [] }]);
		observation.unsubscribe();
	});

	it('fails closed when requesting a cart lock throws synchronously', async () => {
		const storage = createMemoryStorage({ 'test-cart': '{"items":[]}' });
		const locks = {
			request: vi.fn(() => {
				throw new Error('lock request failed');
			})
		};
		const store = createBookCartStore('test-cart', storage, /** @type {any} */ (locks));

		await expect(store.addBooks(['book-a'])).resolves.toBe(false);
		expect(storage.valueAt('test-cart')).toBe('{"items":[]}');
	});

	it.each([
		[
			'a malformed reference',
			'MPC-invalid',
			[{ courseId: 'course-a', bookId: 'book-a', quantity: 1 }]
		],
		['a missing course', FIRST_ORDER_REFERENCE, [{ bookId: 'book-a', quantity: 1 }]],
		[
			'a zero quantity',
			FIRST_ORDER_REFERENCE,
			[{ courseId: 'course-a', bookId: 'book-a', quantity: 0 }]
		]
	])('rejects %s before touching persistence', async (_label, reference, selections) => {
		const storage = createMemoryStorage();
		const getItem = vi.spyOn(storage, 'getItem');
		const store = createBookCartStore('test-cart', storage, serializedLocks());

		await expect(
			store.consumeConfirmedOrder(reference, /** @type {any} */ (selections))
		).resolves.toBe(false);
		expect(getItem).not.toHaveBeenCalled();
	});
});
