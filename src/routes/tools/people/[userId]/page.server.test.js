// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError
} from '$lib/server/maritools/community-store.js';
import { _createPublicProfileHandlers } from './+page.server.js';

const USER = 'user-1';
const THREAD = '20000000-0000-4000-8000-000000000001';
const STAFF = { userId: 'staff-1', email: 'team@marihacks.com' };
/** @type {Array<{ action: 'mute' | 'ban' | 'unmute' | 'unban', method: 'muteUser' | 'banUser' | 'unmuteUser' | 'unbanUser', form: Record<string, string> }>} */
const MODERATION_ACTIONS = [
	{ action: 'mute', method: 'muteUser', form: { mutePreset: '1h' } },
	{ action: 'ban', method: 'banUser', form: { banPreset: '1d' } },
	{ action: 'unmute', method: 'unmuteUser', form: {} },
	{ action: 'unban', method: 'unbanUser', form: {} }
];

/** @param {{ store?: Record<string, any>, createStore?: () => any }} [overrides] */
function setup(overrides = {}) {
	const store = {
		getPublicProfile: vi.fn(async () => ({
			userId: USER,
			displayName: 'Ada',
			role: 'student',
			studentId: '2530622',
			isRestricted: false,
			isMuted: false,
			isBanned: false
		})),
		listThreadsByAuthor: vi.fn(async () => [
			{ id: THREAD, title: 'Quiet study hall', createdAt: '2026-08-28T16:00:00.000Z' }
		]),
		listOutlinesByAuthor: vi.fn(async () => [
			{
				sha256: 'a'.repeat(64),
				createdAt: '2026-08-20T16:00:00.000Z',
				extraction: { proposals: { courseCode: '420-202-RE', title: 'Programming II' } }
			}
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

/** @param {{ locals?: any, form?: Record<string, unknown>, params?: { userId?: string } }} [options] */
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
		await expect(handlers.load({ params: { userId: USER }, locals: {} })).resolves.toMatchObject({
			profile: { displayName: 'Ada', userId: USER },
			threads: [{ id: THREAD, title: 'Quiet study hall' }],
			courseOutlines: [
				expect.objectContaining({
					sha256: 'a'.repeat(64),
					extraction: { proposals: { courseCode: '420-202-RE', title: 'Programming II' } }
				})
			],
			unavailable: false,
			viewerSignedIn: false,
			viewerIsStaff: false
		});
		expect(store.getPublicProfile).toHaveBeenCalledWith(USER);
		expect(store.listThreadsByAuthor).toHaveBeenCalledWith(USER);
		expect(store.listOutlinesByAuthor).toHaveBeenCalledWith(USER);
		expect(
			await handlers.load({ params: { userId: USER }, locals: {} })
		).not.toHaveProperty('profile.isMuted');
		expect(JSON.stringify(await handlers.load({ params: { userId: USER }, locals: {} }))).not.toContain(
			'2530622'
		);
	});

	it('marks the viewer as signed in when a session exists', async () => {
		const { handlers } = setup({
			store: {
				isStaff: vi.fn(() => false),
				getProfile: vi.fn(async () => ({ userId: 'viewer', role: 'student' }))
			}
		});
		await expect(
			handlers.load({
				params: { userId: USER },
				locals: { maritools: { userId: 'viewer', email: 'a@b.com' } }
			})
		).resolves.toMatchObject({ viewerSignedIn: true, viewerIsStaff: false });
	});

	it('checks team access with a null role when the viewer profile is missing', async () => {
		const isStaff = vi.fn(() => false);
		const { handlers } = setup({
			store: {
				getProfile: vi.fn(async () => null),
				isStaff
			}
		});
		await expect(
			handlers.load({ params: { userId: USER }, locals: { maritools: STAFF } })
		).resolves.toMatchObject({ viewerSignedIn: true, viewerIsStaff: false });
		expect(isStaff).toHaveBeenCalledWith(STAFF.email, null);
	});

	it('continues without viewer role data when that lookup is unavailable', async () => {
		const isStaff = vi.fn(() => true);
		const { handlers } = setup({
			store: {
				getProfile: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				}),
				isStaff
			}
		});
		await expect(
			handlers.load({ params: { userId: USER }, locals: { maritools: STAFF } })
		).resolves.toMatchObject({ viewerIsStaff: true, profile: { isMuted: false } });
		expect(isStaff).toHaveBeenCalledWith(STAFF.email, null);
	});

	it('rejects an empty profile id', async () => {
		const { handlers } = setup();
		await expect(handlers.load({ params: {}, locals: {} })).rejects.toMatchObject({ status: 404 });
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
			courseOutlines: [],
			unavailable: true
		});
	});

	it('reports unavailable to a signed-in viewer', async () => {
		const { handlers } = setup({
			createStore: vi.fn(() => {
				throw new MaritoolsUnavailableError();
			})
		});
		await expect(
			handlers.load({ params: { userId: USER }, locals: { maritools: STAFF } })
		).resolves.toMatchObject({ unavailable: true, viewerSignedIn: true, viewerIsStaff: false });
	});

	it('rethrows unexpected viewer and public profile errors', async () => {
		const viewerError = new Error('viewer lookup failed');
		const viewerSetup = setup({
			store: {
				getProfile: vi.fn(async () => {
					throw viewerError;
				})
			}
		});
		await expect(
			viewerSetup.handlers.load({ params: { userId: USER }, locals: { maritools: STAFF } })
		).rejects.toBe(viewerError);

		const profileError = new Error('profile lookup failed');
		const profileSetup = setup({
			store: {
				getPublicProfile: vi.fn(async () => {
					throw profileError;
				})
			}
		});
		await expect(profileSetup.handlers.load({ params: { userId: USER }, locals: {} })).rejects.toBe(
			profileError
		);
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
		await expect(handlers.actions.ban(actionEvent({ form: { banPreset: '7d' } }))).resolves.toEqual(
			{ moderated: 'ban' }
		);
		expect(store.banUser).toHaveBeenCalledWith(
			USER,
			expect.objectContaining({ until: expect.any(Date) })
		);
	});

	it('applies a permanent ban for staff', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.actions.ban(actionEvent({ form: { banPreset: 'permanent' } }))
		).resolves.toEqual({ moderated: 'ban' });
		expect(store.banUser).toHaveBeenCalledWith(USER, { permanent: true });
	});

	it('unmutes and unbans for staff', async () => {
		const { handlers, store } = setup();
		await expect(handlers.actions.unmute(actionEvent())).resolves.toEqual({ moderated: 'unmute' });
		await expect(handlers.actions.unban(actionEvent())).resolves.toEqual({ moderated: 'unban' });
		expect(store.unmuteUser).toHaveBeenCalledWith(USER);
		expect(store.unbanUser).toHaveBeenCalledWith(USER);
	});

	it.each(MODERATION_ACTIONS)(
		'rejects $action moderation without team access',
		async ({ action, form }) => {
			const { handlers } = setup({ store: { isStaff: vi.fn(() => false) } });
			await expect(handlers.actions[action](actionEvent({ form }))).resolves.toMatchObject({
				status: 403
			});
		}
	);

	it.each(MODERATION_ACTIONS)(
		'maps $action input and availability errors and rethrows unknown errors',
		async ({ action, method, form }) => {
			for (const [thrown, status] of [
				[new MaritoolsInputError(), 400],
				[new MaritoolsUnavailableError(), 503]
			]) {
				const { handlers } = setup({
					store: {
						[method]: vi.fn(async () => {
							throw thrown;
						})
					}
				});
				await expect(handlers.actions[action](actionEvent({ form }))).resolves.toMatchObject({
					status
				});
			}

			const unexpected = new Error(`${action} failed`);
			const { handlers } = setup({
				store: {
					[method]: vi.fn(async () => {
						throw unexpected;
					})
				}
			});
			await expect(handlers.actions[action](actionEvent({ form }))).rejects.toBe(unexpected);
		}
	);

	it.each(MODERATION_ACTIONS)(
		'normalizes a missing $action profile id',
		async ({ action, method, form }) => {
			const { handlers, store } = setup();
			await expect(
				handlers.actions[action](actionEvent({ form, params: {} }))
			).resolves.toMatchObject({
				moderated: action
			});
			if (action === 'mute' || action === 'ban') {
				expect(store[method]).toHaveBeenCalledWith('', expect.any(Object));
			} else {
				expect(store[method]).toHaveBeenCalledWith('');
			}
		}
	);
});
