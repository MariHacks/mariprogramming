// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MariToolsUnavailableError } from '$lib/server/maritools/repository.js';
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
		getBoardBySlug: vi.fn(async () => BOARD),
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

function event({ params = { slug: 'study-group' } } = {}) {
	return { params };
}

describe('free-time board page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('loads a board by slug', async () => {
		const current = handlers();
		await expect(current.load(event())).resolves.toMatchObject({
			board: { slug: 'study-group', title: 'Study group' }
		});
		expect(current.store.getBoardBySlug).toHaveBeenCalledWith('study-group');
	});

	it('returns not found for a missing board', async () => {
		const missing = handlers({ store: { getBoardBySlug: vi.fn(async () => null) } });
		await expect(missing.load(event())).resolves.toMatchObject({ notFound: true, board: null });
	});

	it('returns unavailable when the store is down', async () => {
		const down = handlers({
			store: {
				getBoardBySlug: vi.fn(async () => {
					throw new MariToolsUnavailableError();
				})
			}
		});
		await expect(down.load(event())).resolves.toMatchObject({ unavailable: true, board: null });
		const closed = handlers({
			createStore: vi.fn(() => {
				throw new MariToolsUnavailableError();
			})
		});
		await expect(closed.load(event())).resolves.toMatchObject({ unavailable: true });
	});

	it('rethrows unexpected errors', async () => {
		const boom = handlers({
			store: {
				getBoardBySlug: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(boom.load(event())).rejects.toThrow('boom');
	});
});
