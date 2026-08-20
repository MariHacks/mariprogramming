// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createCartPageLoad } from './+page.server';

describe('cart server load', () => {
	it('awaits the parent launch gate before loading catalogue data', async () => {
		/** @type {string[]} */
		const order = [];
		const parent = vi.fn(async () => order.push('parent'));
		const catalogue = { taxRateBps: 0, books: [], bookstores: [] };
		const loadCatalogue = vi.fn(async () => {
			order.push('repository');
			return catalogue;
		});

		await expect(_createCartPageLoad({ loadCatalogue })({ parent })).resolves.toEqual({
			catalogue
		});
		expect(order).toEqual(['parent', 'repository']);
	});
});
