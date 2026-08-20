import { redirect } from '@sveltejs/kit';
import { readBookDeliveryLaunchState } from '$lib/server/books/launch-state';

export const prerender = false;

/**
 * @param {{ getLaunchState?: () => unknown, onClosed?: () => never }} [dependencies]
 */
export function _createBooksLayoutLoad({
	getLaunchState = readBookDeliveryLaunchState,
	onClosed = () => redirect(303, '/')
} = {}) {
	/** @param {unknown} _event */
	return function load(_event) {
		void _event;
		const launchState = getLaunchState() === 'live' ? 'live' : 'coming-soon';
		if (launchState !== 'live') onClosed();
		return { launchState };
	};
}

export const load = _createBooksLayoutLoad();
