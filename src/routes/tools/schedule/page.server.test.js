// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import { _createHandlers, prerender } from './+page.server.js';

describe('schedule form action', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('exposes only named actions so pushGoogleCalendar can run', () => {
		const { actions } = _createHandlers();
		expect(actions.default).toBeUndefined();
		expect(typeof actions.pushGoogleCalendar).toBe('function');
		expect(typeof actions.saveSchedule).toBe('function');
	});

	it('loads calendar connection state for signed-in users', async () => {
		const openStore = vi.fn(() => ({
			hasGrant: vi.fn().mockResolvedValue(true)
		}));
		const openStudentStore = vi.fn(() => ({
			getSchedule: vi.fn(async () => CANONICAL_OMNIVOX_SCHEDULE)
		}));
		const { load } = _createHandlers({ openStore, openStudentStore });
		const data = await load({
			locals: { maritools: { userId: 'user-1', email: 'student@example.com' } },
			url: new URL('https://example.com/tools/schedule')
		});
		expect(data.googleCalendarConnected).toBe(true);
		expect(data.signedIn).toBe(true);
		expect(data.savedPaste).toBe(CANONICAL_OMNIVOX_SCHEDULE);
	});

	it('saves a valid schedule to the signed-in account', async () => {
		const saveSchedule = vi.fn(async () => undefined);
		const { actions } = _createHandlers({
			openStudentStore: () => ({ saveSchedule })
		});
		const data = new FormData();
		data.set('paste', CANONICAL_OMNIVOX_SCHEDULE);

		await expect(
			actions.saveSchedule({
				locals: { maritools: { userId: 'user-1' } },
				request: { formData: async () => data }
			})
		).resolves.toMatchObject({ saved: true });
		expect(saveSchedule).toHaveBeenCalledWith({
			userId: 'user-1',
			paste: CANONICAL_OMNIVOX_SCHEDULE
		});
	});

	it('does not expose manual schedule-sharing actions', () => {
		const { actions } = _createHandlers();
		expect(actions).not.toHaveProperty('shareWithClub');
		expect(actions).not.toHaveProperty('stopSharingWithClub');
	});

	it('requires an account and a valid paste before saving a schedule', async () => {
		const { actions } = _createHandlers({
			openStudentStore: () => ({ saveSchedule: vi.fn() })
		});
		const empty = { formData: async () => new FormData() };

		expect((await actions.saveSchedule({ locals: {}, request: empty })).status).toBe(401);
		expect(
			(
				await actions.saveSchedule({
					locals: { maritools: { userId: 'user-1' } },
					request: empty
				})
			).status
		).toBe(400);
	});

	it('maps unavailable schedule saves and rethrows unexpected failures', async () => {
		const { MaritoolsUnavailableError } = await import('$lib/server/maritools/student-store.js');
		const data = new FormData();
		data.set('paste', CANONICAL_OMNIVOX_SCHEDULE);
		const event = {
			locals: { maritools: { userId: 'user-1' } },
			request: { formData: async () => data }
		};
		const down = _createHandlers({
			openStudentStore: () => ({
				saveSchedule: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			})
		});
		expect((await down.actions.saveSchedule(event)).status).toBe(503);

		const boom = _createHandlers({
			openStudentStore: () => ({
				saveSchedule: vi.fn(async () => {
					throw new Error('boom');
				})
			})
		});
		await expect(boom.actions.saveSchedule(event)).rejects.toThrow('boom');
	});

	it('requires sign-in to push to Google Calendar', async () => {
		const { actions } = _createHandlers();
		const response = await actions.pushGoogleCalendar({
			locals: {},
			request: {
				formData: async () => new FormData()
			}
		});
		expect(response.status).toBe(401);
	});

	it('loads signed-out visitors without a calendar grant', async () => {
		const { load } = _createHandlers();
		await expect(
			load({ locals: {}, url: new URL('https://example.com/tools/schedule?gcal=connected') })
		).resolves.toMatchObject({
			signedIn: false,
			savedPaste: '',
			googleCalendarConnected: false,
			gcalStatus: 'connected'
		});
	});

	it('swallows unavailable grant lookups and rethrows other errors', async () => {
		const { MariToolsUnavailableError } = await import('$lib/server/maritools/repository.js');
		const down = _createHandlers({
			openStore: () => ({
				hasGrant: vi.fn().mockRejectedValue(new MariToolsUnavailableError())
			})
		});
		await expect(
			down.load({
				locals: { maritools: { userId: 'user-1' } },
				url: new URL('https://example.com/tools/schedule')
			})
		).resolves.toMatchObject({ googleCalendarConnected: false, signedIn: true });

		const boom = _createHandlers({
			openStore: () => ({
				hasGrant: vi.fn().mockRejectedValue(new Error('boom'))
			})
		});
		await expect(
			boom.load({
				locals: { maritools: { userId: 'user-1' } },
				url: new URL('https://example.com/tools/schedule')
			})
		).rejects.toThrow('boom');
	});

	it('rethrows unexpected saved-schedule lookup failures', async () => {
		const { load } = _createHandlers({
			openStore: () => ({ hasGrant: vi.fn(async () => false) }),
			openStudentStore: () => ({
				getSchedule: vi.fn(async () => {
					throw new Error('schedule read failed');
				})
			})
		});

		await expect(
			load({
				locals: { maritools: { userId: 'user-1' } },
				url: new URL('https://example.com/tools/schedule')
			})
		).rejects.toThrow('schedule read failed');
	});

	it('validates paste and term before pushing', async () => {
		const { actions } = _createHandlers({
			readEnvironment: () => ({
				googleClientId: 'id',
				googleClientSecret: 'secret',
				appOrigin: 'https://example.com'
			})
		});
		const empty = await actions.pushGoogleCalendar({
			locals: { maritools: { userId: 'user-1' } },
			request: {
				formData: async () => new FormData()
			}
		});
		expect(empty.status).toBe(400);

		const data = new FormData();
		data.set('paste', CANONICAL_OMNIVOX_SCHEDULE);
		data.set('termId', 'not-a-term');
		const missingTerm = await actions.pushGoogleCalendar({
			locals: { maritools: { userId: 'user-1' } },
			request: { formData: async () => data }
		});
		expect(missingTerm.status).toBe(400);
	});

	it('pushes a valid schedule and maps failures', async () => {
		const { MariToolsUnavailableError } = await import('$lib/server/maritools/repository.js');
		const pushSchedule = vi.fn().mockResolvedValue({ inserted: 3 });
		const { actions } = _createHandlers({
			readEnvironment: () => ({
				googleClientId: 'id',
				googleClientSecret: 'secret',
				appOrigin: 'https://example.com'
			}),
			openStore: () => ({}),
			pushSchedule
		});
		const data = new FormData();
		data.set('paste', CANONICAL_OMNIVOX_SCHEDULE);
		data.set('termId', 'fall-2026');
		await expect(
			actions.pushGoogleCalendar({
				locals: { maritools: { userId: 'user-1' } },
				request: { formData: async () => data }
			})
		).resolves.toMatchObject({ pushSuccess: '3 events added to Google Calendar.' });

		const down = _createHandlers({
			readEnvironment: () => ({}),
			openStore: () => ({}),
			pushSchedule: vi.fn().mockRejectedValue(new MariToolsUnavailableError())
		});
		await expect(
			down.actions.pushGoogleCalendar({
				locals: { maritools: { userId: 'user-1' } },
				request: { formData: async () => data }
			})
		).resolves.toMatchObject({ status: 503 });

		const other = _createHandlers({
			readEnvironment: () => ({}),
			openStore: () => ({}),
			pushSchedule: vi.fn().mockRejectedValue(new Error('quota'))
		});
		await expect(
			other.actions.pushGoogleCalendar({
				locals: { maritools: { userId: 'user-1' } },
				request: { formData: async () => data }
			})
		).resolves.toMatchObject({ status: 400 });

		const unknown = _createHandlers({
			readEnvironment: () => ({}),
			openStore: () => ({}),
			pushSchedule: vi.fn().mockRejectedValue('nope')
		});
		await expect(
			unknown.actions.pushGoogleCalendar({
				locals: { maritools: { userId: 'user-1' } },
				request: { formData: async () => data }
			})
		).resolves.toMatchObject({ status: 400 });

		const typed = _createHandlers({
			readEnvironment: () => ({}),
			openStore: () => ({}),
			pushSchedule: vi.fn().mockRejectedValue(new Error('quota'))
		});
		await expect(
			typed.actions.pushGoogleCalendar({
				locals: { maritools: { userId: 'user-1' } },
				request: { formData: async () => data }
			})
		).resolves.toMatchObject({ status: 400 });
	});
});
