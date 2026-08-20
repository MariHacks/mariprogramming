// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createBooksLayoutLoad, load as productionLoad, prerender } from './+layout.server';

describe('Book Delivery server layout', () => {
	it('is never prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('uses the production closed redirect for a nested route without configuration', () => {
		expect(() => productionLoad({ route: { id: '/books/cart' } })).toThrow(
			expect.objectContaining({ status: 303, location: '/' })
		);
	});

	it.each([undefined, 'coming-soon', 'invalid'])('redirects the root home for %j', (state) => {
		const load = _createBooksLayoutLoad({ getLaunchState: () => state });
		expect(() => load({ route: { id: '/books' } })).toThrow(
			expect.objectContaining({ status: 303, location: '/' })
		);
	});

	it('returns live for the root when explicitly enabled', () => {
		const load = _createBooksLayoutLoad({ getLaunchState: () => 'live' });
		expect(load({ route: { id: '/books' } })).toEqual({ launchState: 'live' });
	});

	it.each([
		'/books',
		'/books/cart',
		'/books/checkout',
		'/books/[teacherSlug]/[courseId]',
		'/books/order-confirmation'
	])('redirects direct nested route %s before its child can load', (routeId) => {
		const onClosed = vi.fn(() => {
			throw Object.assign(new Error('redirect'), { status: 303, location: '/' });
		});
		const load = _createBooksLayoutLoad({
			getLaunchState: () => 'coming-soon',
			onClosed
		});

		expect(() => load({ route: { id: routeId } })).toThrow(
			expect.objectContaining({ status: 303, location: '/' })
		);
		expect(onClosed).toHaveBeenCalledOnce();
	});
});
