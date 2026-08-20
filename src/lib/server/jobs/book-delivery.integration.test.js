// @ts-nocheck
// @vitest-environment node

import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import {
	cleanupExpiredRateBucketsInTransaction,
	failAbandonedCheckoutAttemptInTransaction,
	listReconciliationCandidatesInTransaction,
	purgeDueCustomerDataInTransaction,
	reconcileProviderEvidenceInTransaction
} from './book-delivery.js';

const POSTGRES_BIN = '/Applications/Postgres.app/Contents/Versions/latest/bin';
const MIGRATIONS_DIRECTORY = resolve('drizzle');
const NOW = new Date('2026-08-13T18:00:00.000Z');
const BOOKSTORE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TEACHER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const COURSE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BOOK_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CREATED_ORDER = '11111111-1111-4111-8111-111111111111';
const CREATED_ATTEMPT = '22222222-2222-4222-8222-222222222222';
const READY_ORDER = '33333333-3333-4333-8333-333333333333';
const READY_ATTEMPT = '44444444-4444-4444-8444-444444444444';
const PAID_ORDER = '55555555-5555-4555-8555-555555555555';
const PAID_ATTEMPT = '66666666-6666-4666-8666-666666666666';
const PURGE_ORDER = '77777777-7777-4777-8777-777777777777';
const CAPABILITY_ONLY_ORDER = '99999999-9999-4999-8999-999999999999';
const PARTIAL_PII_ORDER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let clusterRoot;
let dataDirectory;
let socketDirectory;
let port;
let databaseUrl;

function binary(name) {
	return join(POSTGRES_BIN, name);
}

function run(command, args) {
	return spawnSync(command, args, {
		env: {
			...process.env,
			PGHOST: socketDirectory,
			PGPORT: String(port),
			PGDATABASE: 'postgres',
			PGUSER: process.env.USER
		},
		encoding: 'utf8'
	});
}

function query(statement) {
	const result = run(binary('psql'), [
		'--no-psqlrc',
		'--set',
		'ON_ERROR_STOP=1',
		'--tuples-only',
		'--no-align',
		'--command',
		statement
	]);
	if (result.status !== 0) throw new Error(result.stderr || result.stdout);
	return result.stdout.trim();
}

function freePort() {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close();
				reject(new Error('Could not reserve a PostgreSQL test port'));
				return;
			}
			server.close((error) => (error ? reject(error) : resolvePort(address.port)));
		});
	});
}

async function runTransaction(operation) {
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		return await drizzle(client, { schema }).transaction(operation);
	} finally {
		await client.end();
	}
}

function seedOrder({ orderId, attemptId, reference, payment, fulfillment, attempt, session }) {
	const completed = attempt === 'completed';
	const ready = attempt === 'ready';
	const token = orderId.slice(0, 8);
	query(`
		INSERT INTO orders (
			id, customer_name, customer_email, public_reference, confirmation_token_hash,
			confirmation_expires_at, payment_status, fulfillment_status,
			subtotal_cents, service_fee_cents, tax_cents, total_cents,
			created_at, updated_at
		) VALUES (
			'${orderId}', 'Student ${token}', '${token}@example.com', '${reference}',
			'${token.repeat(8)}', '2026-12-01T00:00:00.000Z', '${payment}', '${fulfillment}',
			2000, 500, 0, 2500, '2026-08-13T15:00:00.000Z', '2026-08-13T15:00:00.000Z'
		);
		INSERT INTO checkout_attempts (
			id, order_id, client_request_id, request_fingerprint, stripe_idempotency_key,
			stripe_session_id, payment_intent_id, stripe_charge_id, stripe_expires_at,
			checkout_ready_at, terminal_at, status, created_at, updated_at
		) VALUES (
			'${attemptId}', '${orderId}', 'request-${token}', 'fingerprint-${token}',
			'idempotency-${token}', ${session ? `'${session}'` : 'NULL'},
			${completed ? `'pi_${token}'` : 'NULL'}, ${completed ? `'ch_${token}'` : 'NULL'},
			${ready || completed ? "'2026-08-13T17:00:00.000Z'" : 'NULL'},
			${ready || completed ? "'2026-08-13T15:05:00.000Z'" : 'NULL'},
			${completed ? "'2026-08-13T15:10:00.000Z'" : 'NULL'}, '${attempt}',
			'2026-08-13T15:00:00.000Z', '2026-08-13T15:05:00.000Z'
		);
	`);
}

describe.sequential('Book Delivery jobs against disposable PostgreSQL', () => {
	beforeAll(async () => {
		clusterRoot = await mkdtemp(join(tmpdir(), 'mpc-book-job-'));
		dataDirectory = join(clusterRoot, 'data');
		socketDirectory = join(clusterRoot, 'socket');
		await mkdir(socketDirectory);
		port = await freePort();
		const initialized = run(binary('initdb'), [
			'--pgdata',
			dataDirectory,
			'--auth=trust',
			'--no-locale',
			'--encoding=UTF8'
		]);
		if (initialized.status !== 0) throw new Error(initialized.stderr);
		const started = run(binary('pg_ctl'), [
			'--pgdata',
			dataDirectory,
			'--log',
			join(clusterRoot, 'postgres.log'),
			'--options',
			`-F -k ${socketDirectory} -h 127.0.0.1 -p ${port}`,
			'--wait',
			'start'
		]);
		if (started.status !== 0) throw new Error(started.stderr);
		for (const migrationName of (await readdir(MIGRATIONS_DIRECTORY))
			.filter((name) => name.endsWith('.sql'))
			.sort()) {
			const applied = run(binary('psql'), [
				'--no-psqlrc',
				'--set',
				'ON_ERROR_STOP=1',
				'--file',
				join(MIGRATIONS_DIRECTORY, migrationName)
			]);
			if (applied.status !== 0) throw new Error(applied.stderr);
		}
		databaseUrl = `postgresql://${encodeURIComponent(process.env.USER)}@127.0.0.1:${port}/postgres`;
		query(`
			INSERT INTO bookstores (id, name, service_fee_cents) VALUES ('${BOOKSTORE_ID}', 'Campus Books', 500);
			INSERT INTO teachers (id, slug, name) VALUES ('${TEACHER_ID}', 'ada', 'Ada Lovelace');
			INSERT INTO courses (id, teacher_id, code, title) VALUES ('${COURSE_ID}', '${TEACHER_ID}', 'CSC 205', 'Data Structures');
			INSERT INTO books (id, bookstore_id, title, retailer_url, price_cents)
			VALUES ('${BOOK_ID}', '${BOOKSTORE_ID}', 'Algorithms', 'https://shop.example.com/algorithms', 2000);
		`);
		seedOrder({
			orderId: CREATED_ORDER,
			attemptId: CREATED_ATTEMPT,
			reference: 'MPC-ABCDEFGH2345',
			payment: 'pending',
			fulfillment: 'unstarted',
			attempt: 'created',
			session: null
		});
		seedOrder({
			orderId: READY_ORDER,
			attemptId: READY_ATTEMPT,
			reference: 'MPC-BCDEFGHJK234',
			payment: 'pending',
			fulfillment: 'unstarted',
			attempt: 'ready',
			session: 'cs_test_ready'
		});
		seedOrder({
			orderId: PAID_ORDER,
			attemptId: PAID_ATTEMPT,
			reference: 'MPC-CDEFGHJK2345',
			payment: 'paid',
			fulfillment: 'purchasing',
			attempt: 'completed',
			session: 'cs_test_paid'
		});
		seedOrder({
			orderId: PURGE_ORDER,
			attemptId: '88888888-8888-4888-8888-888888888888',
			reference: 'MPC-DEFGHJK23456',
			payment: 'cancelled',
			fulfillment: 'unstarted',
			attempt: 'ready',
			session: 'cs_test_purge'
		});
		query(`
			UPDATE orders SET customer_name = '[removed]', confirmation_token_hash = NULL,
				confirmation_expires_at = NULL, pii_purge_after = '2026-08-13T17:00:00.000Z'
			WHERE id = '${PURGE_ORDER}';
			INSERT INTO rate_limit_buckets (bucket_key, scope, count, window_started_at, expires_at)
			VALUES ('rl:v1:staff_session:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'staff_session', 1,
				'2026-08-13T16:00:00.000Z', '2026-08-13T17:00:00.000Z');
		`);
	}, 30000);

	afterAll(async () => {
		if (dataDirectory) {
			run(binary('pg_ctl'), ['--pgdata', dataDirectory, '--mode', 'immediate', '--wait', 'stop']);
		}
		if (clusterRoot) await rm(clusterRoot, { recursive: true, force: true });
	});

	it('finds due candidates and keeps paid fulfilled work out of reconciliation', async () => {
		const candidates = await runTransaction((transaction) =>
			listReconciliationCandidatesInTransaction(transaction, { now: NOW })
		);
		expect(candidates.map(({ orderId }) => orderId)).toEqual([CREATED_ORDER, READY_ORDER]);
		expect(candidates.some(({ orderId }) => orderId === PAID_ORDER)).toBe(false);
	});

	it('allows one concurrent abandoned-attempt transition and audits it once', async () => {
		const [candidate] = await runTransaction((transaction) =>
			listReconciliationCandidatesInTransaction(transaction, { now: NOW })
		);
		const results = await Promise.all([
			runTransaction((transaction) =>
				failAbandonedCheckoutAttemptInTransaction(transaction, { candidate, now: NOW })
			),
			runTransaction((transaction) =>
				failAbandonedCheckoutAttemptInTransaction(transaction, { candidate, now: NOW })
			)
		]);
		expect(results.map(({ disposition }) => disposition).sort()).toEqual(['applied', 'stale']);
		expect(
			query(
				`SELECT payment_status || ':' || version::text FROM orders WHERE id = '${CREATED_ORDER}'`
			)
		).toBe('failed:2');
		expect(
			query(
				`SELECT status || ':' || version::text FROM checkout_attempts WHERE id = '${CREATED_ATTEMPT}'`
			)
		).toBe('failed:2');
		expect(
			query(
				`SELECT count(*) FROM audit_log WHERE order_id = '${CREATED_ORDER}' AND action = 'reconciliation_abandoned_failed'`
			)
		).toBe('1');
	});

	it('keeps a provider-paid result when a delayed expiry retry arrives', async () => {
		const [candidate] = await runTransaction((transaction) =>
			listReconciliationCandidatesInTransaction(transaction, { now: NOW })
		);
		const evidence = {
			kind: 'completed',
			orderId: candidate.orderId,
			attemptId: candidate.attemptId,
			sessionId: candidate.sessionId,
			paymentIntentId: 'pi_ready',
			chargeId: 'ch_ready',
			totalCents: candidate.totalCents,
			refundedAmountCents: 0,
			receiptEmail: candidate.customerEmail,
			expiresAt: candidate.expiresAt
		};
		await expect(
			runTransaction((transaction) =>
				reconcileProviderEvidenceInTransaction(transaction, { evidence, now: NOW })
			)
		).resolves.toEqual({ disposition: 'applied', paymentStatus: 'paid' });
		await expect(
			runTransaction((transaction) =>
				reconcileProviderEvidenceInTransaction(transaction, {
					evidence: {
						...evidence,
						kind: 'expired',
						paymentIntentId: null,
						chargeId: null,
						receiptEmail: null
					},
					now: NOW
				})
			)
		).resolves.toEqual({ disposition: 'stale' });
		expect(query(`SELECT payment_status FROM orders WHERE id = '${READY_ORDER}'`)).toBe('paid');
		expect(query(`SELECT fulfillment_status FROM orders WHERE id = '${READY_ORDER}'`)).toBe(
			'unstarted'
		);
	});

	it('purges due customer data, invalidates capabilities, and cleans expired rate buckets once', async () => {
		await expect(
			runTransaction((transaction) => purgeDueCustomerDataInTransaction(transaction, { now: NOW }))
		).resolves.toEqual({ purged: 1 });
		expect(
			query(
				`SELECT customer_name || ':' || customer_email || ':' || (confirmation_token_hash IS NULL)::text FROM orders WHERE id = '${PURGE_ORDER}'`
			)
		).toBe('[removed]:removed@invalid.local:true');
		expect(
			query(
				`SELECT previous_state ->> 'capabilityActive' FROM audit_log WHERE order_id = '${PURGE_ORDER}' AND action = 'customer_data_anonymized'`
			)
		).toBe('false');
		await expect(
			runTransaction((transaction) => purgeDueCustomerDataInTransaction(transaction, { now: NOW }))
		).resolves.toEqual({ purged: 0 });
		await expect(
			runTransaction((transaction) =>
				cleanupExpiredRateBucketsInTransaction(transaction, { now: NOW })
			)
		).resolves.toEqual({ deleted: 1 });
	});

	it('purges one capability-only residual under concurrency and audits it once', async () => {
		query(`
			INSERT INTO orders (
				id, customer_name, customer_email, public_reference,
				confirmation_token_hash, confirmation_expires_at,
				payment_status, fulfillment_status, pii_purge_after
			) VALUES (
				'${CAPABILITY_ONLY_ORDER}', '[removed]', 'removed@invalid.local',
				'MPC-CAPABILITY01', '${'c'.repeat(64)}', '2026-08-13T19:00:00.000Z',
				'cancelled', 'unstarted', '2026-08-13T17:00:00.000Z'
			)
		`);

		const results = await Promise.all([
			runTransaction((transaction) =>
				purgeDueCustomerDataInTransaction(transaction, { now: NOW, limit: 10 })
			),
			runTransaction((transaction) =>
				purgeDueCustomerDataInTransaction(transaction, { now: NOW, limit: 10 })
			)
		]);

		expect(results.map(({ purged }) => purged).sort()).toEqual([0, 1]);
		expect(
			query(
				`SELECT (confirmation_token_hash IS NULL)::text || ':' || (confirmation_expires_at IS NULL)::text FROM orders WHERE id = '${CAPABILITY_ONLY_ORDER}'`
			)
		).toBe('true:true');
		expect(
			query(
				`SELECT count(*) FROM audit_log WHERE order_id = '${CAPABILITY_ONLY_ORDER}' AND action = 'customer_data_anonymized'`
			)
		).toBe('1');
		expect(
			query(
				`SELECT (previous_state ->> 'piiPresent') || ':' || (previous_state ->> 'capabilityActive') FROM audit_log WHERE order_id = '${CAPABILITY_ONLY_ORDER}' AND action = 'customer_data_anonymized'`
			)
		).toBe('false:true');
	});

	it('purges a partially anonymized terminal row without an active capability', async () => {
		query(`
			INSERT INTO orders (
				id, customer_name, customer_email, public_reference,
				payment_status, fulfillment_status, pii_purge_after
			) VALUES (
				'${PARTIAL_PII_ORDER}', 'Student Leftover', 'removed@invalid.local',
				'MPC-PARTIALPII1', 'failed', 'unstarted', '2026-08-13T17:00:00.000Z'
			)
		`);

		await expect(
			runTransaction((transaction) =>
				purgeDueCustomerDataInTransaction(transaction, { now: NOW, limit: 10 })
			)
		).resolves.toEqual({ purged: 1 });
		expect(
			query(
				`SELECT customer_name || ':' || customer_email FROM orders WHERE id = '${PARTIAL_PII_ORDER}'`
			)
		).toBe('[removed]:removed@invalid.local');
		expect(
			query(
				`SELECT (previous_state ->> 'piiPresent') || ':' || (previous_state ->> 'capabilityActive') FROM audit_log WHERE order_id = '${PARTIAL_PII_ORDER}' AND action = 'customer_data_anonymized'`
			)
		).toBe('true:false');
	});
});
