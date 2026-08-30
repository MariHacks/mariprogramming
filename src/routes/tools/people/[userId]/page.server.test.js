// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MaritoolsUnavailableError } from '$lib/server/maritools/community-store.js';
import { _createPublicProfileHandlers } from './+page.server.js';

const USER = 'user-1';
const THREAD = '20000000-0000-4000-8000-000000000001';
const STAFF = { userId: 'staff-1', email: 'team@marihacks.com' };

function setup(overrides = {}) {
	const store = {
		getPublicProfile: vi.fn(async () => ({
			userId: USER,
			displayName: 'Ada',
			role: 'student',
			isRestricted: false,
			isMuted: false,
			isBanned: false
		})),
		listThreadsByAuthor: vi.fn(async () => [
			{ id: THREAD, title: 'Quiet study hall', createdAt: '2026-08-28T16:00:00.000Z' }
		]),
		getProfile: vi.fn(async () => ({ userId: STAFF.userId, role: 'staff' })),
		isStaff: vi.fn((email) => email === 'team@marihacks.com'),
		muteUser: vi.fn(async () => ({ userId: USER, isMuted: true })),
		banUser: vi.fn(async () => ({ userId: USER, isBanned: true })),
		unmuteUser: vi.fn(async () => ({ userId: USER, isMuted: false })),
		unbanUser: vi.fn(async () => ({ userId: USER, isBanned: false })),
		...overrides.store
	};
	const handlers = _createPublicProfileHandlers({
		createStore: vi.fn(() => store),
		...overrides
	});
	return { handlers, store };
}

function actionEvent({ locals = { maritools: STAFF }, form = {}, params = { userId: USER } } = {}) {
	return {
		locals,
		params,
		request: {
			formData: async () => {
				const data = new FormData();
				for (const [key, value] of Object.entries(form)) data.set(key, String(value));
				return data;
			}
		}
	};
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
			viewerSignedIn: false,
			viewerIsStaff: false
		});
		expect(store.getPublicProfile).toHaveBeenCalledWith(USER);
		expect(store.listThreadsByAuthor).toHaveBeenCalledWith(USER);
	});

	it('marks the viewer as signed in when a session exists', async () => {
		const { handlers } = setup({
			store: {
				isStaff: vi.fn(() => false),
				getProfile: vi.fn(async () => ({ userId: 'viewer', role: 'student' }))
			}
		});
		await expect(
			handlers.load({ params: { userId: USER }, locals: { maritools: { userId: 'viewer', email: 'a@b.com' } } })
		).resolves.toMatchObject({ viewerSignedIn: true, viewerIsStaff: false });
	});

	it('exposes staff moderation for staff viewers', async () => {
		const { handlers } = setup();
		await expect(
			handlers.load({ params: { userId: USER }, locals: { maritools: STAFF } })
		).resolves.toMatchObject({ viewerIsStaff: true });
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

	it('mutes with a chosen duration for staff', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.actions.mute(actionEvent({ form: { mutePreset: '1d' } }))
		).resolves.toEqual({ moderated: 'mute' });
		expect(store.muteUser).toHaveBeenCalledWith(
			USER,
			expect.objectContaining({ until: expect.any(Date) })
		);
	});

	it('applies a timed ban for staff', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.actions.ban(actionEvent({ form: { banPreset: '7d' } }))
		).resolves.toEqual({ moderated: 'ban' });
		expect(store.banUser).toHaveBeenCalledWith(
			USER,
			expect.objectContaining({ until: expect.any(Date) })
		);
	});

	it('unmutes and unbans for staff', async () => {
		const { handlers, store } = setup();
		await expect(handlers.actions.unmute(actionEvent())).resolves.toEqual({ moderated: 'unmute' });
		await expect(handlers.actions.unban(actionEvent())).resolves.toEqual({ moderated: 'unban' });
		expect(store.unmuteUser).toHaveBeenCalledWith(USER);
		expect(store.unbanUser).toHaveBeenCalledWith(USER);
	});

	it('rejects moderation from non-staff', async () => {
		const { handlers } = setup({
			store: { isStaff: vi.fn(() => false) }
		});
		expect((await handlers.actions.mute(actionEvent({ form: { mutePreset: '1h' } }))).status).toBe(
			403
		);
	});
});
