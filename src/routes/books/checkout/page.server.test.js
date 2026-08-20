// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createCheckoutPageLoad } from './+page.server';

describe('checkout page server load', () => {
	it('awaits the parent launch gate before loading catalogue data', async () => {
		/** @type {string[]} */
		const order = [];
		const parent = vi.fn(async () => order.push('parent'));
		const catalogue = { taxRateBps: 0, books: [], bookstores: [] };
		const loadCatalogue = vi.fn(async () => {
			order.push('repository');
			return catalogue;
		});

		const readEnvironment = vi.fn(() => ({ stripeCheckoutHost: 'pay.club.example' }));

		await expect(
			_createCheckoutPageLoad({
				loadCatalogue,
				readEnvironment: /** @type {any} */ (readEnvironment)
			})({ parent })
		).resolves.toEqual({
			catalogue,
			stripeCheckoutHost: 'pay.club.example'
		});
		expect(order).toEqual(['parent', 'repository']);
		expect(readEnvironment).toHaveBeenCalledOnce();
	});
});
