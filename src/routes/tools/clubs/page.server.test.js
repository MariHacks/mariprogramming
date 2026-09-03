// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MaritoolsInputError, MaritoolsUnavailableError } from '$lib/server/maritools/student-store.js';
import { prerender, _createHandlers } from './+page.server.js';

const SESSION = {
	userId: 'user-1',
	sessionId: 'session-1',
	email: 'ada@gmail.com',
	googleSubject: 'sub-1',
	expiresAt: new Date('2030-01-01T00:00:00.000Z')
};
const STAFF = { ...SESSION, email: 'team@marihacks.com' };
const CLUB = {
	id: 'club-1',
	name: 'Robotics',
	slug: 'robotics',
	category: 'stem',
	description: 'Builds robots',
	links: [{ label: 'Discord', url: 'https://example.com' }]
};
const PENDING = {
	id: '60000000-0000-4000-8000-000000000001',
	name: 'Chess',
	slug: 'chess',
	category: 'games',
	description: 'Play',
	links: [],
	submitterRole: 'officer'
};

function handlers(overrides = {}) {
	const store = {
		listClubs: vi.fn(async () => [CLUB, { id: 'club-2', name: 'Robotics extra' }]),
		getProfile: vi.fn(async () => null),
		isStaff: vi.fn((email, role) => email === 'team@marihacks.com' || role === 'staff'),
		listPendingClubSubmissions: vi.fn(async () => [PENDING]),
		submitClub: vi.fn(async () => ({ id: PENDING.id })),
		...overrides.store
	};
	return {
		..._createHandlers({
			createStore: vi.fn(() => store),
			...overrides
		}),
		store
	};
}

function event({ locals = {}, form = {}, search = '' } = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(form)) data.set(key, String(value));
	return {
		locals,
		url: new URL(`https://club.example.com/tools/clubs${search}`),
		request: { formData: async () => data }
	};
}

describe('clubs page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('lists published clubs for anonymous visitors', async () => {
		const current = handlers();
		const data = await current.load(event());
		expect(data.clubs[0]).toEqual(CLUB);
		expect(data.clubs).toHaveLength(2);
		expect(data.staff).toBe(false);
		expect(data.pending).toEqual([]);
		expect(JSON.stringify(data)).not.toMatch(/2530622/);
	});

	it('filters clubs by search and category', async () => {
		const current = handlers();
		expect((await current.load(event({ search: '?q=robot&category=stem' }))).clubs).toEqual([CLUB]);
		expect((await current.load(event({ search: '?q=robot' }))).clubs.map((club) => club.id)).toEqual([
			'club-1',
			'club-2'
		]);
		expect((await current.load(event({ search: '?category=stem' }))).clubs).toEqual([CLUB]);
		expect((await current.load(event({ search: '?q=chess&category=arts' }))).clubs).toEqual([]);
	});

	it('treats the team mailbox as staff even when the profile cannot be read', async () => {
		const current = handlers({
			store: {
				getProfile: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		const data = await current.load(event({ locals: { maritools: STAFF } }));
		expect(data.staff).toBe(true);
		expect(data.pending).toEqual([PENDING]);
	});

	it('treats a staff role as staff', async () => {
		const current = handlers({
			store: { getProfile: vi.fn(async () => ({ role: 'staff', displayName: 'Ada' })) }
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.staff).toBe(true);
		expect(data.signedIn).toBe(true);
	});

	it('rethrows unexpected profile failures', async () => {
		const current = handlers({
			store: {
				getProfile: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(current.load(event({ locals: { maritools: SESSION } }))).rejects.toThrow('boom');
	});

	it('returns an empty list when clubs cannot be read', async () => {
		const current = handlers({
			store: {
				listClubs: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(current.load(event())).resolves.toMatchObject({
			clubs: [],
			unavailable: true
		});
		const closed = handlers({
			createStore: vi.fn(() => {
				throw new MaritoolsUnavailableError();
			})
		});
		await expect(closed.load(event({ locals: { maritools: SESSION } }))).resolves.toMatchObject({
			clubs: [],
			signedIn: true,
			staff: false,
			unavailable: true
		});
		const staffDown = handlers({
			store: {
				getProfile: vi.fn(async () => ({ role: 'staff' })),
				listClubs: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(staffDown.load(event({ locals: { maritools: SESSION } }))).resolves.toMatchObject({
			unavailable: true,
			staff: true,
			signedIn: true
		});
	});

	it('rethrows unexpected load failures', async () => {
		const current = handlers({
			store: {
				listClubs: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(current.load(event())).rejects.toThrow('boom');
	});

	it('starts a pending submission and redirects to the editable detail', async () => {
		const current = handlers();
		await expect(
			current.actions.submit(
				event({
					locals: { maritools: SESSION },
					form: {
						name: 'Chess Club',
						category: 'games',
						submitterRole: 'officer'
					}
				})
			)
		).rejects.toMatchObject({
			status: 303,
			location: `/tools/clubs/submissions/${PENDING.id}`
		});
		expect(current.store.submitClub).toHaveBeenCalledWith({
			submitterUserId: SESSION.userId,
			payload: expect.objectContaining({
				name: 'Chess Club',
				slug: 'chess-club',
				category: 'games',
				submitterRole: 'officer'
			})
		});
		expect(current.store.submitClub.mock.calls[0][0].payload).not.toHaveProperty('description');
	});

	it('rejects submit without a session, name, role, or usable slug', async () => {
		expect((await handlers().actions.submit(event({ form: { name: 'Chess' } }))).status).toBe(401);
		expect(
			(await handlers().actions.submit(event({ locals: { maritools: SESSION } }))).status
		).toBe(400);
		expect(
			(
				await handlers().actions.submit(
					event({ locals: { maritools: SESSION }, form: { name: 'Chess', submitterRole: 'nope' } })
				)
			).status
		).toBe(400);
		expect(
			(
				await handlers().actions.submit(
					event({ locals: { maritools: SESSION }, form: { name: '!!!', submitterRole: 'member' } })
				)
			).status
		).toBe(400);
	});

	it('returns bounded submit errors', async () => {
		const invalid = handlers({
			store: {
				submitClub: vi.fn(async () => {
					throw new MaritoolsInputError('invalid-club');
				})
			}
		});
		expect(
			(
				await invalid.actions.submit(
					event({
						locals: { maritools: SESSION },
						form: { name: 'Chess', submitterRole: 'member' }
					})
				)
			).status
		).toBe(400);
		const down = handlers({
			store: {
				submitClub: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(
				await down.actions.submit(
					event({
						locals: { maritools: SESSION },
						form: { name: 'Chess', submitterRole: 'member' }
					})
				)
			).status
		).toBe(503);
		const boom = handlers({
			store: {
				submitClub: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			boom.actions.submit(
				event({ locals: { maritools: SESSION }, form: { name: 'Chess', submitterRole: 'member' } })
			)
		).rejects.toThrow('boom');
	});
});
