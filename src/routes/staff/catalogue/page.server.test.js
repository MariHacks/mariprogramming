// @ts-nocheck
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { load } from './+page.server.js';

describe('staff catalogue index', () => {
	it('requires the persisted staff local before choosing a resource', () => {
		expect(() => load({ locals: { staff: null } })).toThrowError(
			expect.objectContaining({ status: 303, location: '/staff/sign-in?state=reauthenticate' })
		);
	});

	it('redirects authorized staff to catalogue entries', () => {
		expect(() =>
			load({
				locals: {
					staff: { userId: 'staff-user', email: 'team@marihacks.com' }
				}
			})
		).toThrowError(expect.objectContaining({ status: 303, location: '/staff/catalogue/entries' }));
	});
});
