import { describe, expect, it, vi } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import { _createHandlers, prerender } from './+page.server.js';

describe('schedule form action', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('parses the canonical paste', async () => {
		const { actions } = _createHandlers();
		const result = await actions.default({
			request: {
				formData: async () => {
					const data = new FormData();
					data.set('paste', CANONICAL_OMNIVOX_SCHEDULE);
					return data;
				}
			}
		});
		expect(result.result.ok).toBe(true);
		expect(result.result.courses).toHaveLength(7);
	});

	it('parses empty paste as not ok', async () => {
		const { actions } = _createHandlers();
		const result = await actions.default({
			request: {
				formData: async () => new FormData()
			}
		});
		expect(result.result.ok).toBe(false);
	});

	it('loads calendar connection state for signed-in users', async () => {
		const openStore = vi.fn(() => ({
			hasGrant: vi.fn().mockResolvedValue(true)
		}));
		const { load } = _createHandlers({ openStore });
		const data = await load({
			locals: { maritools: { userId: 'user-1', email: 'student@example.com' } },
			url: new URL('https://example.com/tools/schedule')
		});
		expect(data.googleCalendarConnected).toBe(true);
		expect(data.signedIn).toBe(true);
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
			readEnvironment: () => ({ googleClientId: 'id', googleClientSecret: 'secret', appOrigin: 'https://example.com' }),
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
