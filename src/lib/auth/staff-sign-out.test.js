import { afterEach, describe, expect, it, vi } from 'vitest';
import { endStaffSession } from './staff-sign-out.js';

afterEach(() => vi.unstubAllGlobals());

describe('staff sign out client', () => {
	it('uses the same-origin Better Auth POST endpoint without exposing session data', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(endStaffSession()).resolves.toBe(true);
		expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-out', {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json'
			},
			body: '{}'
		});
	});

	it.each([
		new Response('unavailable', { status: 503 }),
		new Response(JSON.stringify({ success: false }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		}),
		new Response('not json', { status: 200 }),
		new Error('network secret')
	])('returns one generic failure for %#', async (outcome) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				if (outcome instanceof Error) throw outcome;
				return outcome;
			})
		);
		const failure = await endStaffSession().catch((error) => error);
		expect(failure).toEqual(new Error('Sign out is unavailable'));
		expect(failure.message).not.toContain('secret');
	});
});
