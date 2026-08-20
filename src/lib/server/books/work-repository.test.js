// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
	BookWorkConflictError,
	BookWorkNotFoundError,
	BookWorkRateLimitError,
	BookWorkUnavailableError,
	BookWorkValidationError,
	assignRequestBookstoreInTransaction,
	createBookWorkRepository,
	openBoardInTransaction,
	recordPickupInTransaction,
	submitRequestInTransaction
} from './work-repository.js';

const NOW = new Date('2026-08-20T16:00:00.000Z');
const REQUEST_ID = '10000000-0000-4000-8000-000000000001';
const LINE_ID = '20000000-0000-4000-8000-000000000001';
const STORE_ID = '30000000-0000-4000-8000-000000000001';
const COMMAND_ID = '40000000-0000-4000-8000-000000000001';
const HMAC_KEY = 'rate-limit-test-key-that-is-longer-than-thirty-two-characters';

/** @param {import('drizzle-orm').SQL} query */
function queryText(query) {
	return new PgDialect().sqlToQuery(query).sql;
}

/** @param {unknown[][]} batches */
function tx(batches) {
	const remaining = [...batches];
	const execute = vi.fn(async () => {
		const next = remaining.shift();
		if (next === undefined) return { rows: [] };
		return { rows: next };
	});
	return { execute };
}

function otherSubmission(overrides = {}) {
	return {
		clientRequestId: COMMAND_ID,
		student: { name: 'Sam', email: 'sam@example.com' },
		teacher: { source: 'other', name: 'Guest' },
		course: { source: 'other', name: 'Independent' },
		items: [{ title: 'Calculus', author: null, isbn: null, quantity: 1 }],
		note: null,
		outline: null,
		...overrides
	};
}

function pickupCommand(overrides = {}) {
	return {
		ref: { kind: 'order_line', orderId: REQUEST_ID, lineId: LINE_ID },
		version: 1,
		quantity: 2,
		clientRequestId: COMMAND_ID,
		actor: { userId: 'staff', email: 'team@marihacks.com', requestId: 'req' },
		...overrides
	};
}

/** @param {number} windowMs @param {number} [count] */
function rateRow(windowMs, count = 1) {
	return [
		{
			count,
			window_started_at: NOW.toISOString(),
			expires_at: new Date(NOW.getTime() + windowMs).toISOString()
		}
	];
}

describe('book work repository', () => {
	it('replays an identical pickup command and conflicts when the payload differs', async () => {
		const database = tx([
			[
				{
					need_kind: 'order_line',
					order_id: REQUEST_ID,
					order_line_id: LINE_ID,
					request_id: null,
					request_item_id: null,
					quantity: 2
				}
			],
			[
				{
					need_kind: 'order_line',
					order_id: REQUEST_ID,
					order_line_id: LINE_ID,
					request_id: null,
					request_item_id: null,
					quantity: 2
				}
			]
		]);
		const command = pickupCommand();
		await expect(recordPickupInTransaction(database, command, NOW)).resolves.toEqual({
			replayed: true
		});
		await expect(
			recordPickupInTransaction(database, { ...command, quantity: 1 }, NOW)
		).rejects.toBeInstanceOf(BookWorkConflictError);
	});

	it('returns the existing request for a repeated submission key', async () => {
		const result = await submitRequestInTransaction(
			tx([
				[
					{
						id: REQUEST_ID,
						public_reference: 'REQ-ABCDEFGH2345',
						created_at: NOW.toISOString()
					}
				]
			]),
			otherSubmission(),
			NOW,
			() => 'REQ-SHOULDNOTUSE',
			{ hmacKey: HMAC_KEY, requestHeaders: new Headers() }
		);
		expect(result).toMatchObject({
			requestId: REQUEST_ID,
			publicReference: 'REQ-ABCDEFGH2345',
			replayed: true
		});
	});

	it('lists form options from active catalogue rows', async () => {
		const execute = vi
			.fn()
			.mockResolvedValueOnce({ rows: [{ id: REQUEST_ID, name: 'Mme Tremblay' }] })
			.mockResolvedValueOnce({
				rows: [{ id: LINE_ID, code: 'FRE-101', title: 'French 101' }]
			});
		const repository = createBookWorkRepository({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			runTransaction: async (operation) => operation({ execute })
		});
		await expect(repository.listFormOptions()).resolves.toEqual({
			teachers: [{ id: REQUEST_ID, name: 'Mme Tremblay' }],
			courses: [{ id: LINE_ID, code: 'FRE-101', title: 'French 101' }]
		});
		expect(queryText(sql`SELECT 1`)).toContain('SELECT');
	});

	it('rejects a transaction handle that cannot execute', async () => {
		await expect(openBoardInTransaction(null, NOW)).rejects.toBeInstanceOf(
			BookWorkUnavailableError
		);
		await expect(openBoardInTransaction({ execute: async () => null }, NOW)).rejects.toBeInstanceOf(
			BookWorkUnavailableError
		);
	});

	it('inserts a new request, outline, and audit row', async () => {
		const database = tx([
			[],
			rateRow(15 * 60 * 1000),
			rateRow(60 * 60 * 1000),
			[{ id: REQUEST_ID }],
			[],
			[],
			[]
		]);
		const result = await submitRequestInTransaction(
			database,
			otherSubmission({
				outline: {
					filename: 'outline.pdf',
					byteLength: 8,
					sha256: 'a'.repeat(64),
					bytes: new Uint8Array(8)
				}
			}),
			NOW,
			() => 'REQ-ABCDEFGH2345',
			{ hmacKey: HMAC_KEY, requestHeaders: new Headers() }
		);
		expect(result).toEqual({
			requestId: REQUEST_ID,
			publicReference: 'REQ-ABCDEFGH2345',
			submittedAt: NOW.toISOString(),
			replayed: false
		});
		expect(database.execute).toHaveBeenCalledTimes(7);
	});

	it('looks up catalogue labels when the student chose listed teacher and course', async () => {
		const database = tx([
			[],
			[{ id: REQUEST_ID }],
			[],
			[{ name: 'Mme Tremblay' }],
			[{ name: 'FRE-101 French 101' }],
			[]
		]);
		await expect(
			submitRequestInTransaction(
				database,
				otherSubmission({
					teacher: { source: 'catalog', id: REQUEST_ID },
					course: { source: 'catalog', id: LINE_ID }
				}),
				NOW,
				() => 'REQ-ABCDEFGH2345'
			)
		).resolves.toMatchObject({ replayed: false, publicReference: 'REQ-ABCDEFGH2345' });
	});

	it('rate-limits a new request when either bucket is exhausted', async () => {
		const database = tx([[], rateRow(15 * 60 * 1000, 11), rateRow(60 * 60 * 1000, 1)]);
		await expect(
			submitRequestInTransaction(database, otherSubmission(), NOW, () => 'REQ-ABCDEFGH2345', {
				hmacKey: HMAC_KEY,
				requestHeaders: new Headers()
			})
		).rejects.toBeInstanceOf(BookWorkRateLimitError);
	});

	it('rejects duplicate replay rows and a missing insert', async () => {
		await expect(
			submitRequestInTransaction(
				tx([[{ id: REQUEST_ID }, { id: LINE_ID }]]),
				otherSubmission(),
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkUnavailableError);
		await expect(
			submitRequestInTransaction(tx([[], []]), otherSubmission(), NOW, () => 'REQ-ABCDEFGH2345')
		).rejects.toBeInstanceOf(BookWorkUnavailableError);
	});

	it('rejects catalogue labels that do not resolve to one active row', async () => {
		await expect(
			submitRequestInTransaction(
				tx([[], [{ id: REQUEST_ID }], [], []]),
				otherSubmission({ teacher: { source: 'catalog', id: REQUEST_ID } }),
				NOW,
				() => 'REQ-ABCDEFGH2345'
			)
		).rejects.toBeInstanceOf(BookWorkUnavailableError);
	});

	it('groups unassigned requests ahead of bookstore pickup rows', async () => {
		const board = await openBoardInTransaction(
			tx([
				[{ id: STORE_ID, name: 'Campus Books' }],
				[
					{
						need_kind: 'order_line',
						parent_id: REQUEST_ID,
						line_id: LINE_ID,
						public_reference: 'MPC-ABCDEFGH2345',
						version: 4,
						bookstore_id: STORE_ID,
						bookstore_name: 'Campus Books',
						title: 'Le Petit Prince',
						author: null,
						isbn: null,
						requested: 2,
						picked_up: 0,
						created_at: NOW.toISOString(),
						teacher_label: 'Mme Tremblay',
						course_label: 'FRE-101 French 101'
					}
				],
				[
					{
						need_kind: 'request_item',
						parent_id: REQUEST_ID,
						line_id: LINE_ID,
						public_reference: 'REQ-ABCDEFGH2345',
						version: 1,
						bookstore_id: null,
						bookstore_name: null,
						title: 'Calculus',
						author: 'Stewart',
						isbn: null,
						requested: 1,
						picked_up: 0,
						created_at: NOW.toISOString(),
						teacher_label: 'Guest',
						course_label: 'Independent'
					}
				]
			]),
			NOW
		);
		expect(board.totalRows).toBe(2);
		expect(board.groups[0].bookstore).toBeNull();
		expect(board.groups[1].bookstore).toEqual({ id: STORE_ID, name: 'Campus Books' });
		expect(board.groups[0].rows[0]).toMatchObject({
			remaining: 1,
			source: { teacher: 'Guest', course: 'Independent' }
		});
		expect(board.bookstores).toEqual([{ id: STORE_ID, name: 'Campus Books' }]);
	});

	it('fails closed when the board result set is unbounded', async () => {
		await expect(
			openBoardInTransaction(
				tx([Array.from({ length: 101 }, (_, index) => ({ id: String(index), name: 'S' }))]),
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkUnavailableError);
		await expect(
			openBoardInTransaction(
				tx([
					[],
					Array.from({ length: 501 }, () => ({
						need_kind: 'order_line',
						parent_id: REQUEST_ID,
						line_id: LINE_ID,
						public_reference: 'MPC-ABCDEFGH2345',
						version: 1,
						bookstore_id: STORE_ID,
						bookstore_name: 'Campus',
						title: 'Book',
						author: null,
						isbn: null,
						requested: 1,
						picked_up: 0,
						created_at: NOW.toISOString(),
						teacher_label: 'T',
						course_label: 'C'
					})),
					[]
				]),
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkUnavailableError);
	});

	it('records an order-line pickup and marks the order picked up when no copies remain', async () => {
		const database = tx([
			[],
			[{ id: REQUEST_ID, version: 1, payment_status: 'paid', fulfillment_status: 'received' }],
			[{ quantity: 2, picked: 0 }],
			[],
			[{ count: 0 }],
			[],
			[]
		]);
		await expect(
			recordPickupInTransaction(database, pickupCommand({ quantity: 2 }), NOW)
		).resolves.toMatchObject({ remaining: 0, status: 'picked_up', replayed: false, version: 2 });
	});

	it('records a partial order-line pickup without completing the order', async () => {
		const database = tx([
			[],
			[
				{
					id: REQUEST_ID,
					version: 1,
					payment_status: 'paid',
					fulfillment_status: 'ready_for_pickup'
				}
			],
			[{ quantity: 3, picked: 1 }],
			[],
			[{ count: 1 }],
			[],
			[]
		]);
		await expect(
			recordPickupInTransaction(database, pickupCommand({ quantity: 1 }), NOW)
		).resolves.toMatchObject({ remaining: 1, status: 'ready_for_pickup' });
	});

	it('records a request-item pickup after bookstore assignment', async () => {
		const database = tx([
			[],
			[{ id: REQUEST_ID, version: 2, status: 'assigned', bookstore_id: STORE_ID }],
			[{ quantity: 1, picked: 0 }],
			[],
			[{ count: 0 }],
			[],
			[]
		]);
		await expect(
			recordPickupInTransaction(
				database,
				pickupCommand({
					ref: { kind: 'request_item', requestId: REQUEST_ID, itemId: LINE_ID },
					version: 2,
					quantity: 1
				}),
				NOW
			)
		).resolves.toMatchObject({ remaining: 0, status: 'picked_up' });
	});

	it('leaves an assigned request open when copies remain', async () => {
		const database = tx([
			[],
			[{ id: REQUEST_ID, version: 2, status: 'assigned', bookstore_id: STORE_ID }],
			[{ quantity: 3, picked: 0 }],
			[],
			[{ count: 1 }],
			[],
			[]
		]);
		await expect(
			recordPickupInTransaction(
				database,
				pickupCommand({
					ref: { kind: 'request_item', requestId: REQUEST_ID, itemId: LINE_ID },
					version: 2,
					quantity: 1
				}),
				NOW
			)
		).resolves.toMatchObject({ remaining: 2, status: 'assigned' });
	});

	it('validates pickup commands before touching the ledger', async () => {
		await expect(recordPickupInTransaction(tx([]), { ref: null }, NOW)).rejects.toBeInstanceOf(
			BookWorkValidationError
		);
		await expect(
			recordPickupInTransaction(tx([[], []]), pickupCommand(), NOW)
		).rejects.toBeInstanceOf(BookWorkNotFoundError);
		await expect(
			recordPickupInTransaction(
				tx([
					[],
					[{ id: REQUEST_ID, version: 1, payment_status: 'paid', fulfillment_status: 'received' }],
					[]
				]),
				pickupCommand(),
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkNotFoundError);
	});

	it('conflicts when the parent version or remaining copies do not match', async () => {
		await expect(
			recordPickupInTransaction(
				tx([
					[],
					[{ id: REQUEST_ID, version: 9, payment_status: 'paid', fulfillment_status: 'received' }]
				]),
				pickupCommand(),
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkConflictError);
		await expect(
			recordPickupInTransaction(
				tx([
					[],
					[{ id: REQUEST_ID, version: 1, payment_status: 'paid', fulfillment_status: 'received' }],
					[{ quantity: 1, picked: 0 }]
				]),
				pickupCommand({ quantity: 2 }),
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkConflictError);
		await expect(
			recordPickupInTransaction(
				tx([[{ need_kind: 'order_line' }, { need_kind: 'order_line' }]]),
				pickupCommand(),
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkUnavailableError);
	});

	it('assigns a bookstore to a submitted request', async () => {
		const database = tx([[{ id: REQUEST_ID }], []]);
		await expect(
			assignRequestBookstoreInTransaction(
				database,
				{
					requestId: REQUEST_ID,
					bookstoreId: STORE_ID,
					version: 1,
					actor: { userId: 'staff', email: 'team@marihacks.com', requestId: 'req' }
				},
				NOW
			)
		).resolves.toEqual({ requestId: REQUEST_ID, version: 2 });
	});

	it('rejects invalid assignment identifiers and a missed update', async () => {
		await expect(
			assignRequestBookstoreInTransaction(
				tx([]),
				{ requestId: 'bad', bookstoreId: STORE_ID, version: 1 },
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkValidationError);
		await expect(
			assignRequestBookstoreInTransaction(
				tx([[]]),
				{
					requestId: REQUEST_ID,
					bookstoreId: STORE_ID,
					version: 1,
					actor: { userId: 'staff', email: 'team@marihacks.com', requestId: 'req' }
				},
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkConflictError);
	});

	it('reads one stored outline and rejects an invalid request id', async () => {
		const repository = createBookWorkRepository({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			runTransaction: async (operation) =>
				operation({
					execute: async () => ({
						rows: [
							{
								filename: 'outline.pdf',
								byte_length: 4,
								sha256: 'abcd',
								content: Buffer.from('%PDF')
							}
						]
					})
				})
		});
		await expect(repository.readOutline(REQUEST_ID)).resolves.toMatchObject({
			descriptor: { filename: 'outline.pdf', byteLength: 4 }
		});
		await expect(repository.readOutline('not-a-uuid')).rejects.toBeInstanceOf(
			BookWorkValidationError
		);
	});

	it('returns not found and unavailable for outline row counts other than one', async () => {
		const missing = createBookWorkRepository({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			runTransaction: async (operation) => operation({ execute: async () => ({ rows: [] }) })
		});
		await expect(missing.readOutline(REQUEST_ID)).rejects.toBeInstanceOf(BookWorkNotFoundError);
		const duplicated = createBookWorkRepository({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			runTransaction: async (operation) =>
				operation({ execute: async () => ({ rows: [{ filename: 'a' }, { filename: 'b' }] }) })
		});
		await expect(duplicated.readOutline(REQUEST_ID)).rejects.toBeInstanceOf(
			BookWorkUnavailableError
		);
	});

	it('opens an empty board through the repository facade', async () => {
		const repository = createBookWorkRepository({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			getNow: () => NOW,
			runTransaction: async (operation) => operation(tx([[], [], []]))
		});
		await expect(repository.openBoard()).resolves.toMatchObject({ totalRows: 0, groups: [] });
	});

	it('submits a request through the repository facade', async () => {
		const repository = createBookWorkRepository({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			getNow: () => NOW,
			makeReference: () => 'REQ-ABCDEFGH2345',
			runTransaction: async (operation) =>
				operation(tx([[], [{ id: REQUEST_ID }], [], []]))
		});
		await expect(repository.submitRequest(otherSubmission())).resolves.toMatchObject({
			publicReference: 'REQ-ABCDEFGH2345',
			replayed: false
		});
	});

	it('records pickup through the repository facade', async () => {
		const repository = createBookWorkRepository({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			getNow: () => NOW,
			runTransaction: async (operation) =>
				operation(
					tx([
						[],
						[
							{
								id: REQUEST_ID,
								version: 1,
								payment_status: 'paid',
								fulfillment_status: 'received'
							}
						],
						[{ quantity: 2, picked: 0 }],
						[],
						[{ count: 1 }],
						[],
						[]
					])
				)
		});
		await expect(repository.recordPickup(pickupCommand({ quantity: 1 }))).resolves.toMatchObject({
			remaining: 1
		});
	});

	it('generates a public request reference when none is provided', async () => {
		const result = await submitRequestInTransaction(
			tx([[], [{ id: REQUEST_ID }], [], []]),
			otherSubmission(),
			NOW
		);
		expect(result.publicReference).toMatch(/^REQ-[A-HJ-NP-Z2-9]{12}$/u);
	});

	it('rejects a catalogue label that is not a string', async () => {
		await expect(
			submitRequestInTransaction(
				tx([[], [{ id: REQUEST_ID }], [], [{ name: 1 }]]),
				otherSubmission({ teacher: { source: 'catalog', id: REQUEST_ID } }),
				NOW,
				() => 'REQ-ABCDEFGH2345'
			)
		).rejects.toBeInstanceOf(BookWorkUnavailableError);
	});

	it('replays an identical request-item pickup', async () => {
		await expect(
			recordPickupInTransaction(
				tx([
					[
						{
							need_kind: 'request_item',
							order_id: null,
							order_line_id: null,
							request_id: REQUEST_ID,
							request_item_id: LINE_ID,
							quantity: 1
						}
					]
				]),
				pickupCommand({
					ref: { kind: 'request_item', requestId: REQUEST_ID, itemId: LINE_ID },
					quantity: 1
				}),
				NOW
			)
		).resolves.toEqual({ replayed: true });
	});

	it('conflicts when a paid order is not ready or a request is still unassigned', async () => {
		await expect(
			recordPickupInTransaction(
				tx([
					[],
					[{ id: REQUEST_ID, version: 1, payment_status: 'paid', fulfillment_status: 'purchasing' }]
				]),
				pickupCommand(),
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkConflictError);
		await expect(
			recordPickupInTransaction(
				tx([[], [{ id: REQUEST_ID, version: 1, status: 'submitted', bookstore_id: null }]]),
				pickupCommand({
					ref: { kind: 'request_item', requestId: REQUEST_ID, itemId: LINE_ID }
				}),
				NOW
			)
		).rejects.toBeInstanceOf(BookWorkConflictError);
	});

	it('assigns a bookstore through the repository facade', async () => {
		const repository = createBookWorkRepository({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			runTransaction: async (operation) => operation(tx([[{ id: REQUEST_ID }], []]))
		});
		await expect(
			repository.assignRequestBookstore({
				requestId: REQUEST_ID,
				bookstoreId: STORE_ID,
				version: 1,
				actor: { userId: 'staff', email: 'team@marihacks.com', requestId: 'req' }
			})
		).resolves.toEqual({ requestId: REQUEST_ID, version: 2 });
	});

	it('uses the default clock when opening the board', async () => {
		const repository = createBookWorkRepository({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			runTransaction: async (operation) => operation(tx([[], [], []]))
		});
		await expect(repository.openBoard()).resolves.toMatchObject({ totalRows: 0 });
	});

	it('sorts unassigned requests ahead of named bookstores', async () => {
		const board = await openBoardInTransaction(
			tx([
				[
					{ id: STORE_ID, name: 'Zebra Books' },
					{ id: LINE_ID, name: 'Campus Books' }
				],
				[
					{
						need_kind: 'order_line',
						parent_id: REQUEST_ID,
						line_id: LINE_ID,
						public_reference: 'MPC-ABCDEFGH2345',
						version: 1,
						bookstore_id: STORE_ID,
						bookstore_name: 'Zebra Books',
						title: 'Z',
						author: null,
						isbn: null,
						requested: 1,
						picked_up: 0,
						created_at: NOW.toISOString(),
						teacher_label: 'T',
						course_label: 'C'
					}
				],
				[
					{
						need_kind: 'request_item',
						parent_id: REQUEST_ID,
						line_id: COMMAND_ID,
						public_reference: 'REQ-ABCDEFGH2345',
						version: 1,
						bookstore_id: null,
						bookstore_name: null,
						title: 'Calculus',
						author: null,
						isbn: null,
						requested: 1,
						picked_up: 0,
						created_at: NOW.toISOString(),
						teacher_label: 'Guest',
						course_label: 'Independent'
					}
				]
			]),
			NOW
		);
		expect(board.groups.map((group) => group.bookstore?.name ?? 'Unassigned')).toEqual([
			'Unassigned',
			'Zebra Books'
		]);
	});
});
