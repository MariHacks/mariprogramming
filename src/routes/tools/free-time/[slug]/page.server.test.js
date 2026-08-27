// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MariToolsNotFoundError, MariToolsUnavailableError, MariToolsValidationError } from '$lib/server/maritools/repository.js';
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
		upsertMemberAvailability: vi.fn(async () => ({
			id: '80000000-0000-4000-8000-000000000001',
			displayName: 'Ada',
			availability: { version: 1, free: ['Mon-09:00'] },
			shareToken: 'token-1'
		})),
		...overrides.store
	};
	return {
		..._createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: 'https://example.com' })),
			createStore: vi.fn(() => store),
			...overrides
		}),
		store
	};
}

function event({ params = { slug: 'study-group' } } = {}) {
	return { params };
}

function saveEvent(fields, params = { slug: 'study-group' }) {
	return {
		params,
		request: {
			formData: async () => {
				const data = new FormData();
				for (const [key, value] of Object.entries(fields)) data.set(key, value);
				return data;
			}
		}
	};
}

describe('free-time board page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('loads a board by slug', async () => {
		const current = handlers();
		await expect(current.load(event())).resolves.toMatchObject({
			board: { slug: 'study-group', title: 'Study group' },
			shareUrl: 'https://example.com/tools/free-time/study-group'
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

	it('saves member availability', async () => {
		const current = handlers();
		await expect(
			current.actions.saveMember(
				saveEvent({
					displayName: 'Ada',
					shareToken: '',
					freeJson: JSON.stringify(['Mon-09:00'])
				})
			)
		).resolves.toMatchObject({ saveSuccess: true, member: { displayName: 'Ada' } });
	});

	it('treats missing form fields as empty', async () => {
		const current = handlers();
		await expect(current.actions.saveMember(saveEvent({}))).resolves.toMatchObject({
			saveSuccess: true
		});
	});

	it('treats missing form fields as empty', async () => {
		const current = handlers();
		await expect(current.actions.saveMember(saveEvent({}))).resolves.toMatchObject({
			saveSuccess: true
		});
	});

	it('rejects invalid availability json', async () => {
		const current = handlers();
		await expect(
			current.actions.saveMember(
				saveEvent({ displayName: 'Ada', shareToken: '', freeJson: '{bad' })
			)
		).resolves.toMatchObject({ status: 400 });
	});

	it('returns not found when saving to a missing board', async () => {
		const missing = handlers({ store: { getBoardBySlug: vi.fn(async () => null) } });
		await expect(
			missing.actions.saveMember(
				saveEvent({ displayName: 'Ada', shareToken: '', freeJson: '[]' })
			)
		).resolves.toMatchObject({ status: 404 });
	});

	it('maps validation failures while saving', async () => {
		const invalid = handlers({
			store: {
				getBoardBySlug: vi.fn(async () => BOARD),
				upsertMemberAvailability: vi.fn(async () => {
					throw new MariToolsValidationError();
				})
			}
		});
		await expect(
			invalid.actions.saveMember(
				saveEvent({ displayName: '   ', shareToken: '', freeJson: '[]' })
			)
		).resolves.toMatchObject({ status: 400 });
	});

	it('maps not-found and unavailable save failures', async () => {
		const missing = handlers({
			store: {
				getBoardBySlug: vi.fn(async () => BOARD),
				upsertMemberAvailability: vi.fn(async () => {
					throw new MariToolsNotFoundError();
				})
			}
		});
		await expect(
			missing.actions.saveMember(
				saveEvent({ displayName: 'Ada', shareToken: 'old', freeJson: '[]' })
			)
		).resolves.toMatchObject({ status: 404 });

		const down = handlers({
			store: {
				getBoardBySlug: vi.fn(async () => BOARD),
				upsertMemberAvailability: vi.fn(async () => {
					throw new MariToolsUnavailableError();
				})
			}
		});
		await expect(
			down.actions.saveMember(saveEvent({ displayName: 'Ada', shareToken: '', freeJson: '[]' }))
		).resolves.toMatchObject({ status: 503 });

		const boom = handlers({
			store: {
				getBoardBySlug: vi.fn(async () => BOARD),
				upsertMemberAvailability: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			boom.actions.saveMember(saveEvent({ displayName: 'Ada', shareToken: '', freeJson: '[]' }))
		).rejects.toThrow('boom');
	});

	it('rejects a non-array availability payload', async () => {
		const current = handlers();
		await expect(
			current.actions.saveMember(
				saveEvent({ displayName: 'Ada', shareToken: 'token', freeJson: '{}' })
			)
		).resolves.toMatchObject({ status: 400 });
	});

	it('ignores non-string availability cells and missing json', async () => {
		const current = handlers();
		await expect(
			current.actions.saveMember(saveEvent({ displayName: 'Ada', shareToken: '' }))
		).resolves.toMatchObject({ saveSuccess: true });
		await expect(
			current.actions.saveMember(
				saveEvent({
					displayName: 'Ada',
					shareToken: '',
					freeJson: JSON.stringify(['Mon-09:00', 12])
				})
			)
		).resolves.toMatchObject({ saveSuccess: true });
	});
});

