import { writable } from 'svelte/store';
import { addBooks, cartSelectionKey, createCart, setBookQuantity, setBookSelected } from './cart';

/**
 * @typedef {{ courseId?: string, bookId: string, quantity: number }} CartItem
 * @typedef {{ items: CartItem[] }} Cart
 * @typedef {{ items: CartItem[], consumedOrderReferences?: string[] }} PersistedCart
 * @typedef {string | CartItem} BookSelection
 * @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }} CartStorage
 * @typedef {{ request: (name: string, options: { mode: 'exclusive' }, operation: () => any) => Promise<any> }} CartLockManager
 */

const ORDER_REFERENCE_PATTERN = /^MPC-[A-HJ-NP-Z2-9]{12}$/u;

/**
 * @returns {Storage | undefined}
 */
function getBrowserStorage() {
	if (typeof window === 'undefined') {
		return undefined;
	}

	return window.localStorage;
}

/** @returns {CartLockManager | undefined} */
function getBrowserLocks() {
	if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') {
		return undefined;
	}
	return navigator.locks;
}

/** @param {unknown} value */
function parsePersistedCart(value) {
	if (typeof value !== 'string') throw new Error('Saved cart is missing');
	const parsed = JSON.parse(value);
	if (!parsed || Array.isArray(parsed) || !Array.isArray(parsed.items)) {
		throw new Error('Saved cart must contain an items array');
	}
	const cart = createCart(parsed.items);
	const consumedOrderReferences = parsed.consumedOrderReferences ?? [];
	if (
		!Array.isArray(consumedOrderReferences) ||
		consumedOrderReferences.some(
			(reference) => typeof reference !== 'string' || !ORDER_REFERENCE_PATTERN.test(reference)
		) ||
		new Set(consumedOrderReferences).size !== consumedOrderReferences.length
	) {
		throw new Error('Saved cart has invalid order references');
	}
	return { cart, consumedOrderReferences };
}

/** @param {Cart} cart @param {string[]} consumedOrderReferences */
function persistedCartValue(cart, consumedOrderReferences) {
	return JSON.stringify({
		items: cart.items,
		...(consumedOrderReferences.length === 0 ? {} : { consumedOrderReferences })
	});
}

/** @param {unknown} selections */
function confirmedSelections(selections) {
	if (
		!Array.isArray(selections) ||
		selections.some(
			(selection) =>
				selection === null ||
				typeof selection !== 'object' ||
				Array.isArray(selection) ||
				typeof selection.courseId !== 'string' ||
				selection.courseId.length === 0 ||
				typeof selection.bookId !== 'string' ||
				selection.bookId.length === 0 ||
				!Number.isSafeInteger(selection.quantity) ||
				selection.quantity <= 0
		)
	) {
		return null;
	}

	try {
		return createCart(selections).items;
	} catch {
		return null;
	}
}

/**
 * @param {string} [storageKey]
 * @param {CartStorage} [storage]
 * @param {CartLockManager} [locks]
 */
export function createBookCartStore(storageKey = 'mari-book-cart', storage, locks) {
	const browserStorage = storage ?? getBrowserStorage();
	const lockManager = locks ?? getBrowserLocks();
	const requiresBrowserLock =
		storage === undefined && browserStorage !== undefined && typeof navigator !== 'undefined';
	const lockName = `mpc:book-cart:${storageKey}`;
	const store = writable(createCart());
	let currentCart = createCart();
	/** @type {string[]} */
	let consumedOrderReferences = [];
	store.subscribe((cart) => {
		currentCart = cart;
	});

	/**
	 * @param {Cart} cart
	 */
	function persist(cart, references = consumedOrderReferences) {
		browserStorage?.setItem(storageKey, persistedCartValue(cart, references));
	}

	/**
	 * Every browser read-modify-write operation uses the same named lock. Explicit storage
	 * dependencies keep the synchronous fallback used by server rendering and unit tests.
	 *
	 * @template T
	 * @param {() => T | Promise<T>} operation
	 * @param {T} failureValue
	 * @returns {T | Promise<T>}
	 */
	function runSerialized(operation, failureValue) {
		if (requiresBrowserLock && !lockManager) return failureValue;
		if (!lockManager) {
			try {
				return operation();
			} catch {
				return failureValue;
			}
		}

		try {
			return Promise.resolve(lockManager.request(lockName, { mode: 'exclusive' }, operation)).catch(
				() => failureValue
			);
		} catch {
			return Promise.resolve(failureValue);
		}
	}

	function latestEnvelope() {
		if (!browserStorage) {
			return { cart: currentCart, references: consumedOrderReferences };
		}

		const persisted = browserStorage.getItem(storageKey);
		if (persisted === null) {
			return { cart: currentCart, references: consumedOrderReferences };
		}
		const envelope = parsePersistedCart(persisted);
		return { cart: envelope.cart, references: envelope.consumedOrderReferences };
	}

	/**
	 * @param {(cart: Cart) => Cart} mutate
	 * @returns {boolean | Promise<boolean>}
	 */
	function update(mutate) {
		return runSerialized(() => {
			const envelope = latestEnvelope();
			const nextCart = mutate(envelope.cart);
			persist(nextCart, envelope.references);
			consumedOrderReferences = envelope.references;
			store.set(nextCart);
			return true;
		}, false);
	}

	function hydrate() {
		if (!browserStorage) return true;

		return runSerialized(() => {
			let nextCart;
			let references;
			let persisted;
			try {
				persisted = browserStorage.getItem(storageKey);
			} catch {
				return false;
			}
			try {
				const envelope = parsePersistedCart(persisted);
				nextCart = envelope.cart;
				references = envelope.consumedOrderReferences;
			} catch {
				nextCart = createCart();
				references = [];
			}

			persist(nextCart, references);
			consumedOrderReferences = references;
			store.set(nextCart);
			return true;
		}, false);
	}

	return {
		subscribe: store.subscribe,
		hydrate,
		/** @param {BookSelection[]} selections */
		addBooks(selections) {
			return update((cart) => addBooks(cart, selections));
		},
		/** @param {string} bookId @param {boolean} selected @param {string} [courseId] */
		setSelected(bookId, selected, courseId) {
			return update((cart) => setBookSelected(cart, bookId, selected, courseId));
		},
		/** @param {string} bookId @param {number} quantity @param {string} [courseId] */
		setQuantity(bookId, quantity, courseId) {
			return update((cart) => setBookQuantity(cart, bookId, quantity, courseId));
		},
		/** @param {ReadonlySet<string>} availableBookIds */
		reconcile(availableBookIds) {
			return runSerialized(() => {
				const envelope = latestEnvelope();
				const items = envelope.cart.items.filter(({ courseId, bookId }) =>
					availableBookIds.has(courseId === undefined ? bookId : cartSelectionKey(courseId, bookId))
				);
				const removedCount = envelope.cart.items.length - items.length;
				if (removedCount > 0) {
					const nextCart = createCart(items);
					persist(nextCart, envelope.references);
					consumedOrderReferences = envelope.references;
					store.set(nextCart);
				}
				return { removedCount };
			}, null);
		},
		clear() {
			return update(() => createCart());
		},
		/**
		 * Removes only the immutable selections attached to one authorized terminal order. The
		 * order reference and cart update share one persisted write so retries are idempotent.
		 *
		 * @param {string} orderReference
		 * @param {CartItem[]} selections
		 */
		async consumeConfirmedOrder(orderReference, selections) {
			const purchased = confirmedSelections(selections);
			if (
				!browserStorage ||
				typeof orderReference !== 'string' ||
				!ORDER_REFERENCE_PATTERN.test(orderReference) ||
				purchased === null
			) {
				return false;
			}
			const operation = async () => {
				try {
					const persisted = browserStorage.getItem(storageKey);
					const envelope =
						persisted === null
							? { cart: createCart(), consumedOrderReferences: [] }
							: parsePersistedCart(persisted);
					if (envelope.consumedOrderReferences.includes(orderReference)) {
						consumedOrderReferences = envelope.consumedOrderReferences;
						store.set(envelope.cart);
						return true;
					}

					const purchasedBySelection = new Map(
						purchased.map((item) => [cartSelectionKey(item.courseId, item.bookId), item.quantity])
					);
					const nextCart = createCart(
						envelope.cart.items.flatMap((item) => {
							const purchasedQuantity =
								purchasedBySelection.get(cartSelectionKey(item.courseId, item.bookId)) ?? 0;
							const quantity = item.quantity - purchasedQuantity;
							return quantity <= 0 ? [] : [{ ...item, quantity }];
						})
					);
					const references = [...envelope.consumedOrderReferences, orderReference];
					browserStorage.setItem(storageKey, persistedCartValue(nextCart, references));
					consumedOrderReferences = references;
					store.set(nextCart);
					return true;
				} catch {
					return false;
				}
			};

			return await runSerialized(operation, false);
		}
	};
}
