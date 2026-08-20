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
	StaffOrderConflictError,
	StaffOrderUnavailableError,
	createStaffOrderRepository
} from './staff-repository.js';

const POSTGRES_BIN = '/Applications/Postgres.app/Contents/Versions/latest/bin';
const MIGRATIONS_DIRECTORY = resolve('drizzle');
const APPROVED_HOSTS = ['shop.example.com'];
const STAFF_USER_ID = 'staff-user-id';
const STAFF_EMAIL = 'team@marihacks.com';
const NOW = new Date('2026-08-13T18:00:00.000Z');
const BOOKSTORE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TEACHER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const COURSE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BOOK_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ORDERS = Object.freeze({
	ledger: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'MPC-ABCDEFGH2345'],
	concurrent: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'MPC-BCDEFGHJK234'],
	rollback: ['99999999-9999-4999-8999-999999999999', 'MPC-CDEFGHJK2345'],
	cancel: ['88888888-8888-4888-8888-888888888888', 'MPC-DEFGHJK23456'],
	race: ['77777777-7777-4777-8777-777777777777', 'MPC-EFGHJK234567']
});

let clusterRoot;
let dataDirectory;
let socketDirectory;
let port;
let databaseUrl;
let requestSequence = 1;

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

function repository() {
	return createStaffOrderRepository({
		databaseUrl,
		approvedHostnames: APPROVED_HOSTS,
		runTransaction,
		getNow: () => NOW
	});
}

function actor() {
	const suffix = String(requestSequence++).padStart(12, '0');
	return {
		userId: STAFF_USER_ID,
		email: STAFF_EMAIL,
		requestId: `60000000-0000-4000-8000-${suffix}`
	};
}

function seedOrder([orderId, reference], attemptId, paymentStatus) {
	const completed = paymentStatus === 'paid';
	const token = orderId.slice(0, 8);
	query(`
		INSERT INTO orders (
			id, customer_name, customer_email, public_reference, payment_status,
			subtotal_cents, service_fee_cents, tax_cents, total_cents,
			created_at, updated_at
		) VALUES (
			'${orderId}', 'Student ${token}', '${token}@example.com', '${reference}',
			'${paymentStatus}', 4200, 500, 704, 5404,
			'2026-08-13T14:00:00.000Z', '2026-08-13T15:00:00.000Z'
		);
		INSERT INTO checkout_attempts (
			id, order_id, client_request_id, request_fingerprint, stripe_idempotency_key,
			stripe_session_id, payment_intent_id, stripe_charge_id, stripe_expires_at,
			checkout_ready_at, terminal_at, status
		) VALUES (
			'${attemptId}', '${orderId}', 'request-${token}', 'fingerprint-${token}',
			'idempotency-${token}', 'cs_test_${token}',
			${completed ? `'pi_${token}'` : 'NULL'}, ${completed ? `'ch_${token}'` : 'NULL'},
			'2026-08-14T14:00:00.000Z', '2026-08-13T14:05:00.000Z',
			${completed ? "'2026-08-13T14:10:00.000Z'" : 'NULL'},
			'${completed ? 'completed' : 'ready'}'
		);
		INSERT INTO order_lines (
			order_id, kind, label, isbn, bookstore_id, bookstore_name, book_id,
			teacher_id, teacher_name, course_id, course_code, course_title,
			quantity, unit_amount_cents, line_amount_cents
		) VALUES
		(
			'${orderId}', 'book', 'The C Programming Language', '9780131103627',
			'${BOOKSTORE_ID}', 'Campus Books', '${BOOK_ID}', '${TEACHER_ID}',
			'Ada Lovelace', '${COURSE_ID}', 'CSC 205', 'Data Structures', 1, 4200, 4200
		),
		(
			'${orderId}', 'service_fee', 'Campus Books pickup service', NULL,
			'${BOOKSTORE_ID}', 'Campus Books', NULL, NULL, NULL, NULL, NULL, NULL, 1, 500, 500
		);
	`);
}

describe.sequential('staff order operations against disposable PostgreSQL', () => {
	beforeAll(async () => {
		clusterRoot = await mkdtemp(join(tmpdir(), 'mpc-staff-orders-'));
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
			INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
			VALUES ('${STAFF_USER_ID}', 'Programming Club Staff', '${STAFF_EMAIL}', true, now(), now());
			INSERT INTO bookstores (id, name, service_fee_cents)
			VALUES ('${BOOKSTORE_ID}', 'Campus Books', 500);
			INSERT INTO teachers (id, slug, name)
			VALUES ('${TEACHER_ID}', 'ada-lovelace', 'Ada Lovelace');
			INSERT INTO courses (id, teacher_id, code, title)
			VALUES ('${COURSE_ID}', '${TEACHER_ID}', 'CSC 205', 'Data Structures');
			INSERT INTO books (id, bookstore_id, title, isbn, retailer_url, price_cents)
			VALUES (
				'${BOOK_ID}', '${BOOKSTORE_ID}', 'The C Programming Language',
				'9780131103627', 'https://shop.example.com/books/c-programming', 4200
			);
		`);
		seedOrder(ORDERS.ledger, '11111111-1111-4111-8111-111111111111', 'paid');
		seedOrder(ORDERS.concurrent, '22222222-2222-4222-8222-222222222222', 'paid');
		seedOrder(ORDERS.rollback, '33333333-3333-4333-8333-333333333333', 'paid');
		seedOrder(ORDERS.cancel, '44444444-4444-4444-8444-444444444444', 'pending');
		seedOrder(ORDERS.race, '55555555-5555-4555-8555-555555555555', 'pending');
	}, 30000);

	afterAll(async () => {
		if (dataDirectory) {
			run(binary('pg_ctl'), ['--pgdata', dataDirectory, '--mode', 'immediate', '--wait', 'stop']);
		}
		if (clusterRoot) await rm(clusterRoot, { recursive: true, force: true });
	});

	it('loads the masked ledger, exact search, protected receipt, and privacy-safe purchase rows', async () => {
		const staffOrders = repository();
		await expect(
			staffOrders.listStaffOrders({ payment: '', fulfillment: '', page: '' })
		).resolves.toMatchObject({
			totalCount: 3,
			orders: expect.arrayContaining([
				expect.objectContaining({
					id: ORDERS.ledger[0],
					maskedEmail: 'a******a@example.com',
					paymentStatus: 'paid'
				})
			])
		});
		await expect(staffOrders.searchStaffOrders('AAAAAAAA@example.com', '1')).resolves.toMatchObject(
			{
				totalCount: 1,
				orders: [{ id: ORDERS.ledger[0] }]
			}
		);
		await expect(staffOrders.getStaffOrderDetail(ORDERS.ledger[0])).resolves.toMatchObject({
			customer: { name: 'Student aaaaaaaa', email: 'aaaaaaaa@example.com' },
			provider: {
				checkoutSessionId: 'cs_test_aaaaaaaa',
				paymentIntentId: 'pi_aaaaaaaa',
				chargeId: 'ch_aaaaaaaa'
			},
			bookstores: [
				{
					name: 'Campus Books',
					lines: [
						expect.objectContaining({
							label: 'The C Programming Language',
							currentRetailerUrl: 'https://shop.example.com/books/c-programming'
						}),
						expect.objectContaining({ kind: 'service_fee' })
					]
				}
			]
		});
		await expect(staffOrders.listBookstorePurchaseRows()).resolves.toEqual([
			{
				bookstore: 'Campus Books',
				title: 'The C Programming Language',
				isbn: '9780131103627',
				quantity: 3
			}
		]);
	});

	it('allows one of two concurrent fulfillment writers and audits only the winner', async () => {
		const first = repository();
		const second = repository();
		const settled = await Promise.allSettled([
			first.advanceFulfillment({
				orderId: ORDERS.concurrent[0],
				expectedVersion: 1,
				actor: actor()
			}),
			second.advanceFulfillment({
				orderId: ORDERS.concurrent[0],
				expectedVersion: 1,
				actor: actor()
			})
		]);
		expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		expect(settled.find(({ status }) => status === 'rejected').reason).toBeInstanceOf(
			StaffOrderConflictError
		);
		expect(
			query(
				`SELECT fulfillment_status || ':' || version::text FROM orders WHERE id = '${ORDERS.concurrent[0]}'`
			)
		).toBe('purchasing:2');
		expect(
			query(
				`SELECT count(*) FROM audit_log WHERE order_id = '${ORDERS.concurrent[0]}' AND action = 'staff_fulfillment_purchasing'`
			)
		).toBe('1');
	});

	it('rolls back fulfillment when the same-transaction audit insert fails', async () => {
		query(`
			CREATE FUNCTION reject_staff_order_audit() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				IF NEW.action = 'staff_fulfillment_purchasing' THEN RAISE EXCEPTION 'forced audit failure'; END IF;
				RETURN NEW;
			END $$;
			CREATE TRIGGER reject_staff_order_audit BEFORE INSERT ON audit_log
			FOR EACH ROW EXECUTE FUNCTION reject_staff_order_audit();
		`);
		await expect(
			repository().advanceFulfillment({
				orderId: ORDERS.rollback[0],
				expectedVersion: 1,
				actor: actor()
			})
		).rejects.toBeInstanceOf(StaffOrderUnavailableError);
		expect(
			query(
				`SELECT fulfillment_status || ':' || version::text FROM orders WHERE id = '${ORDERS.rollback[0]}'`
			)
		).toBe('unstarted:1');
		query(
			'DROP TRIGGER reject_staff_order_audit ON audit_log; DROP FUNCTION reject_staff_order_audit();'
		);
	});

	it('cancels an expired unpaid provider Session atomically and schedules PII purge', async () => {
		const staffOrders = repository();
		const seed = await staffOrders.loadCancellationSeed({
			orderId: ORDERS.cancel[0],
			expectedVersion: 1
		});
		await expect(
			staffOrders.cancelOrder({
				orderId: ORDERS.cancel[0],
				expectedVersion: 1,
				evidence: {
					orderId: seed.orderId,
					attemptId: seed.attemptId,
					sessionId: seed.sessionId,
					paymentIntentId: seed.paymentIntentId,
					totalCents: seed.totalCents,
					customerEmail: seed.customerEmail,
					providerStatus: 'expired'
				},
				actor: actor(),
				now: NOW
			})
		).resolves.toMatchObject({ paymentStatus: 'cancelled', version: 2 });
		expect(
			query(`
				SELECT o.payment_status || ':' || o.version::text || ':' || ca.status || ':' ||
					(o.pii_purge_after IS NOT NULL)::text
				FROM orders o JOIN checkout_attempts ca ON ca.order_id = o.id
				WHERE o.id = '${ORDERS.cancel[0]}'
			`)
		).toBe('cancelled:2:expired:true');
		expect(
			query(
				`SELECT count(*) FROM audit_log WHERE order_id = '${ORDERS.cancel[0]}' AND action = 'staff_order_cancelled'`
			)
		).toBe('1');
	});

	it('lets a paid webhook transition between cancellation phases win', async () => {
		const staffOrders = repository();
		const seed = await staffOrders.loadCancellationSeed({
			orderId: ORDERS.race[0],
			expectedVersion: 1
		});
		query(`
			BEGIN;
			UPDATE checkout_attempts SET status = 'completed', payment_intent_id = 'pi_race',
				stripe_charge_id = 'ch_race', terminal_at = now(), version = version + 1
			WHERE id = '${seed.attemptId}';
			UPDATE orders SET payment_status = 'paid', version = version + 1
			WHERE id = '${ORDERS.race[0]}';
			COMMIT;
		`);
		await expect(
			staffOrders.cancelOrder({
				orderId: ORDERS.race[0],
				expectedVersion: 1,
				evidence: {
					orderId: seed.orderId,
					attemptId: seed.attemptId,
					sessionId: seed.sessionId,
					paymentIntentId: seed.paymentIntentId,
					totalCents: seed.totalCents,
					customerEmail: seed.customerEmail,
					providerStatus: 'expired'
				},
				actor: actor(),
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderConflictError);
		expect(
			query(
				`SELECT payment_status || ':' || version::text FROM orders WHERE id = '${ORDERS.race[0]}'`
			)
		).toBe('paid:2');
		expect(
			query(
				`SELECT count(*) FROM audit_log WHERE order_id = '${ORDERS.race[0]}' AND action = 'staff_order_cancelled'`
			)
		).toBe('0');
	});
});
