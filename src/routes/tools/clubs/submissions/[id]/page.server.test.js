// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError
} from '$lib/server/maritools/student-store.js';
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
	category: 'Games and recreation',
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
		rejectPendingClub: vi.fn(async () => ({ ...SUBMISSION, status: 'rejected' })),
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

function event({ locals = {}, form = {}, entries = [], id = SUBMISSION.id } = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(form)) data.set(key, String(value));
	for (const [key, value] of entries) data.append(key, String(value));
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

	it('treats a missing submission as not found', async () => {
		const current = handlers({ store: { getClubSubmission: vi.fn(async () => null) } });
		await expect(current.load(event({ locals: { maritools: STAFF } }))).resolves.toMatchObject({
			notFound: true,
			submission: null
		});
	});

	it('loads anonymously when there is no session', async () => {
		const current = handlers({ store: { getClubSubmission: vi.fn(async () => null) } });
		await expect(current.load(event())).resolves.toMatchObject({ notFound: true });
	});

	it('keeps staff context when profile lookup is unavailable', async () => {
		const current = handlers({
			store: {
				getProfile: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(current.load(event({ locals: { maritools: STAFF } }))).resolves.toMatchObject({
			canPublish: true,
			staff: true
		});
	});

	it('grants staff through the profile role', async () => {
		const current = handlers({
			store: {
				getProfile: vi.fn(async () => ({ role: 'staff' })),
				isStaff: vi.fn((_email, role) => role === 'staff')
			}
		});
		await expect(current.load(event({ locals: { maritools: SESSION } }))).resolves.toMatchObject({
			canPublish: true,
			staff: true
		});
	});

	it('rethrows unexpected profile errors', async () => {
		const current = handlers({
			store: {
				getProfile: vi.fn(async () => {
					throw new Error('profile boom');
				})
			}
		});
		await expect(current.load(event({ locals: { maritools: STAFF } }))).rejects.toThrow(
			'profile boom'
		);
	});

	it('returns unavailable when the store is down', async () => {
		const current = handlers({
			store: {
				getClubSubmission: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(current.load(event({ locals: { maritools: SESSION } }))).resolves.toMatchObject({
			unavailable: true,
			signedIn: true
		});
	});

	it('rethrows unexpected load errors', async () => {
		const current = handlers({
			store: {
				getClubSubmission: vi.fn(async () => {
					throw new Error('load boom');
				})
			}
		});
		await expect(current.load(event({ locals: { maritools: SESSION } }))).rejects.toThrow(
			'load boom'
		);
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
					category: 'Games and recreation',
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
				links: [{ type: 'custom', label: 'Discord', url: 'https://example.com/discord' }]
			})
		);
	});

	it('saves role, category, and multiple selected contact methods', async () => {
		const current = handlers();
		const result = await current.actions.save(
			event({
				locals: { maritools: SESSION },
				form: {
					name: 'Chess Club',
					category: 'Academic',
					submitterRole: 'member',
					description: 'Weekly play'
				},
				entries: [
					['contactType', 'email'],
					['contactLabel', ''],
					['contactValue', 'chess@example.com'],
					['contactType', 'instagram'],
					['contactLabel', ''],
					['contactValue', 'https://instagram.com/chess']
				]
			})
		);
		expect(result).toEqual({ saved: true });
		expect(current.store.updateClubSubmissionPayload).toHaveBeenCalledWith(
			SUBMISSION.id,
			expect.objectContaining({
				submitterRole: 'member',
				category: 'Academic',
				links: [
					{ type: 'email', label: 'Email', url: 'mailto:chess@example.com' },
					{ type: 'instagram', label: 'Instagram', url: 'https://instagram.com/chess' }
				]
			})
		);
	});

	it('saves when optional fields and slug are empty', async () => {
		const current = handlers({
			store: {
				getClubSubmission: vi.fn(async () => ({
					...SUBMISSION,
					submitterRole: null,
					slug: 'kept-slug'
				}))
			}
		});
		const data = new FormData();
		data.set('name', '!!!');
		data.set('submitterRole', 'member');
		data.set('category', 'Games and recreation');
		const result = await current.actions.save({
			locals: { maritools: SESSION },
			params: { id: SUBMISSION.id },
			request: { formData: async () => data }
		});
		expect(result).toEqual({ saved: true });
		expect(current.store.updateClubSubmissionPayload).toHaveBeenCalledWith(
			SUBMISSION.id,
			expect.objectContaining({
				name: '!!!',
				slug: 'kept-slug'
			})
		);
	});

	it('rejects save without a session or name', async () => {
		expect((await handlers().actions.save(event({ form: { name: 'Chess' } }))).status).toBe(401);
		expect(
			(await handlers().actions.save(event({ locals: { maritools: SESSION }, form: { name: '' } })))
				.status
		).toBe(400);
		expect(
			(await handlers().actions.save(event({ locals: { maritools: SESSION }, form: {} }))).status
		).toBe(400);
	});

	it('rejects save for missing, foreign, or non-pending listings', async () => {
		const missing = handlers({ store: { getClubSubmission: vi.fn(async () => null) } });
		expect(
			(
				await missing.actions.save(
					event({ locals: { maritools: SESSION }, form: { name: 'Chess' } })
				)
			).status
		).toBe(404);
		const foreign = handlers({
			store: {
				getClubSubmission: vi.fn(async () => ({ ...SUBMISSION, submitterUserId: 'other' }))
			}
		});
		expect(
			(
				await foreign.actions.save(
					event({ locals: { maritools: SESSION }, form: { name: 'Chess' } })
				)
			).status
		).toBe(403);
		const published = handlers({
			store: {
				getClubSubmission: vi.fn(async () => ({ ...SUBMISSION, status: 'published' }))
			}
		});
		expect(
			(
				await published.actions.save(
					event({ locals: { maritools: SESSION }, form: { name: 'Chess' } })
				)
			).status
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

	it('rejects for staff and redirects to the clubs index', async () => {
		const current = handlers();
		await expect(
			current.actions.reject(event({ locals: { maritools: STAFF } }))
		).rejects.toMatchObject({
			status: 303,
			location: '/tools/clubs'
		});
		expect(current.store.rejectPendingClub).toHaveBeenCalledWith(SUBMISSION.id);
	});

	it('rejects reject for students', async () => {
		expect(
			(await handlers().actions.reject(event({ locals: { maritools: SESSION } }))).status
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
			(await down.actions.save(event({ locals: { maritools: SESSION }, form: { name: 'Chess' } })))
				.status
		).toBe(503);
		const invalidSave = handlers({
			store: {
				updateClubSubmissionPayload: vi.fn(async () => {
					throw new MaritoolsInputError('not-pending');
				})
			}
		});
		expect(
			(
				await invalidSave.actions.save(
					event({ locals: { maritools: SESSION }, form: { name: 'Chess' } })
				)
			).status
		).toBe(400);
		const invalid = handlers({
			store: {
				publishPendingClub: vi.fn(async () => {
					throw new MaritoolsInputError('invalid-club');
				})
			}
		});
		expect((await invalid.actions.publish(event({ locals: { maritools: STAFF } }))).status).toBe(
			400
		);
		const publishDown = handlers({
			store: {
				publishPendingClub: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(await publishDown.actions.publish(event({ locals: { maritools: STAFF } }))).status
		).toBe(503);
		const rejectInvalid = handlers({
			store: {
				rejectPendingClub: vi.fn(async () => {
					throw new MaritoolsInputError('missing-submission');
				})
			}
		});
		expect(
			(await rejectInvalid.actions.reject(event({ locals: { maritools: STAFF } }))).status
		).toBe(400);
		const rejectDown = handlers({
			store: {
				rejectPendingClub: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect((await rejectDown.actions.reject(event({ locals: { maritools: STAFF } }))).status).toBe(
			503
		);
	});

	it('rethrows unexpected action errors', async () => {
		const saveBoom = handlers({
			store: {
				updateClubSubmissionPayload: vi.fn(async () => {
					throw new Error('save boom');
				})
			}
		});
		await expect(
			saveBoom.actions.save(event({ locals: { maritools: SESSION }, form: { name: 'Chess' } }))
		).rejects.toThrow('save boom');
		const publishBoom = handlers({
			store: {
				publishPendingClub: vi.fn(async () => {
					throw new Error('publish boom');
				})
			}
		});
		await expect(
			publishBoom.actions.publish(event({ locals: { maritools: STAFF } }))
		).rejects.toThrow('publish boom');
		const rejectBoom = handlers({
			store: {
				rejectPendingClub: vi.fn(async () => {
					throw new Error('reject boom');
				})
			}
		});
		await expect(
			rejectBoom.actions.reject(event({ locals: { maritools: STAFF } }))
		).rejects.toThrow('reject boom');
	});
});
