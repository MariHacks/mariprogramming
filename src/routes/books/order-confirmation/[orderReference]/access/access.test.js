import { describe, expect, it, vi } from 'vitest';
import { openEmailedOrder } from './access.js';

const CAPABILITY = Buffer.alloc(32, 1).toString('base64url');

describe('emailed order access', () => {
	it('removes the fragment, exchanges it for the secure cookie, and opens the receipt', async () => {
		/** @type {string[]} */
		const sequence = [];
		const location = {
			hash: `#${CAPABILITY}`,
			pathname: '/books/order-confirmation/MPC-ABCDEFGHJK23/access',
			search: '',
			replace: vi.fn(() => sequence.push('opened'))
		};
		const history = {
			replaceState: vi.fn(() => {
				sequence.push('fragment-cleared');
				location.hash = '';
			})
		};
		const fetchImpl = vi.fn(async (_url, request) => {
			sequence.push('exchanged');
			expect(location.hash).toBe('');
			expect(JSON.parse(request.body)).toEqual({ capability: CAPABILITY });
			return new Response(null, { status: 204 });
		});

		await expect(openEmailedOrder({ location, history, fetchImpl })).resolves.toBe(true);
		expect(sequence).toEqual(['fragment-cleared', 'exchanged', 'opened']);
		expect(fetchImpl).toHaveBeenCalledWith(location.pathname, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ capability: CAPABILITY })
		});
		expect(location.replace).toHaveBeenCalledWith('/books/order-confirmation/MPC-ABCDEFGHJK23');
	});

	it.each(['', '#short', '#bad/value', `#${CAPABILITY}extra`])(
		'fails locally for an invalid fragment %j',
		async (hash) => {
			const fetchImpl = vi.fn();
			await expect(
				openEmailedOrder({
					location: {
						hash,
						pathname: '/books/order-confirmation/MPC-ABCDEFGHJK23/access',
						search: '',
						replace: vi.fn()
					},
					history: { replaceState: vi.fn() },
					fetchImpl
				})
			).resolves.toBe(false);
			expect(fetchImpl).not.toHaveBeenCalled();
		}
	);

	it('does not redirect when the exchange is rejected', async () => {
		const location = {
			hash: `#${CAPABILITY}`,
			pathname: '/books/order-confirmation/MPC-ABCDEFGHJK23/access',
			search: '',
			replace: vi.fn()
		};
		await expect(
			openEmailedOrder({
				location,
				history: { replaceState: vi.fn() },
				fetchImpl: vi.fn(async () => new Response(null, { status: 404 }))
			})
		).resolves.toBe(false);
		expect(location.replace).not.toHaveBeenCalled();
	});

	it('keeps the recovery page visible when the exchange request fails', async () => {
		const location = {
			hash: `#${CAPABILITY}`,
			pathname: '/books/order-confirmation/MPC-ABCDEFGHJK23/access',
			search: '',
			replace: vi.fn()
		};
		await expect(
			openEmailedOrder({
				location,
				history: { replaceState: vi.fn() },
				fetchImpl: vi.fn(async () => {
					throw new Error('network unavailable');
				})
			})
		).resolves.toBe(false);
		expect(location.replace).not.toHaveBeenCalled();
	});
});
