// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError
} from '$lib/server/maritools/community-store.js';
import { _createHandlers } from './+page.server.js';

const SESSION = { userId: 'user-1', email: 'member@example.com' };

function event({ session = SESSION, complete = true } = {}) {
	const data = new FormData();
	if (complete) {
		data.set('name', 'Chess Club');
		data.set('submitterRole', 'officer');
		data.set('category', 'Games and recreation');
		data.set('description', 'Weekly games');
	}
	return { locals: { maritools: session }, request: { formData: async () => data } };
}

describe('new club listing server', () => {
	it('redirects signed-out loads and accepts signed-in loads', () => {
		const handlers = _createHandlers();
		expect(() => handlers.load(event({ session: /** @type {any} */ (null) }))).toThrowError(
			expect.objectContaining({ status: 303, location: '/tools/account' })
		);
		expect(handlers.load(event())).toEqual({});
	});

	it('creates one pending submission only after valid details are submitted', async () => {
		const store = { submitClub: vi.fn(async () => ({ id: 'submission-1' })) };
		const handlers = _createHandlers({ createStore: () => store });
		await expect(handlers.actions.submit(event())).rejects.toMatchObject({
			status: 303,
			location: '/tools/clubs/submissions/submission-1'
		});
		expect(store.submitClub).toHaveBeenCalledWith(
			expect.objectContaining({
				submitterUserId: 'user-1',
				payload: expect.objectContaining({ name: 'Chess Club', submitterRole: 'officer' })
			})
		);
	});

	it.each([
		[
			'a missing submission id',
			vi.fn(async () => null),
			503,
			'Sending the listing is unavailable. Try again.'
		],
		[
			'invalid stored details',
			vi.fn(async () => {
				throw new MaritoolsInputError('invalid');
			}),
			400,
			'Check the club details and try again.'
		],
		[
			'an unavailable store',
			vi.fn(async () => {
				throw new MaritoolsUnavailableError();
			}),
			503,
			'Sending the listing is unavailable. Try again.'
		]
	])('returns a bounded error for %s', async (_case, submitClub, status, error) => {
		const handlers = _createHandlers({ createStore: () => ({ submitClub }) });

		expect(await handlers.actions.submit(event())).toMatchObject({ status, data: { error } });
	});

	it('does not create a submission for invalid or signed-out requests', async () => {
		const store = { submitClub: vi.fn() };
		const handlers = _createHandlers({ createStore: () => store });
		expect((await handlers.actions.submit(event({ complete: false }))).status).toBe(400);
		expect(
			(await handlers.actions.submit(event({ session: /** @type {any} */ (null) }))).status
		).toBe(401);
		expect(store.submitClub).not.toHaveBeenCalled();
	});
});
