// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
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

	it('does not create a submission for invalid or signed-out requests', async () => {
		const store = { submitClub: vi.fn() };
		const handlers = _createHandlers({ createStore: () => store });
		expect((await handlers.actions.submit(event({ complete: false }))).status).toBe(400);
		expect((await handlers.actions.submit(event({ session: null }))).status).toBe(401);
		expect(store.submitClub).not.toHaveBeenCalled();
	});
});
