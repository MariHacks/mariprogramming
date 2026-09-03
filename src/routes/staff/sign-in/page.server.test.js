import { describe, expect, it, vi } from 'vitest';
import { _createLoad } from './+page.server.js';

describe('staff sign-in server data', () => {
	it('provides the one canonical post-authentication callback', () => {
		const readEnvironment = vi.fn(() => ({ appOrigin: 'https://club.example.com' }));
		expect(
			_createLoad({ readEnvironment })({ url: new URL('https://club.example.com/staff/sign-in') })
		).toEqual({
			callbackURL: 'https://club.example.com/staff',
			recoveryMessage: null
		});
		expect(readEnvironment).toHaveBeenCalledOnce();
	});

	it.each([
		['unavailable', "We couldn't complete sign-in. Try again."],
		['reauthenticate', 'Your team session is no longer active. Sign in again.']
	])('maps the fixed %s state to a generic recovery message', (state, recoveryMessage) => {
		const load = _createLoad({
			readEnvironment: () => ({ appOrigin: 'https://club.example.com' })
		});
		expect(
			load({
				url: new URL(
					`https://club.example.com/staff/sign-in?state=${state}&error=provider-secret&next=https://evil.example`
				)
			})
		).toEqual({ callbackURL: 'https://club.example.com/staff', recoveryMessage });
	});

	it.each(['unknown', '', 'UNAVAILABLE', 'unavailable-too-long'])(
		'ignores unknown state %s',
		(state) => {
			const load = _createLoad({
				readEnvironment: () => ({ appOrigin: 'https://club.example.com' })
			});
			const url = new URL('https://club.example.com/staff/sign-in');
			if (state) url.searchParams.set('state', state);
			expect(load({ url })).toEqual({
				callbackURL: 'https://club.example.com/staff',
				recoveryMessage: null
			});
		}
	);
});
