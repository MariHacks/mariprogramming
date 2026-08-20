// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { createDiscordSink } from './discord.js';
import { ANNOUNCED_ACTIONS, parseClubFact } from './facts.js';
import { createNotificationRelay } from './relay.js';

describe('notification facts', () => {
	it('enrolls the approved existing and book-work audit actions', () => {
		expect(ANNOUNCED_ACTIONS).toEqual(
			expect.arrayContaining([
				'stripe_completed_applied',
				'staff_fulfillment_purchasing',
				'staff_fulfillment_received',
				'staff_fulfillment_ready_for_pickup',
				'book_request_submitted',
				'book_pickup_recorded',
				'book_request_assigned'
			])
		);
	});

	it('skips unknown audit actions', () => {
		expect(parseClubFact({ action: 'unrelated_action' })).toBeNull();
	});
});

describe('Discord notification sink', () => {
	it('sends only operational fields and excludes student email', async () => {
		const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
		const sink = createDiscordSink({
			webhookUrl: 'https://discord.com/api/webhooks/123/token',
			appOrigin: 'https://club.example.com',
			fetchImpl
		});
		await expect(
			sink.deliver({
				kind: 'book_request_submitted',
				reference: 'REQ-ABCDEFGHJKM2',
				count: 2,
				titles: ['Algorithms', 'Compilers'],
				bookstores: [],
				studentEmail: 'student@example.com'
			})
		).resolves.toEqual({ disposition: 'delivered' });
		const body = fetchImpl.mock.calls[0][1].body;
		expect(body).toContain('REQ-ABCDEFGHJKM2');
		expect(body).toContain('Algorithms');
		expect(body).not.toContain('student@example.com');
	});

	it('returns retry instead of throwing for network failures', async () => {
		const sink = createDiscordSink({
			webhookUrl: 'https://discord.com/api/webhooks/123/token',
			appOrigin: 'https://club.example.com',
			fetchImpl: vi.fn(async () => {
				throw new Error('offline');
			})
		});
		await expect(sink.deliver({ kind: 'order_paid' })).resolves.toMatchObject({
			disposition: 'retry',
			reason: 'network_error'
		});
	});

	it('uses a bounded retry when Discord omits retry_after', async () => {
		const sink = createDiscordSink({
			webhookUrl: 'https://discord.com/api/webhooks/123/token',
			appOrigin: 'https://club.example.com',
			fetchImpl: vi.fn(async () =>
				new Response(JSON.stringify({ message: 'rate limited' }), {
					status: 429,
					headers: { 'content-type': 'application/json' }
				})
			)
		});
		await expect(sink.deliver({ kind: 'order_paid' })).resolves.toMatchObject({
			disposition: 'retry',
			afterSeconds: 30
		});
	});
});

describe('notification relay', () => {
	it('settles a throwing Discord delivery as retry without throwing', async () => {
		const results = [
			[{ audit_id: 'audit-1' }],
			[
				{
					audit_id: 'audit-1',
					attempts: 1,
					action: 'book_request_submitted',
					next_state: {},
					request_reference: 'REQ-ABCDEFGHJKM2',
					request_titles: ['Algorithms'],
					order_titles: [],
					order_book_count: 0,
					order_bookstores: []
				}
			],
			[]
		];
		const database = {
			execute: vi.fn(async () => ({ rows: results.shift() }))
		};
		const relay = createNotificationRelay({
			databaseUrl: 'postgresql://example.invalid/books',
			sink: {
				deliver: vi.fn(async () => {
					throw new Error('Discord is unavailable');
				})
			},
			runTransaction: (operation) => operation(database),
			getNow: () => new Date('2026-08-20T12:00:00Z')
		});
		await expect(relay.drain({ limit: 2, budgetMs: 2000 })).resolves.toMatchObject({
			enrolled: 1,
			attempted: 1,
			retrying: 1
		});
		expect(database.execute).toHaveBeenCalledTimes(3);
	});

	it('delivers, skips, and records dead outcomes', async () => {
		const leased = [
			{
				audit_id: 'audit-paid',
				attempts: 1,
				action: 'stripe_completed_applied',
				next_state: {},
				order_reference: 'MPC-ABCDEFGH2345',
				order_titles: ['Calculus'],
				order_book_count: 1,
				order_bookstores: ['Campus']
			},
			{
				audit_id: 'audit-unknown',
				attempts: 1,
				action: 'unrelated_action',
				next_state: {},
				order_titles: [],
				order_book_count: 0,
				order_bookstores: []
			},
			{
				audit_id: 'audit-dead',
				attempts: 1,
				action: 'book_request_submitted',
				next_state: {},
				request_reference: 'REQ-ABCDEFGH2345',
				request_titles: ['Calculus'],
				order_titles: [],
				order_book_count: 0,
				order_bookstores: []
			}
		];
		const results = [[{ audit_id: 'audit-paid' }], leased, [], [], []];
		const database = { execute: vi.fn(async () => ({ rows: results.shift() ?? [] })) };
		const relay = createNotificationRelay({
			databaseUrl: 'postgresql://example.invalid/books',
			sink: {
				deliver: vi.fn(async (fact) =>
					fact.kind === 'order_paid'
						? { disposition: 'delivered' }
						: { disposition: 'dead', reason: 'payload_rejected' }
				)
			},
			runTransaction: (operation) => operation(database),
			getNow: () => new Date('2026-08-20T12:00:00Z')
		});
		await expect(relay.drain({ limit: 10, budgetMs: 2000 })).resolves.toMatchObject({
			delivered: 1,
			skipped: 1,
			dead: 1,
			attempted: 3
		});
	});

	it('skips delivery when no Discord sink is configured', async () => {
		const results = [
			[],
			[
				{
					audit_id: 'audit-1',
					attempts: 1,
					action: 'book_request_submitted',
					next_state: {},
					request_reference: 'REQ-ABCDEFGH2345',
					request_titles: ['Calculus'],
					order_titles: [],
					order_book_count: 0,
					order_bookstores: []
				}
			],
			[]
		];
		const database = { execute: vi.fn(async () => ({ rows: results.shift() })) };
		const relay = createNotificationRelay({
			databaseUrl: 'postgresql://example.invalid/books',
			sink: null,
			runTransaction: (operation) => operation(database),
			getNow: () => new Date('2026-08-20T12:00:00Z')
		});
		await expect(relay.drain()).resolves.toMatchObject({ skipped: 1, attempted: 1 });
	});

	it('stops leasing work when the drain budget expires', async () => {
		const database = {
			execute: vi.fn(async () => ({
				rows: [
					{
						audit_id: 'audit-1',
						attempts: 1,
						action: 'book_request_submitted',
						next_state: {},
						request_titles: [],
						order_titles: [],
						order_book_count: 0,
						order_bookstores: []
					},
					{
						audit_id: 'audit-2',
						attempts: 1,
						action: 'book_request_submitted',
						next_state: {},
						request_titles: [],
						order_titles: [],
						order_book_count: 0,
						order_bookstores: []
					}
				]
			}))
		};
		const now = Date.now;
		Date.now = vi.fn().mockReturnValueOnce(0).mockReturnValue(10_000);
		try {
			const relay = createNotificationRelay({
				databaseUrl: 'postgresql://example.invalid/books',
				sink: { deliver: vi.fn(async () => ({ disposition: 'delivered' })) },
				runTransaction: (operation) => operation(database),
				getNow: () => new Date('2026-08-20T12:00:00Z')
			});
			await expect(relay.drain({ budgetMs: 1 })).resolves.toMatchObject({ attempted: 0 });
		} finally {
			Date.now = now;
		}
	});

	it('rejects a database handle that cannot execute', async () => {
		const { enrollDeliveriesInTransaction } = await import('./relay.js');
		await expect(
			enrollDeliveriesInTransaction(null, { now: new Date(), limit: 1 })
		).rejects.toThrow('Notification database is unavailable');
		await expect(
			enrollDeliveriesInTransaction(
				{ execute: async () => null },
				{ now: new Date(), limit: 1 }
			)
		).rejects.toThrow('Notification database is unavailable');
	});

	it('marks a delivery dead after the last retry', async () => {
		const results = [
			[],
			[
				{
					audit_id: 'audit-1',
					attempts: 6,
					action: 'book_request_submitted',
					next_state: {},
					request_reference: 'REQ-ABCDEFGH2345',
					request_titles: ['Calculus'],
					order_titles: [],
					order_book_count: 0,
					order_bookstores: []
				}
			],
			[]
		];
		const database = { execute: vi.fn(async () => ({ rows: results.shift() })) };
		const relay = createNotificationRelay({
			databaseUrl: 'postgresql://example.invalid/books',
			sink: {
				deliver: vi.fn(async () => ({ disposition: 'retry' }))
			},
			runTransaction: (operation) => operation(database)
		});
		await expect(relay.drain({ limit: 1, budgetMs: 2000 })).resolves.toMatchObject({
			retrying: 1
		});
		const { settleDeliveryInTransaction } = await import('./relay.js');
		await settleDeliveryInTransaction(
			{ execute: vi.fn(async () => ({ rows: [] })) },
			{
				auditId: 'audit-1',
				outcome: { disposition: 'retry' },
				attempts: 99,
				now: new Date('2026-08-20T12:00:00Z')
			}
		);
	});
});
