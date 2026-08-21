// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	BookWorkConflictError,
	BookWorkNotFoundError,
	BookWorkValidationError
} from '$lib/server/books/work-repository.js';
import { StaffActionRequestError } from '$lib/server/staff/request.js';
import { _createBookWorkHandlers } from './+page.server.js';

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});
const REQUEST_ID = '60000000-0000-4000-8000-000000000001';
const LINE_ID = '50000000-0000-4000-8000-000000000001';
const STORE_ID = '10000000-0000-4000-8000-000000000001';
const RUNTIME = Object.freeze({
	databaseUrl: 'postgresql://staff:secret@db.example.com/club',
	approvedHostnames: ['shop.example.com']
});
const BOARD = Object.freeze({ totalRows: 0, groups: [], bookstores: [] });

function setup(overrides = {}) {
	const repository = {
		openBoard: vi.fn(async () => BOARD),
		recordPickup: vi.fn(async () => ({ remaining: 1, replayed: false })),
		assignRequestBookstore: vi.fn(async () => ({ version: 2 })),
		...overrides.repository
	};
	const guardMutation = vi.fn(async (_event, options) => ({
		staff: STAFF,
		form: {
			kind: 'order_line',
			parentId: REQUEST_ID,
			lineId: LINE_ID,
			version: '4',
			quantity: '1',
			clientRequestId: REQUEST_ID,
			requestId: REQUEST_ID,
			bookstoreId: STORE_ID,
			...overrides.form
		},
		requestId: REQUEST_ID,
		runtime: RUNTIME,
		action: options.action
	}));
	const handlers = _createBookWorkHandlers({
		authorize: vi.fn(() => STAFF),
		readEnvironment: vi.fn(() => RUNTIME),
		createRepository: vi.fn(() => repository),
		guardMutation,
		...overrides
	});
	return { handlers, repository, guardMutation };
}

function event() {
	return {
		locals: { staff: STAFF },
		request: new Request('https://club.example.com/staff/book-work', { method: 'POST' })
	};
}

describe('staff book work load', () => {
	it('authorizes staff and opens the pickup board', async () => {
		const { handlers, repository } = setup();
		await expect(handlers.load({ locals: { staff: STAFF } })).resolves.toEqual({
			board: BOARD,
			unavailable: false
		});
		expect(repository.openBoard).toHaveBeenCalledOnce();
	});

	it('returns an unavailable board when the pickup query fails', async () => {
		const { handlers } = setup({
			repository: {
				openBoard: vi.fn(async () => {
					throw new Error('Failed query: SELECT FROM book_pickups');
				})
			}
		});
		await expect(handlers.load({ locals: { staff: STAFF } })).resolves.toEqual({
			board: { totalRows: 0, groups: [], bookstores: [] },
			unavailable: true
		});
	});

	it('returns an unavailable board when staff configuration cannot be read', async () => {
		const { handlers } = setup({
			readEnvironment: vi.fn(() => {
				throw new Error('Server configuration is unavailable');
			})
		});
		await expect(handlers.load({ locals: { staff: STAFF } })).resolves.toMatchObject({
			unavailable: true
		});
	});
});

describe('staff book work pickup', () => {
	it('records an order-line pickup and reports remaining copies', async () => {
		const { handlers, repository } = setup();
		await expect(handlers.actions.pickup(event())).resolves.toMatchObject({
			success: true,
			message: '1 copies remaining.'
		});
		expect(repository.recordPickup).toHaveBeenCalledWith(
			expect.objectContaining({
				ref: { kind: 'order_line', orderId: REQUEST_ID, lineId: LINE_ID },
				quantity: 1,
				version: 4
			})
		);
	});

	it('drains Discord after a successful pickup', async () => {
		const drain = vi.fn(async () => ({ delivered: 1 }));
		const { handlers } = setup({
			readRelayEnvironment: vi.fn(() => ({
				databaseUrl: RUNTIME.databaseUrl,
				appOrigin: 'https://club.example.com',
				cronSecret: 'cron-secret-with-at-least-32-characters',
				discordWebhookUrl: ''
			})),
			createNotificationRelay: vi.fn(() => ({ drain }))
		});
		await expect(handlers.actions.pickup(event())).resolves.toMatchObject({ success: true });
		await vi.waitFor(() => expect(drain).toHaveBeenCalled());
	});

	it('records a request-item pickup using the request identity', async () => {
		const { handlers, repository } = setup({ form: { kind: 'request_item' } });
		await expect(handlers.actions.pickup(event())).resolves.toMatchObject({ success: true });
		expect(repository.recordPickup).toHaveBeenCalledWith(
			expect.objectContaining({
				ref: { kind: 'request_item', requestId: REQUEST_ID, itemId: LINE_ID }
			})
		);
	});

	it('announces a replayed pickup without changing remaining copy copy', async () => {
		const { handlers } = setup({
			repository: { recordPickup: vi.fn(async () => ({ remaining: 1, replayed: true })) }
		});
		await expect(handlers.actions.pickup(event())).resolves.toMatchObject({
			message: 'Pickup already recorded.'
		});
	});

	it('maps staff mutation failures to a generic pickup error', async () => {
		const { handlers } = setup({
			guardMutation: vi.fn(async () => {
				throw new StaffActionRequestError(403, 'csrf');
			})
		});
		await expect(handlers.actions.pickup(event())).resolves.toMatchObject({
			status: 403,
			data: { errorSummary: 'The pickup could not be verified.' }
		});
	});

	it('propagates unexpected guard failures', async () => {
		const { handlers } = setup({
			guardMutation: vi.fn(async () => {
				throw new Error('session exploded');
			})
		});
		await expect(handlers.actions.pickup(event())).rejects.toThrow('session exploded');
	});

	it.each([
		[new BookWorkConflictError(), 409, 'This book work changed. Reload and try again.'],
		[new BookWorkNotFoundError(), 404, 'This book is no longer available.'],
		[new BookWorkValidationError(), 400, 'Check the copy count and try again.']
	])('maps %s to a staff-visible failure', async (error, status, summary) => {
		const { handlers } = setup({
			repository: {
				recordPickup: vi.fn(async () => {
					throw error;
				})
			}
		});
		await expect(handlers.actions.pickup(event())).resolves.toMatchObject({
			status,
			data: { errorSummary: summary }
		});
	});

	it('propagates unexpected pickup failures', async () => {
		const { handlers } = setup({
			repository: {
				recordPickup: vi.fn(async () => {
					throw new Error('database exploded');
				})
			}
		});
		await expect(handlers.actions.pickup(event())).rejects.toThrow('database exploded');
	});
});

describe('staff book work assign', () => {
	it('assigns a bookstore to an unassigned request', async () => {
		const { handlers, repository } = setup();
		await expect(handlers.actions.assign(event())).resolves.toEqual({
			success: true,
			message: 'Request assigned.'
		});
		expect(repository.assignRequestBookstore).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: REQUEST_ID,
				bookstoreId: STORE_ID,
				version: 4
			})
		);
	});

	it('drains Discord after a successful assign and swallows drain failures', async () => {
		const drain = vi.fn(async () => {
			throw new Error('discord down');
		});
		const createSink = vi.fn(() => ({ deliver: vi.fn() }));
		const { handlers } = setup({
			readRelayEnvironment: vi.fn(() => ({
				databaseUrl: RUNTIME.databaseUrl,
				appOrigin: 'https://club.example.com',
				cronSecret: 'cron-secret-with-at-least-32-characters',
				discordWebhookUrl:
					'https://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests'
			})),
			createDiscordSink: createSink,
			createNotificationRelay: vi.fn(() => ({ drain }))
		});
		await expect(handlers.actions.assign(event())).resolves.toMatchObject({ success: true });
		await vi.waitFor(() => expect(drain).toHaveBeenCalled());
		expect(createSink).toHaveBeenCalledOnce();
	});

	it('maps staff mutation failures to a generic assignment error', async () => {
		const { handlers } = setup({
			guardMutation: vi.fn(async () => {
				throw new StaffActionRequestError(415, 'multipart');
			})
		});
		await expect(handlers.actions.assign(event())).resolves.toMatchObject({
			status: 415,
			data: { errorSummary: 'The assignment could not be verified.' }
		});
	});

	it('propagates unexpected assign guard failures', async () => {
		const { handlers } = setup({
			guardMutation: vi.fn(async () => {
				throw new Error('guard exploded');
			})
		});
		await expect(handlers.actions.assign(event())).rejects.toThrow('guard exploded');
	});

	it('maps a conflict while assigning', async () => {
		const { handlers } = setup({
			repository: {
				assignRequestBookstore: vi.fn(async () => {
					throw new BookWorkConflictError();
				})
			}
		});
		await expect(handlers.actions.assign(event())).resolves.toMatchObject({ status: 409 });
	});
});
