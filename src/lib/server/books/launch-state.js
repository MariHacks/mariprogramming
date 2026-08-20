// The generated SvelteKit declarations are outside this repository's JS include.
// @ts-ignore
import { env } from '$env/dynamic/private';
import { resolveBookDeliveryLaunchState } from '../config/environment';

/**
 * @param {unknown} [source]
 * @returns {'coming-soon' | 'live'}
 */
export function readBookDeliveryLaunchState(source = env) {
	if (source === null || typeof source !== 'object' || Array.isArray(source)) {
		return 'coming-soon';
	}

	return resolveBookDeliveryLaunchState(
		/** @type {Record<string, unknown>} */ (source).BOOK_DELIVERY_LAUNCH_STATE
	);
}

/**
 * @template T
 * @param {{ source?: unknown, onClosed: () => T }} options
 * @returns {'live' | T}
 */
export function requireLiveBookDelivery({ source = env, onClosed }) {
	if (readBookDeliveryLaunchState(source) !== 'live') return onClosed();
	return 'live';
}
