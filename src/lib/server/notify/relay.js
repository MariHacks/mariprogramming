// @ts-nocheck

import { sql } from 'drizzle-orm';
import { withDatabaseTransaction } from '../db/transaction.js';
import { ANNOUNCED_ACTIONS, parseClubFact } from './facts.js';

const MAX_ATTEMPTS = 6;
const BACKOFF_SECONDS = [30, 120, 600, 3600, 21600, 21600];

/** @param {unknown} raw */
function transaction(raw) {
	if (raw === null || typeof raw !== 'object' || typeof raw.execute !== 'function') {
		throw new Error('Notification database is unavailable');
	}
	return raw;
}

/** @param {unknown} value */
function rows(value) {
	if (value === null || typeof value !== 'object' || !Array.isArray(value.rows)) {
		throw new Error('Notification database is unavailable');
	}
	return value.rows;
}

export async function enrollDeliveriesInTransaction(raw, { now, limit }) {
	const tx = transaction(raw);
	const result = rows(
		await tx.execute(sql`INSERT INTO event_deliveries
			(audit_id, sink, status, next_attempt_at, created_at, updated_at)
			SELECT a.id, 'discord', 'pending', ${now}, ${now}, ${now}
			FROM audit_log a
			LEFT JOIN event_deliveries d ON d.audit_id = a.id AND d.sink = 'discord'
			WHERE d.audit_id IS NULL
				AND a.created_at >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}
				AND a.action IN (${sql.join(
					ANNOUNCED_ACTIONS.map((action) => sql`${action}`),
					sql`, `
				)})
			ORDER BY a.created_at LIMIT ${limit}
			ON CONFLICT DO NOTHING RETURNING audit_id`)
	);
	return result.length;
}

export async function leaseDeliveriesInTransaction(raw, { now, limit }) {
	const tx = transaction(raw);
	return rows(
		await tx.execute(sql`WITH claimed AS (
			SELECT audit_id, sink FROM event_deliveries
			WHERE sink = 'discord' AND attempts < ${MAX_ATTEMPTS}
				AND ((status = 'pending' AND next_attempt_at <= ${now})
					OR (status = 'in_flight' AND leased_until < ${now}))
			ORDER BY next_attempt_at LIMIT ${limit} FOR UPDATE SKIP LOCKED
		), updated AS (
			UPDATE event_deliveries d SET status = 'in_flight', attempts = attempts + 1,
				leased_until = ${new Date(now.getTime() + 60_000)}, version = version + 1,
				updated_at = ${now}
			FROM claimed c WHERE d.audit_id = c.audit_id AND d.sink = c.sink
			RETURNING d.audit_id, d.attempts
		)
		SELECT u.audit_id, u.attempts, a.action, a.next_state,
			o.public_reference AS order_reference,
			r.public_reference AS request_reference,
			b.name AS request_bookstore,
			COALESCE((SELECT array_agg(ol.label ORDER BY ol.label) FROM order_lines ol
				WHERE ol.order_id = o.id AND ol.kind = 'book'), ARRAY[]::varchar[]) AS order_titles,
			COALESCE((SELECT sum(ol.quantity)::integer FROM order_lines ol
				WHERE ol.order_id = o.id AND ol.kind = 'book'), 0) AS order_book_count,
			COALESCE((SELECT array_agg(DISTINCT ol.bookstore_name ORDER BY ol.bookstore_name)
				FROM order_lines ol WHERE ol.order_id = o.id AND ol.kind = 'book'), ARRAY[]::varchar[]) AS order_bookstores,
			COALESCE((SELECT array_agg(i.title ORDER BY i.position) FROM book_request_items i
				WHERE i.request_id = r.id), ARRAY[]::varchar[]) AS request_titles,
			COALESCE(t.name, r.teacher_name) AS request_teacher,
			COALESCE(c.code || ' ' || c.title, r.course_name) AS request_course
		FROM updated u JOIN audit_log a ON a.id = u.audit_id
		LEFT JOIN orders o ON o.id = a.order_id
		LEFT JOIN book_requests r ON r.id = a.resource_id AND a.resource_type = 'book_request'
		LEFT JOIN bookstores b ON b.id = r.bookstore_id
		LEFT JOIN teachers t ON t.id = r.teacher_id
		LEFT JOIN courses c ON c.id = r.course_id`)
	).map((row) => ({
		auditId: row.audit_id,
		attempts: Number(row.attempts),
		action: row.action,
		nextState: row.next_state,
		orderReference: row.order_reference,
		requestReference: row.request_reference,
		requestBookstore: row.request_bookstore,
		orderTitles: row.order_titles,
		orderBookCount: Number(row.order_book_count),
		orderBookstores: row.order_bookstores,
		requestTitles: row.request_titles,
		requestTeacher: row.request_teacher,
		requestCourse: row.request_course,
		titles: row.order_titles?.length ? row.order_titles : row.request_titles,
		bookstores: row.order_bookstores
	}));
}

export async function settleDeliveryInTransaction(raw, { auditId, outcome, attempts, now }) {
	const tx = transaction(raw);
	const terminal = ['delivered', 'dead', 'skipped'].includes(outcome.disposition);
	const dead = outcome.disposition === 'retry' && attempts >= MAX_ATTEMPTS;
	const status = dead ? 'dead' : outcome.disposition === 'retry' ? 'pending' : outcome.disposition;
	const seconds =
		outcome.disposition === 'retry'
			? Math.max(outcome.afterSeconds ?? 0, BACKOFF_SECONDS[Math.max(0, attempts - 1)] ?? 21600)
			: 0;
	await tx.execute(sql`UPDATE event_deliveries SET status = ${status},
		leased_until = NULL, settled_at = ${terminal || dead ? now : null},
		next_attempt_at = ${new Date(now.getTime() + seconds * 1000)},
		failure_reason = ${outcome.reason ?? null}, version = version + 1, updated_at = ${now}
		WHERE audit_id = ${auditId} AND sink = 'discord' AND status = 'in_flight'`);
}

/**
 * @param {{ databaseUrl: string, sink: any | null, runTransaction?: typeof withDatabaseTransaction, getNow?: () => Date }} configuration
 */
export function createNotificationRelay({
	databaseUrl,
	sink,
	runTransaction = withDatabaseTransaction,
	getNow = () => new Date()
}) {
	const run = (operation) => runTransaction(operation, { databaseUrl });
	return Object.freeze({
		async drain({ limit = 20, budgetMs = 8000 } = {}) {
			const summary = { enrolled: 0, attempted: 0, delivered: 0, retrying: 0, dead: 0, skipped: 0 };
			const now = getNow();
			summary.enrolled = await run((tx) => enrollDeliveriesInTransaction(tx, { now, limit }));
			const leased = await run((tx) => leaseDeliveriesInTransaction(tx, { now, limit }));
			const deadline = Date.now() + budgetMs;
			for (const source of leased) {
				if (Date.now() >= deadline) break;
				summary.attempted += 1;
				const fact = parseClubFact(source);
				let outcome;
				if (!fact || sink === null) {
					outcome = { disposition: 'skipped' };
					summary.skipped += 1;
				} else {
					try {
						outcome = await sink.deliver(fact);
					} catch {
						outcome = { disposition: 'retry', afterSeconds: 0, reason: 'sink_failure' };
					}
					if (outcome.disposition === 'delivered') summary.delivered += 1;
					else if (outcome.disposition === 'retry') summary.retrying += 1;
					else summary.dead += 1;
				}
				await run((tx) =>
					settleDeliveryInTransaction(tx, {
						auditId: source.auditId,
						outcome,
						attempts: source.attempts,
						now: getNow()
					})
				);
			}
			return Object.freeze(summary);
		}
	});
}
