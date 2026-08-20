import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { load as parentLoad, prerender as parentPrerender } from '../+page.server.js';
import { load, prerender } from './+page.server.js';
import OrderConfirmationRoute from './+page.svelte';

afterEach(cleanup);

describe('public-reference order confirmation route', () => {
	it('uses the same non-prerendered capability loader as the recovery route', () => {
		expect(load).toBe(parentLoad);
		expect(prerender).toBe(parentPrerender);
		expect(prerender).toBe(false);
	});

	it('renders the shared confirmation workspace', () => {
		render(OrderConfirmationRoute, {
			props: {
				data: {
					launchState: 'live',
					confirmation: { status: 'unavailable', returnPath: '/books/cart' }
				}
			}
		});

		expect(screen.getByRole('heading', { name: "We couldn't open this order" })).toBeVisible();
	});
});
