const REQUEST_ID_PATTERN = /^ckr1_[A-Za-z0-9_-]{43}$/u;

export const CHECKOUT_REQUEST_STORAGE_KEY = 'mpc.book-checkout-request.v1';

/** @param {Uint8Array} bytes */
function base64Url(bytes) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

/** @param {unknown} value */
function persistedRequestId(value) {
	if (typeof value !== 'string') return null;
	try {
		const parsed = JSON.parse(value);
		if (
			parsed === null ||
			typeof parsed !== 'object' ||
			Array.isArray(parsed) ||
			Object.keys(parsed).length !== 2 ||
			parsed.v !== 1 ||
			typeof parsed.id !== 'string' ||
			!REQUEST_ID_PATTERN.test(parsed.id)
		) {
			return null;
		}
		return parsed.id;
	} catch {
		return null;
	}
}

/**
 * Keeps one opaque browser-generated request ID in session storage so a network or persistence
 * retry reaches the same server-side attempt. No contact or cart data is stored with it.
 *
 * @param {{
 *   storage: { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void },
 *   crypto: Pick<Crypto, 'getRandomValues'>
 * }} options
 */
export function getOrCreateCheckoutRequestId({ storage, crypto }) {
	if (
		storage === null ||
		typeof storage !== 'object' ||
		typeof storage.getItem !== 'function' ||
		typeof storage.setItem !== 'function' ||
		crypto === null ||
		typeof crypto !== 'object' ||
		typeof crypto.getRandomValues !== 'function'
	) {
		throw new Error('Checkout request ID is unavailable');
	}

	let persisted = null;
	try {
		persisted = storage.getItem(CHECKOUT_REQUEST_STORAGE_KEY);
	} catch {
		// Session storage can be blocked; the caller retains the returned ID in memory for this page.
	}
	const existingId = persistedRequestId(persisted);
	if (existingId !== null) return existingId;

	const bytes = new Uint8Array(32);
	const generated = crypto.getRandomValues(bytes);
	if (!(generated instanceof Uint8Array) || generated !== bytes || generated.length !== 32) {
		throw new Error('Checkout request ID is unavailable');
	}
	const requestId = `ckr1_${base64Url(bytes)}`;
	try {
		storage.setItem(CHECKOUT_REQUEST_STORAGE_KEY, JSON.stringify({ v: 1, id: requestId }));
	} catch {
		// The in-memory page state still preserves this value across immediate retries.
	}
	return requestId;
}

/**
 * Retires only the request ID attached to an authorized terminal order. A newer request in the
 * same tab is left intact.
 *
 * @param {{
 *   storage: { getItem: (key: string) => string | null, removeItem: (key: string) => void },
 *   expectedRequestId: string
 * }} options
 */
export function retireCheckoutRequestId({ storage, expectedRequestId }) {
	if (
		storage === null ||
		typeof storage !== 'object' ||
		typeof storage.getItem !== 'function' ||
		typeof storage.removeItem !== 'function' ||
		typeof expectedRequestId !== 'string' ||
		!REQUEST_ID_PATTERN.test(expectedRequestId)
	) {
		return false;
	}

	try {
		if (persistedRequestId(storage.getItem(CHECKOUT_REQUEST_STORAGE_KEY)) !== expectedRequestId) {
			return false;
		}
		storage.removeItem(CHECKOUT_REQUEST_STORAGE_KEY);
		return true;
	} catch {
		return false;
	}
}
