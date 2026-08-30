// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MaritoolsUnavailableError } from '$lib/server/maritools/community-store.js';
import { _createPublicProfileHandlers } from './+page.server.js';

const USER = 'user-1';
const THREAD = '20000000-0000-4000-8000-000000000001';

function setup(overrides = {}) {
	const store = {
		getPublicProfile: vi.fn(async () => ({
			userId: USER,
			displayName: 'Ada',
			role: 'student',
			isRestricted: false
		})),
		listThreadsByAuthor: vi.fn(async () => [
			{ id: THREAD, title: 'Quiet study hall', createdAt: '2026-08-28T16:00:00.000Z' }
		]),
		...overrides.store
	};
	const handlers = _createPublicProfileHandlers({
		createStore: vi.fn(() => store),
		...overrides
	});
	return { handlers, store };
}

describe('public profile load', () => {
	it('loads a public profile and recent threads for anyone', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.load({ params: { userId: USER }, locals: {} })
		).resolves.toMatchObject({
			profile: { displayName: 'Ada', userId: USER },
			threads: [{ id: THREAD, title: 'Quiet study hall' }],
			unavailable: false,
			viewerSignedIn: false
		});
		expect(store.getPublicProfile).toHaveBeenCalledWith(USER);
		expect(store.listThreadsByAuthor).toHaveBeenCalledWith(USER);
	});

	it('marks the viewer as signed in when a session exists', async () => {
		const { handlers } = setup();
		await expect(
			handlers.load({ params: { userId: USER }, locals: { maritools: { userId: 'viewer' } } })
		).resolves.toMatchObject({ viewerSignedIn: true });
	});

	it('404s when the profile is missing', async () => {
		const { handlers } = setup({
			store: {
				getPublicProfile: vi.fn(async () => null)
			}
		});
		await expect(handlers.load({ params: { userId: USER }, locals: {} })).rejects.toMatchObject({
			status: 404
		});
	});

	it('returns unavailable when the store is down', async () => {
		const { handlers } = setup({
			createStore: vi.fn(() => {
				throw new MaritoolsUnavailableError();
			})
		});
		await expect(handlers.load({ params: { userId: USER }, locals: {} })).resolves.toMatchObject({
			profile: null,
			threads: [],
			unavailable: true
		});
	});
});
