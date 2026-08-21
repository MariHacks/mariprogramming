// @vitest-environment node

import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { createNotificationRelay } from './relay.js';

describe('Postmark notification relay', () => {
	it('enrolls and leases only paid orders with the fields needed for one confirmation', async () => {
		const leased = {
			audit_id: 'audit-paid',
			attempts: 1,
			action: 'stripe_completed_applied',
			next_state: {},
			order_id: '123e4567-e89b-42d3-a456-426614174000',
			attempt_id: '123e4567-e89b-42d3-a456-426614174001',
			order_reference: 'MPC-ABCDEFGH2345',
			order_email: 'student@example.com',
			order_total_cents: 7598,
			order_titles: ['Calculus', 'Programming in C'],
			order_book_count: 2,
			order_bookstores: ['Campus']
		};
		const results = [[{ audit_id: 'audit-paid' }], [leased], []];
		const database = { execute: vi.fn(async () => ({ rows: results.shift() ?? [] })) };
		const deliver = vi.fn(async () => ({ disposition: 'delivered' }));
		const relay = createNotificationRelay({
			databaseUrl: 'postgresql://example.invalid/books',
			sinkName: 'postmark',
			actions: ['stripe_completed_applied'],
			sink: { deliver },
			runTransaction: (operation) => operation(database),
			getNow: () => new Date('2026-08-20T12:00:00Z')
		});

		await expect(relay.drain()).resolves.toMatchObject({ delivered: 1 });
		expect(deliver).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 'order_paid',
				orderId: leased.order_id,
				attemptId: leased.attempt_id,
				reference: leased.order_reference,
				recipient: leased.order_email,
				totalCents: 7598,
				titles: leased.order_titles
			})
		);

		const dialect = new PgDialect();
		const queries = /** @type {any} */ (database.execute).mock.calls.map(
			(/** @type {any[]} */ [query]) => dialect.sqlToQuery(query)
		);
		expect(queries[0].params).toContain('postmark');
		expect(queries[0].params).toContain('stripe_completed_applied');
		expect(queries[1].params).toContain('postmark');
		expect(queries[1].sql).toContain('o.customer_email');
		expect(queries[1].sql).toContain('ca.id AS attempt_id');
		expect(queries[2].params).toContain('postmark');
	});
});
