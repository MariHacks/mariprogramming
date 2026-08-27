// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	MariToolsConflictError,
	MariToolsUnavailableError,
	MariToolsValidationError
} from '$lib/server/maritools/repository.js';
import { prerender, _createHandlers } from './+page.server.js';

const BOARD = {
	id: '70000000-0000-4000-8000-000000000001',
	slug: 'study-group',
	title: 'Study group',
	termId: 'fall-2026',
	members: []
};

function handlers(overrides = {}) {
	const store = {
		listBoards: vi.fn(async () => [BOARD]),
		createBoard: vi.fn(async () => BOARD),
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

function formEvent(fields) {
	return {
		request: {
			formData: async () => {
				const data = new FormData();
				for (const [key, value] of Object.entries(fields)) data.set(key, value);
				return data;
			}
		},
		locals: { maritools: { userId: 'user-1' } }
	};
}

describe('free-time index page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('loads recent boards', async () => {
		const current = handlers();
		await expect(current.load({})).resolves.toMatchObject({
			boards: [{ slug: 'study-group' }]
		});
		expect(current.store.listBoards).toHaveBeenCalled();
	});

	it('returns empty boards when unavailable', async () => {
		const down = handlers({
			createStore: vi.fn(() => {
				throw new MariToolsUnavailableError();
			})
		});
		await expect(down.load({})).resolves.toMatchObject({ boards: [], unavailable: true });
	});

	it('creates a board from the title when slug is omitted', async () => {
		const current = handlers();
		await expect(
			current.actions.createBoard({
				request: {
					formData: async () => {
						const data = new FormData();
						data.set('title', 'Study group');
						data.set('termId', 'fall-2026');
						return data;
					}
				},
				locals: {}
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/free-time/study-group' });
	});

	it('creates a board and redirects to its slug', async () => {
		const current = handlers();
		await expect(
			current.actions.createBoard(
				formEvent({
					title: 'Study group',
					termId: 'fall-2026',
					slug: 'study-group'
				})
			)
		).rejects.toMatchObject({ status: 303, location: '/tools/free-time/study-group' });
	});

	it('treats missing title and term fields as empty', async () => {
		const invalid = handlers({
			store: {
				createBoard: vi.fn(async () => {
					throw new MariToolsValidationError();
				})
			}
		});
		await expect(
			invalid.actions.createBoard({
				request: { formData: async () => new FormData() },
				locals: {}
			})
		).resolves.toMatchObject({ status: 400 });
	});

	it('returns validation and conflict failures', async () => {
		const invalid = handlers({
			store: {
				createBoard: vi.fn(async () => {
					throw new MariToolsValidationError();
				})
			}
		});
		await expect(
			invalid.actions.createBoard(formEvent({ title: '', termId: 'fall-2026', slug: '' }))
		).resolves.toMatchObject({ status: 400 });

		const conflict = handlers({
			store: {
				createBoard: vi.fn(async () => {
					throw new MariToolsConflictError();
				})
			}
		});
		await expect(
			conflict.actions.createBoard(
				formEvent({ title: 'Study group', termId: 'fall-2026', slug: 'study-group' })
			)
		).resolves.toMatchObject({ status: 409 });
	});

	it('returns unavailable and rethrows unexpected create errors', async () => {
		const down = handlers({
			store: {
				createBoard: vi.fn(async () => {
					throw new MariToolsUnavailableError();
				})
			}
		});
		await expect(
			down.actions.createBoard(
				formEvent({ title: 'Study group', termId: 'fall-2026', slug: 'study-group' })
			)
		).resolves.toMatchObject({ status: 503 });

		const boom = handlers({
			store: {
				createBoard: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			boom.actions.createBoard(
				formEvent({ title: 'Study group', termId: 'fall-2026', slug: 'study-group' })
			)
		).rejects.toThrow('boom');
	});

	it('rethrows unexpected load errors', async () => {
		const boom = handlers({
			store: {
				listBoards: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(boom.load({})).rejects.toThrow('boom');
	});

	it('creates a guest board when no account is present', async () => {
		const current = handlers();
		const event = formEvent({ title: 'Study group', termId: 'fall-2026', slug: '' });
		event.locals = {};
		await expect(current.actions.createBoard(event)).rejects.toMatchObject({
			status: 303,
			location: '/tools/free-time/study-group'
		});
		expect(current.store.createBoard).toHaveBeenCalledWith(
			expect.objectContaining({ ownerUserId: null })
		);
	});

	it('treats omitted board fields as empty strings', async () => {
		const current = handlers();
		await expect(
			current.actions.createBoard({
				request: { formData: async () => new FormData() },
				locals: {}
			})
		).rejects.toMatchObject({
			status: 303,
			location: '/tools/free-time/study-group'
		});
	});
});
