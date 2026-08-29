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
const SUBMISSION = {
	id: '60000000-0000-4000-8000-000000000001',
	status: 'pending',
	submitterUserId: SESSION.userId,
	submitterRole: 'officer',
	name: 'Chess',
	slug: 'chess',
	category: 'games',
	description: 'Play',
	links: [{ label: 'Site', url: 'https://example.com' }]
};

function handlers(overrides = {}) {
	const store = {
		getProfile: vi.fn(async () => null),
		isStaff: vi.fn((email, role) => email === 'team@marihacks.com' || role === 'staff'),
		getClubSubmission: vi.fn(async () => SUBMISSION),
		updateClubSubmissionPayload: vi.fn(async () => SUBMISSION),
		publishPendingClub: vi.fn(async () => ({ slug: 'chess' })),
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

function event({ locals = {}, form = {}, id = SUBMISSION.id } = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(form)) data.set(key, String(value));
	return {
		locals,
		params: { id },
		request: { formData: async () => data }
	};
}

describe('club submission page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('lets the owner edit a pending submission', async () => {
		const current = handlers();
		await expect(current.load(event({ locals: { maritools: SESSION } }))).resolves.toMatchObject({
			submission: SUBMISSION,
			canEdit: true,
			canPublish: false,
			isOwner: true
		});
	});

	it('lets staff review and publish', async () => {
		const current = handlers();
		await expect(current.load(event({ locals: { maritools: STAFF } }))).resolves.toMatchObject({
			canEdit: true,
			canPublish: true,
			staff: true
		});
	});

	it('hides submissions from unrelated students', async () => {
		const current = handlers();
		await expect(
			current.load(event({ locals: { maritools: { ...SESSION, userId: 'other' } } }))
		).resolves.toMatchObject({ notFound: true, submission: null });
	});

	it('saves listing edits without changing the submitter role', async () => {
		const current = handlers();
		const result = await current.actions.save(
			event({
				locals: { maritools: SESSION },
				form: {
					name: 'Chess Club',
					category: 'games',
					description: 'Weekly play',
					linkLabel: 'Discord',
					linkUrl: 'https://example.com/discord'
				}
			})
		);
		expect(result).toEqual({ saved: true });
		expect(current.store.updateClubSubmissionPayload).toHaveBeenCalledWith(
			SUBMISSION.id,
			expect.objectContaining({
				name: 'Chess Club',
				slug: 'chess-club',
				submitterRole: 'officer',
				links: [{ label: 'Discord', url: 'https://example.com/discord' }]
			})
		);
	});

	it('rejects save without a session or name', async () => {
		expect((await handlers().actions.save(event({ form: { name: 'Chess' } }))).status).toBe(401);
		expect(
			(await handlers().actions.save(event({ locals: { maritools: SESSION }, form: { name: '' } })))
				.status
		).toBe(400);
	});

	it('publishes for staff and redirects to the clubs index', async () => {
		const current = handlers();
		await expect(
			current.actions.publish(event({ locals: { maritools: STAFF } }))
		).rejects.toMatchObject({
			status: 303,
			location: '/tools/clubs'
		});
		expect(current.store.publishPendingClub).toHaveBeenCalledWith(SUBMISSION.id);
	});

	it('rejects publish for students', async () => {
		expect(
			(await handlers().actions.publish(event({ locals: { maritools: SESSION } }))).status
		).toBe(403);
	});

	it('returns bounded save and publish errors', async () => {
		const down = handlers({
			store: {
				updateClubSubmissionPayload: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(
				await down.actions.save(
					event({ locals: { maritools: SESSION }, form: { name: 'Chess' } })
				)
			).status
		).toBe(503);
		const invalid = handlers({
			store: {
				publishPendingClub: vi.fn(async () => {
					throw new MaritoolsInputError('invalid-club');
				})
			}
		});
		expect((await invalid.actions.publish(event({ locals: { maritools: STAFF } }))).status).toBe(400);
	});
});
