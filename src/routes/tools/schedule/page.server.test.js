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
});
