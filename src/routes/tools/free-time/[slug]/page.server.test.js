// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { ServerConfigurationError } from '$lib/server/config/environment.js';
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
	const students = {
		getProfile: vi.fn(async () => ({ displayName: 'Zhicheng' })),
		...overrides.students
	};
	return {
		..._createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: 'https://example.com' })),
			createStore: vi.fn(() => store),
			createStudentStore: vi.fn(() => students),
			...overrides
		}),
		store,
		students
	};
}

function event({ params = { slug: 'study-group' }, locals = { maritools: null } } = {}) {
	return { params, locals };
}

function saveEvent(fields, params = { slug: 'study-group' }) {
	return {
		params,
		request: {
			formData: async () => {
				const data = new FormData();
				const withDefaults = { weekStart: '2026-08-24', ...fields };
				for (const [key, value] of Object.entries(withDefaults)) {
					if (value === undefined) continue;
					data.set(key, value);
				}
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
			shareUrl: 'https://example.com/tools/free-time/study-group',
			signedInDisplayName: null
		});
		expect(current.store.getBoardBySlug).toHaveBeenCalledWith('study-group');
	});

	it('loads the signed-in account schedule for Omnivox import', async () => {
		const current = handlers({
			students: {
				getProfile: vi.fn(async () => ({ displayName: 'Zhicheng' })),
				getSchedule: vi.fn(async () => '1\tSaved schedule')
			}
		});
		await expect(
			current.load(
				event({ locals: { maritools: { userId: 'user-1', email: 'nick.zhicheng@gmail.com' } } })
			)
		).resolves.toMatchObject({ savedSchedulePaste: '1\tSaved schedule' });
	});

	it('prefers the student profile display name when signed in', async () => {
		const current = handlers();
		await expect(
			current.load(
				event({ locals: { maritools: { email: 'nick.zhicheng@gmail.com', userId: 'u1' } } })
			)
		).resolves.toMatchObject({ signedInDisplayName: 'Zhicheng' });
		expect(current.students.getProfile).toHaveBeenCalledWith('u1');
	});

	it('falls back to the email local-part when the profile has no display name', async () => {
		const current = handlers({
			students: { getProfile: vi.fn(async () => ({ displayName: null })) }
		});
		await expect(
			current.load(
				event({ locals: { maritools: { email: 'nick.zhicheng@gmail.com', userId: 'u1' } } })
			)
		).resolves.toMatchObject({ signedInDisplayName: 'nick.zhicheng' });
	});

	it('keeps account lookup failures from blocking a signed-in board', async () => {
		const rejectedLookups = handlers({
			students: {
				getProfile: vi.fn(async () => {
					throw new Error('profile unavailable');
				}),
				getSchedule: vi.fn(async () => {
					throw new Error('schedule unavailable');
				})
			}
		});
		await expect(
			rejectedLookups.load(
				event({ locals: { maritools: { email: '@example.com', userId: 'u1' } } })
			)
		).resolves.toMatchObject({ signedInDisplayName: null, savedSchedulePaste: '' });

		const nullSchedule = handlers({
			students: {
				getProfile: vi.fn(async () => ({ displayName: '   ' })),
				getSchedule: vi.fn(async () => null)
			}
		});
		await expect(
			nullSchedule.load(
				event({ locals: { maritools: { email: 'ada@example.com', userId: 'u1' } } })
			)
		).resolves.toMatchObject({ signedInDisplayName: 'ada', savedSchedulePaste: '' });

		const unavailableStudentStore = handlers({
			createStudentStore: vi.fn(() => {
				throw new Error('student store unavailable');
			})
		});
		await expect(
			unavailableStudentStore.load(
				event({ locals: { maritools: { email: 'ada@example.com', userId: 'u1' } } })
			)
		).resolves.toMatchObject({ signedInDisplayName: 'ada', savedSchedulePaste: '' });
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

	it('returns unavailable when server configuration is missing', async () => {
		const current = handlers({
			readEnvironment: vi.fn(() => {
				throw new ServerConfigurationError();
			})
		});
		await expect(current.load(event())).resolves.toMatchObject({ unavailable: true, board: null });
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

	it('saves member availability for the requested week', async () => {
		const current = handlers();
		await expect(
			current.actions.saveMember(
				saveEvent({
					displayName: 'Ada',
					shareToken: '',
					weekStart: '2026-08-24',
					freeJson: JSON.stringify(['Mon-09:00'])
				})
			)
		).resolves.toMatchObject({ saveSuccess: true, member: { displayName: 'Ada' } });
		expect(current.store.upsertMemberAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				availability: { version: 2, byWeek: { '2026-08-24': ['Mon-09:00'] } }
			})
		);
	});

	it('merges the saved week into existing per-week availability', async () => {
		const current = handlers({
			store: {
				getBoardBySlug: vi.fn(async () => ({
					...BOARD,
					members: [
						{
							id: 'm1',
							displayName: 'Ada',
							shareToken: 'token-1',
							availability: {
								version: 2,
								byWeek: { '2026-08-24': ['Mon-09:00'] }
							}
						}
					]
				})),
				upsertMemberAvailability: vi.fn(async ({ availability }) => ({
					id: '80000000-0000-4000-8000-000000000001',
					displayName: 'Ada',
					availability,
					shareToken: 'token-1'
				}))
			}
		});
		await expect(
			current.actions.saveMember(
				saveEvent({
					displayName: 'Ada',
					shareToken: 'token-1',
					weekStart: '2026-08-31',
					freeJson: JSON.stringify(['Tue-11:00'])
				})
			)
		).resolves.toMatchObject({ saveSuccess: true });
		expect(current.store.upsertMemberAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				availability: {
					version: 2,
					byWeek: {
						'2026-08-24': ['Mon-09:00'],
						'2026-08-31': ['Tue-11:00']
					}
				}
			})
		);
	});

	it('rejects a weekStart that is not a Monday', async () => {
		const current = handlers();
		await expect(
			current.actions.saveMember(
				saveEvent({
					displayName: 'Ada',
					shareToken: '',
					weekStart: '2026-08-25',
					freeJson: '[]'
				})
			)
		).resolves.toMatchObject({ status: 400 });
	});

	it('treats missing form fields as empty when weekStart is present', async () => {
		const current = handlers();
		await expect(
			current.actions.saveMember(saveEvent({ weekStart: '2026-08-24' }))
		).resolves.toMatchObject({
			saveSuccess: true
		});
	});

	it('rejects saves without a weekStart', async () => {
		const current = handlers();
		await expect(
			current.actions.saveMember(
				saveEvent({ displayName: 'Ada', shareToken: '', freeJson: '[]', weekStart: undefined })
			)
		).resolves.toMatchObject({ status: 400 });
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
