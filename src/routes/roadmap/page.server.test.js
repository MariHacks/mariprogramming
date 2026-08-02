import { describe, expect, it } from 'vitest';
import { load } from './+page.server.js';

describe('roadmap route', () => {
	it('permanently redirects to the current events page', () => {
		try {
			load();
		} catch (error) {
			expect(error).toMatchObject({ status: 308, location: '/events' });
			return;
		}

		throw new Error('Expected the roadmap loader to redirect');
	});
});
