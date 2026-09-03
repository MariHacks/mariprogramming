import { describe, expect, it, vi } from 'vitest';
import { _createRootLayoutLoad } from './+layout.server.js';

describe('root layout load', () => {
	it('returns signed-out header state without a session', async () => {
		const load = _createRootLayoutLoad();
		const result = await load({ locals: {} });
		expect(result).toEqual({ headerAccount: { kind: 'signed-out' } });
	});

	it('returns signed-in header state from the student profile', async () => {
		const load = _createRootLayoutLoad({
			createRepository: () => ({
				getProfile: vi.fn().mockResolvedValue({ displayName: 'Maya Singh' })
			})
		});
		const result = await load({
			locals: { maritools: { userId: 'u1', email: 'maya.singh@example.com' } }
		});
		expect(result).toEqual({
			headerAccount: {
				kind: 'signed-in',
				displayName: 'Maya Singh',
				initials: 'MS'
			}
		});
	});

	it('falls back to signed-in email identity when profile lookup fails', async () => {
		const load = _createRootLayoutLoad({
			createRepository: () => ({
				getProfile: vi.fn().mockRejectedValue(new Error('down'))
			})
		});
		const result = await load({
			locals: { maritools: { userId: 'u1', email: 'maya.singh@example.com' } }
		});
		expect(result.headerAccount).toEqual({
			kind: 'signed-in',
			displayName: 'maya.singh',
			initials: 'MA'
		});
	});
});
