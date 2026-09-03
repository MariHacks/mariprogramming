import { describe, expect, it } from 'vitest';
import { load } from './+layout.server.js';

describe('staff layout authorization', () => {
	it('exempts only the public sign-in page', () => {
		expect(
			load(
				/** @type {any} */ ({
					locals: { staff: null },
					url: new URL('https://club.example.com/staff/sign-in')
				})
			)
		).toEqual({ staff: null, pathname: '/staff/sign-in' });
	});

	it('sends an active staff session past sign-in into the console', () => {
		const staff = Object.freeze({ userId: 'user-123', email: 'team@marihacks.com' });
		expect(() =>
			load(
				/** @type {any} */ ({
					locals: { staff },
					url: new URL('https://club.example.com/staff/sign-in')
				})
			)
		).toThrowError(expect.objectContaining({ status: 303, location: '/staff' }));
	});

	it.each(['/staff', '/staff/orders', '/staff/catalogue'])(
		'redirects unauthenticated %s',
		(path) => {
			expect(() =>
				load(
					/** @type {any} */ ({
						locals: { staff: null },
						url: new URL(`https://club.example.com${path}`)
					})
				)
			).toThrowError(
				expect.objectContaining({ status: 303, location: '/staff/sign-in?state=reauthenticate' })
			);
		}
	);

	it('returns the server-established local for protected pages', () => {
		const staff = Object.freeze({ userId: 'user-123', email: 'team@marihacks.com' });
		expect(
			load(
				/** @type {any} */ ({ locals: { staff }, url: new URL('https://club.example.com/staff') })
			)
		).toEqual({ staff, pathname: '/staff' });
	});
});
