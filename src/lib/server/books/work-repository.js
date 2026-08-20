// @ts-nocheck

import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { workAge } from '$lib/books/age.js';
import { withDatabaseTransaction } from '../db/transaction.js';
import {
	RATE_LIMIT_POLICIES,
	consumeRateLimitInTransaction,
	createBookRequestClientAddressBucketKey,
	createBookRequestEmailBucketKey
} from '../security/rate-limit.js';
import { catalogRefColumns } from './catalog-ref.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export class BookWorkValidationError extends Error {
	constructor() {
		super('Book work request is invalid');
		this.name = 'BookWorkValidationError';
		this.code = 'BOOK_WORK_INVALID';
	}
}
export class BookWorkConflictError extends Error {
	constructor() {
		super('Book work changed');
		this.name = 'BookWorkConflictError';
		this.code = 'BOOK_WORK_CONFLICT';
	}
}
export class BookWorkNotFoundError extends Error {
	constructor() {
		super('Book work was not found');
		this.name = 'BookWorkNotFoundError';
		this.code = 'BOOK_WORK_NOT_FOUND';
	}
}
export class BookWorkUnavailableError extends Error {
	constructor() {
		super('Book work is unavailable');
		this.name = 'BookWorkUnavailableError';
		this.code = 'BOOK_WORK_UNAVAILABLE';
	}
}
export class BookWorkRateLimitError extends Error {
	/** @param {number} retryAfterSeconds */
	constructor(retryAfterSeconds) {
		super('Book request was rate limited');
		this.name = 'BookWorkRateLimitError';
		this.code = 'BOOK_WORK_RATE_LIMITED';
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

/** @param {unknown} result */
function resultRows(result) {
	if (result === null || typeof result !== 'object' || !Array.isArray(result.rows)) {
		throw new BookWorkUnavailableError();
	}
	return result.rows;
}

/** @param {unknown} raw */
function tx(raw) {
	if (raw === null || typeof raw !== 'object' || typeof raw.execute !== 'function') {
		throw new BookWorkUnavailableError();
	}
	return raw;
}

function publicReference() {
	const bytes = randomBytes(12);
	let value = 'REQ-';
	for (let index = 0; index < 12; index += 1) value += REFERENCE_ALPHABET[bytes[index] % 32];
	return value;
}

/** @param {Date} createdAt @param {Date} now */
function age(createdAt, now) {
	return workAge(Math.floor((now.getTime() - new Date(createdAt).getTime()) / 1000));
}

/** @param {unknown} raw @param {any} ref @param {'teacher' | 'course'} type */
async function snapshotLabel(raw, ref, type) {
	if (ref.source === 'other') return ref.name;
	const database = tx(raw);
	const found =
		type === 'teacher'
			? resultRows(
					await database.execute(
						sql`SELECT name FROM teachers WHERE id = ${ref.id} AND active = true`
					)
				)
			: resultRows(
					await database.execute(
						sql`SELECT code || ' ' || title AS name FROM courses WHERE id = ${ref.id} AND active = true`
					)
				);
	if (found.length !== 1 || typeof found[0].name !== 'string') throw new BookWorkUnavailableError();
	return found[0].name;
}

/** @param {any} submission @param {Date} now @param {() => string} makeReference @param {{ hmacKey?: string, requestHeaders?: unknown }} [rateContext] */
export async function submitRequestInTransaction(
	raw,
	submission,
	now,
	makeReference = publicReference,
	rateContext = {}
) {
	const database = tx(raw);
	const replay = resultRows(
		await database.execute(sql`SELECT id, public_reference, created_at
			FROM book_requests WHERE client_request_id = ${submission.clientRequestId} LIMIT 2`)
	);
	if (replay.length > 1) throw new BookWorkUnavailableError();
	if (replay.length === 1) {
		return Object.freeze({
			requestId: replay[0].id,
			publicReference: replay[0].public_reference,
			submittedAt: new Date(replay[0].created_at).toISOString(),
			replayed: true
		});
	}
	if (typeof rateContext.hmacKey === 'string' && rateContext.hmacKey) {
		const emailKey = createBookRequestEmailBucketKey(submission.student.email, {
			hmacKey: rateContext.hmacKey
		});
		const addressKey = createBookRequestClientAddressBucketKey(rateContext.requestHeaders, {
			hmacKey: rateContext.hmacKey
		});
		const rates = [
			await consumeRateLimitInTransaction(database, {
				bucketKey: emailKey,
				scope: 'book_request_email',
				...RATE_LIMIT_POLICIES.book_request_email,
				now
			}),
			await consumeRateLimitInTransaction(database, {
				bucketKey: addressKey,
				scope: 'book_request_client_address',
				...RATE_LIMIT_POLICIES.book_request_client_address,
				now
			})
		];
		if (rates.some((result) => !result.allowed)) {
			throw new BookWorkRateLimitError(Math.max(...rates.map((result) => result.retryAfterSeconds)));
		}
	}
	const reference = makeReference();
	const teacher = catalogRefColumns(submission.teacher);
	const course = catalogRefColumns(submission.course);
	const inserted = resultRows(
		await database.execute(sql`INSERT INTO book_requests
			(public_reference, client_request_id, student_name, student_email,
			 teacher_id, teacher_name, course_id, course_name, note, created_at, updated_at)
			VALUES (${reference}, ${submission.clientRequestId}, ${submission.student.name},
			 ${submission.student.email}, ${teacher.id}, ${teacher.name}, ${course.id}, ${course.name},
			 ${submission.note}, ${now}, ${now})
			RETURNING id`)
	);
	if (inserted.length !== 1) throw new BookWorkUnavailableError();
	const requestId = inserted[0].id;
	for (const [position, item] of submission.items.entries()) {
		await database.execute(sql`INSERT INTO book_request_items
			(request_id, position, title, author, isbn, quantity, created_at)
			VALUES (${requestId}, ${position}, ${item.title}, ${item.author}, ${item.isbn},
			 ${item.quantity}, ${now})`);
	}
	if (submission.outline) {
		await database.execute(sql`INSERT INTO book_request_outlines
			(request_id, filename, byte_length, sha256, content, created_at)
			VALUES (${requestId}, ${submission.outline.filename}, ${submission.outline.byteLength},
			 ${submission.outline.sha256}, ${Buffer.from(submission.outline.bytes)}, ${now})`);
	}
	const teacherLabel = await snapshotLabel(database, submission.teacher, 'teacher');
	const courseLabel = await snapshotLabel(database, submission.course, 'course');
	await database.execute(sql`INSERT INTO audit_log
		(resource_type, resource_id, actor_kind, action, next_state, request_id, created_at)
		VALUES ('book_request', ${requestId}, 'customer', 'book_request_submitted',
			${JSON.stringify({
				publicReference: reference,
				teacherLabel,
				courseLabel,
				bookCount: submission.items.length
			})}::jsonb, ${submission.clientRequestId}, ${now})`);
	return Object.freeze({
		requestId,
		publicReference: reference,
		submittedAt: now.toISOString(),
		replayed: false
	});
}

/** @param {unknown} raw @param {Date} now */
export async function openBoardInTransaction(raw, now) {
	const database = tx(raw);
	const storeRows = resultRows(
		await database.execute(
			sql`SELECT id, name FROM bookstores WHERE active = true ORDER BY name LIMIT 101`
		)
	);
	if (storeRows.length > 100) throw new BookWorkUnavailableError();
	const orderRows = resultRows(
		await database.execute(sql`SELECT
			'order_line' AS need_kind, ol.order_id AS parent_id, ol.id AS line_id,
			o.public_reference, o.version, ol.bookstore_id, ol.bookstore_name, ol.label AS title,
			NULL::text AS author, ol.isbn, ol.quantity AS requested,
			COALESCE(sum(p.quantity), 0)::integer AS picked_up, o.created_at,
			ol.teacher_name AS teacher_label,
			ol.course_code || ' ' || ol.course_title AS course_label
		FROM order_lines ol
		JOIN orders o ON o.id = ol.order_id
		LEFT JOIN book_pickups p ON p.order_line_id = ol.id
		WHERE o.payment_status = 'paid'
			AND o.fulfillment_status IN ('received', 'ready_for_pickup')
			AND ol.kind = 'book'
		GROUP BY ol.id, o.id
		HAVING ol.quantity > COALESCE(sum(p.quantity), 0)
		ORDER BY ol.bookstore_name, o.created_at, ol.id LIMIT 501`)
	);
	const requestRows = resultRows(
		await database.execute(sql`SELECT
			'request_item' AS need_kind, r.id AS parent_id, i.id AS line_id,
			r.public_reference, r.version, r.bookstore_id, b.name AS bookstore_name, i.title,
			i.author, i.isbn, i.quantity AS requested,
			COALESCE(sum(p.quantity), 0)::integer AS picked_up, r.created_at,
			COALESCE(t.name, r.teacher_name) AS teacher_label,
			COALESCE(c.code || ' ' || c.title, r.course_name) AS course_label
		FROM book_requests r
		JOIN book_request_items i ON i.request_id = r.id
		LEFT JOIN book_pickups p ON p.request_item_id = i.id
		LEFT JOIN bookstores b ON b.id = r.bookstore_id
		LEFT JOIN teachers t ON t.id = r.teacher_id
		LEFT JOIN courses c ON c.id = r.course_id
		WHERE r.status IN ('submitted', 'assigned')
		GROUP BY r.id, i.id, b.name, t.name, c.code, c.title
		HAVING i.quantity > COALESCE(sum(p.quantity), 0)
		ORDER BY r.bookstore_id NULLS FIRST, b.name, r.created_at, i.position LIMIT 501`)
	);
	if (orderRows.length > 500 || requestRows.length > 500) throw new BookWorkUnavailableError();
	const groups = new Map();
	for (const row of [...requestRows, ...orderRows]) {
		const key = row.bookstore_id ?? '';
		if (!groups.has(key)) {
			groups.set(key, {
				bookstore:
					row.bookstore_id === null
						? null
						: Object.freeze({ id: row.bookstore_id, name: row.bookstore_name }),
				rows: []
			});
		}
		const requested = Number(row.requested);
		const pickedUp = Number(row.picked_up);
		const ref =
			row.need_kind === 'order_line'
				? Object.freeze({ kind: 'order_line', orderId: row.parent_id, lineId: row.line_id })
				: Object.freeze({ kind: 'request_item', requestId: row.parent_id, itemId: row.line_id });
		groups.get(key).rows.push(
			Object.freeze({
				ref,
				version: Number(row.version),
				reference: row.public_reference,
				title: row.title,
				author: row.author,
				isbn: row.isbn,
				requested,
				pickedUp,
				remaining: requested - pickedUp,
				source: Object.freeze({
					teacher: row.teacher_label,
					course: row.course_label
				}),
				age: age(row.created_at, now),
				commandId: randomUUID()
			})
		);
	}
	const unassigned = [];
	const named = [];
	for (const group of groups.values()) {
		if (group.bookstore === null) unassigned.push(group);
		else named.push(group);
	}
	named.sort((left, right) => left.bookstore.name.localeCompare(right.bookstore.name));
	const ordered = [...unassigned, ...named];
	return Object.freeze({
		groups: Object.freeze(
			ordered.map((group) =>
				Object.freeze({ bookstore: group.bookstore, rows: Object.freeze(group.rows) })
			)
		),
		totalRows: orderRows.length + requestRows.length,
		bookstores: Object.freeze(
			storeRows.map((row) => Object.freeze({ id: row.id, name: row.name }))
		),
		generatedAt: now.toISOString()
	});
}

/** @param {unknown} raw @param {any} command @param {Date} now */
export async function recordPickupInTransaction(raw, command, now) {
	const database = tx(raw);
	if (
		!command?.ref ||
		!['order_line', 'request_item'].includes(command.ref.kind) ||
		!UUID_PATTERN.test(command.clientRequestId) ||
		!Number.isSafeInteger(command.quantity) ||
		command.quantity < 1 ||
		!Number.isSafeInteger(command.version) ||
		command.version < 1
	) {
		throw new BookWorkValidationError();
	}
	const replay = resultRows(
		await database.execute(sql`SELECT need_kind, order_id, order_line_id, request_id,
			request_item_id, quantity FROM book_pickups
			WHERE client_request_id = ${command.clientRequestId} LIMIT 2`)
	);
	if (replay.length > 1) throw new BookWorkUnavailableError();
	if (replay.length === 1) {
		const row = replay[0];
		const same =
			Number(row.quantity) === command.quantity &&
			row.need_kind === command.ref.kind &&
			(command.ref.kind === 'order_line'
				? row.order_id === command.ref.orderId && row.order_line_id === command.ref.lineId
				: row.request_id === command.ref.requestId && row.request_item_id === command.ref.itemId);
		if (!same) throw new BookWorkConflictError();
		return Object.freeze({ replayed: true });
	}
	const order = command.ref.kind === 'order_line';
	const parentId = order ? command.ref.orderId : command.ref.requestId;
	const lineId = order ? command.ref.lineId : command.ref.itemId;
	const locked = resultRows(
		await database.execute(
			order
				? sql`SELECT id, version, payment_status, fulfillment_status
					FROM orders WHERE id = ${parentId} FOR UPDATE`
				: sql`SELECT id, version, status, bookstore_id
					FROM book_requests WHERE id = ${parentId} FOR UPDATE`
		)
	);
	if (locked.length === 0) throw new BookWorkNotFoundError();
	const parent = locked[0];
	if (
		Number(parent.version) !== command.version ||
		(order &&
			(parent.payment_status !== 'paid' ||
				!['received', 'ready_for_pickup'].includes(parent.fulfillment_status))) ||
		(!order && (parent.status !== 'assigned' || parent.bookstore_id === null))
	) {
		throw new BookWorkConflictError();
	}
	const line = resultRows(
		await database.execute(
			order
				? sql`SELECT ol.quantity,
					COALESCE(sum(p.quantity), 0)::integer AS picked
					FROM order_lines ol LEFT JOIN book_pickups p ON p.order_line_id = ol.id
					WHERE ol.id = ${lineId} AND ol.order_id = ${parentId} AND ol.kind = 'book'
					GROUP BY ol.id`
				: sql`SELECT i.quantity,
					COALESCE(sum(p.quantity), 0)::integer AS picked
					FROM book_request_items i LEFT JOIN book_pickups p ON p.request_item_id = i.id
					WHERE i.id = ${lineId} AND i.request_id = ${parentId}
					GROUP BY i.id`
		)
	);
	if (line.length === 0) throw new BookWorkNotFoundError();
	const remaining = Number(line[0].quantity) - Number(line[0].picked);
	if (command.quantity > remaining) throw new BookWorkConflictError();
	await database.execute(sql`INSERT INTO book_pickups
		(need_kind, order_id, order_line_id, request_id, request_item_id, quantity,
		 client_request_id, staff_user_id, staff_identity, created_at)
		VALUES (${command.ref.kind}, ${order ? parentId : null}, ${order ? lineId : null},
		 ${order ? null : parentId}, ${order ? null : lineId}, ${command.quantity},
		 ${command.clientRequestId}, ${command.actor.userId}, ${command.actor.email}, ${now})`);
	const outstanding = resultRows(
		await database.execute(
			order
				? sql`SELECT count(*)::integer AS count FROM order_lines ol
					WHERE ol.order_id = ${parentId} AND ol.kind = 'book'
					AND ol.quantity > COALESCE((SELECT sum(quantity) FROM book_pickups p WHERE p.order_line_id = ol.id), 0)`
				: sql`SELECT count(*)::integer AS count FROM book_request_items i
					WHERE i.request_id = ${parentId}
					AND i.quantity > COALESCE((SELECT sum(quantity) FROM book_pickups p WHERE p.request_item_id = i.id), 0)`
		)
	);
	const complete = Number(outstanding[0]?.count) === 0;
	const purgeAfter = new Date(now.getTime() + RETENTION_MS);
	await database.execute(
		order
			? complete
				? sql`UPDATE orders SET fulfillment_status = 'picked_up',
					pii_purge_after = ${purgeAfter}, version = version + 1, updated_at = ${now}
					WHERE id = ${parentId} AND version = ${command.version}`
				: sql`UPDATE orders SET version = version + 1, updated_at = ${now}
					WHERE id = ${parentId} AND version = ${command.version}`
			: complete
				? sql`UPDATE book_requests SET status = 'picked_up',
					pii_purge_after = ${purgeAfter}, version = version + 1, updated_at = ${now}
					WHERE id = ${parentId} AND version = ${command.version}`
				: sql`UPDATE book_requests SET version = version + 1, updated_at = ${now}
					WHERE id = ${parentId} AND version = ${command.version}`
	);
	await database.execute(sql`INSERT INTO audit_log
		(order_id, resource_type, resource_id, actor_kind, staff_user_id, staff_identity,
		 action, next_state, request_id, created_at)
		VALUES (${order ? parentId : null}, ${order ? 'order' : 'book_request'}, ${parentId}, 'staff',
		 ${command.actor.userId}, ${command.actor.email}, 'book_pickup_recorded',
		 ${JSON.stringify({ lineId, quantity: command.quantity, remaining: remaining - command.quantity })}::jsonb,
		 ${command.actor.requestId}, ${now})`);
	return Object.freeze({
		lineId,
		remaining: remaining - command.quantity,
		status: complete ? 'picked_up' : order ? parent.fulfillment_status : 'assigned',
		version: command.version + 1,
		replayed: false
	});
}

/** @param {unknown} raw @param {any} command @param {Date} now */
export async function assignRequestBookstoreInTransaction(raw, command, now) {
	const database = tx(raw);
	if (
		!UUID_PATTERN.test(command.requestId) ||
		!UUID_PATTERN.test(command.bookstoreId) ||
		!Number.isSafeInteger(command.version)
	) {
		throw new BookWorkValidationError();
	}
	const updated = resultRows(
		await database.execute(sql`UPDATE book_requests SET status = 'assigned',
			bookstore_id = ${command.bookstoreId}, version = version + 1, updated_at = ${now}
			WHERE id = ${command.requestId} AND status = 'submitted' AND version = ${command.version}
				AND EXISTS (SELECT 1 FROM bookstores
					WHERE id = ${command.bookstoreId} AND active = true)
			RETURNING id`)
	);
	if (updated.length !== 1) throw new BookWorkConflictError();
	await database.execute(sql`INSERT INTO audit_log
		(resource_type, resource_id, actor_kind, staff_user_id, staff_identity, action,
		 next_state, request_id, created_at)
		VALUES ('book_request', ${command.requestId}, 'staff', ${command.actor.userId},
		 ${command.actor.email}, 'book_request_assigned',
		 ${JSON.stringify({ bookstoreId: command.bookstoreId })}::jsonb, ${command.actor.requestId}, ${now})`);
	return Object.freeze({ requestId: command.requestId, version: command.version + 1 });
}

/**
 * @param {{ databaseUrl: string, hmacKey?: string, runTransaction?: typeof withDatabaseTransaction, getNow?: () => Date, makeReference?: () => string }} configuration
 */
export function createBookWorkRepository({
	databaseUrl,
	hmacKey,
	runTransaction = withDatabaseTransaction,
	getNow = () => new Date(),
	makeReference = publicReference
}) {
	const run = (operation) => runTransaction(operation, { databaseUrl });
	return Object.freeze({
		async listFormOptions() {
			return run(async (database) => {
				const teacherRows = resultRows(
					await tx(database).execute(
						sql`SELECT id::text AS id, name FROM teachers WHERE active = true ORDER BY name ASC, id ASC`
					)
				);
				const courseRows = resultRows(
					await tx(database).execute(
						sql`SELECT id::text AS id, code, title FROM courses WHERE active = true ORDER BY code ASC, title ASC, id ASC`
					)
				);
				return Object.freeze({
					teachers: Object.freeze(
						teacherRows.map((row) => Object.freeze({ id: row.id, name: row.name }))
					),
					courses: Object.freeze(
						courseRows.map((row) =>
							Object.freeze({ id: row.id, code: row.code, title: row.title })
						)
					)
				});
			});
		},
		submitRequest: (submission, context = {}) =>
			run((database) =>
				submitRequestInTransaction(database, submission, getNow(), makeReference, {
					hmacKey: context.hmacKey ?? hmacKey,
					requestHeaders: context.requestHeaders
				})
			),
		openBoard: () => run((database) => openBoardInTransaction(database, getNow())),
		recordPickup: (command) =>
			run((database) => recordPickupInTransaction(database, command, getNow())),
		assignRequestBookstore: (command) =>
			run((database) => assignRequestBookstoreInTransaction(database, command, getNow())),
		async readOutline(requestId) {
			if (!UUID_PATTERN.test(requestId)) throw new BookWorkValidationError();
			return run(async (database) => {
				const rows = resultRows(
					await tx(database).execute(sql`SELECT filename, byte_length, sha256, content
						FROM book_request_outlines WHERE request_id = ${requestId} LIMIT 2`)
				);
				if (rows.length === 0) throw new BookWorkNotFoundError();
				if (rows.length !== 1) throw new BookWorkUnavailableError();
				return Object.freeze({
					descriptor: Object.freeze({
						filename: rows[0].filename,
						byteLength: Number(rows[0].byte_length),
						sha256: rows[0].sha256
					}),
					bytes: new Uint8Array(rows[0].content)
				});
			});
		}
	});
}
