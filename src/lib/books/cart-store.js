import { writable } from 'svelte/store';
import { addBooks, createCart, setBookQuantity, setBookSelected } from './cart';

/**
 * @typedef {{ bookId: string, quantity: number }} CartItem
 * @typedef {{ items: CartItem[] }} Cart
 * @typedef {string | CartItem} BookSelection
 * @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }} CartStorage
 */

/**
 * @returns {Storage | undefined}
 */
function getBrowserStorage() {
	if (typeof window === 'undefined') {
		return undefined;
	}

	return window.localStorage;
}

/**
 * @param {string} [storageKey]
 * @param {CartStorage} [storage]
 */
export function createBookCartStore(storageKey = 'mari-book-cart', storage) {
	const browserStorage = storage ?? getBrowserStorage();
	const store = writable(createCart());

	/**
	 * @param {Cart} cart
	 */
	function persist(cart) {
		browserStorage?.setItem(storageKey, JSON.stringify(cart));
	}

	/**
	 * @param {(cart: Cart) => Cart} mutate
	 */
	function update(mutate) {
		store.update((cart) => {
			const nextCart = mutate(cart);
			persist(nextCart);
			return nextCart;
		});
	}

	function hydrate() {
		if (!browserStorage) {
			return;
		}

		let nextCart;
		try {
			const savedCart = JSON.parse(browserStorage.getItem(storageKey) ?? 'null');
			if (!savedCart || Array.isArray(savedCart) || !Array.isArray(savedCart.items)) {
				throw new Error('Saved cart must contain an items array');
			}

			nextCart = createCart(savedCart.items);
		} catch {
			nextCart = createCart();
		}

		store.set(nextCart);
		persist(nextCart);
	}

	return {
		subscribe: store.subscribe,
		hydrate,
		/** @param {BookSelection[]} selections */
		addBooks(selections) {
			update((cart) => addBooks(cart, selections));
		},
		/** @param {string} bookId @param {boolean} selected */
		setSelected(bookId, selected) {
			update((cart) => setBookSelected(cart, bookId, selected));
		},
		/** @param {string} bookId @param {number} quantity */
		setQuantity(bookId, quantity) {
			update((cart) => setBookQuantity(cart, bookId, quantity));
		},
		clear() {
			update(() => createCart());
		}
	};
}
