// @vitest-environment node

import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadOrderConfirmationInTransaction } from './confirmation.js';
import { hashConfirmationCapability } from './request.js';

const POSTGRES_BIN = '/Applications/Postgres.app/Contents/Versions/latest/bin';
const MIGRATIONS_DIRECTORY = resolve('drizzle');
const dialect = new PgDialect();
const NOW = new Date('2026-08-13T18:00:00.000Z');
const REFERENCE = 'MPC-ABCDEFGHJK23';
const EXPIRED_REFERENCE = 'MPC-BCDEFGHJK234';
const CAPABILITY = Buffer.alloc(32, 7).toString('base64url');
const EXPIRED_CAPABILITY = Buffer.alloc(32, 8).toString('base64url');

const NUMBER_COLUMNS = new Set([
	'subtotal_cents',
	'service_fee_cents',
	'tax_cents',
	'total_cents',
	'refunded_amount_cents',
	'quantity',
	'unit_amount_cents',
	'line_amount_cents'
]);

/** @type {string | undefined} */
let clusterRoot;
/** @type {string | undefined} */
let dataDirectory;
/** @type {string | undefined} */
let socketDirectory;
/** @type {number | undefined} */
let port;

/** @param {string} name */
function binary(name) {
	return join(POSTGRES_BIN, name);
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptionsWithStringEncoding} [options]
 */
function run(command, args, options = { encoding: 'utf8' }) {
	return spawnSync(command, args, {
		env: {
			...process.env,
			PGHOST: socketDirectory,
			PGPORT: String(port),
			PGDATABASE: 'postgres',
			PGUSER: process.env.USER
		},
		...options,
		encoding: 'utf8'
	});
}

/** @param {string} statement */
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

async function freePort() {
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

/** @param {unknown} drizzleQuery */
async function executeWithPsql(drizzleQuery) {
	const compiled = dialect.sqlToQuery(/** @type {any} */ (drizzleQuery));
	const script = `${compiled.sql}\n\\bind ${compiled.params
		.map(
			(value) =>
				`'${(value instanceof Date ? value.toISOString() : String(value)).replaceAll("'", "''")}'`
		)
		.join(' ')}\n\\g`;

	return new Promise((resolveResult, reject) => {
		const child = spawn(binary('psql'), ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--csv'], {
			env: {
				...process.env,
				PGHOST: socketDirectory,
				PGPORT: String(port),
				PGDATABASE: 'postgres',
				PGUSER: process.env.USER
			},
			stdio: ['pipe', 'pipe', 'pipe']
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => (stdout += chunk));
		child.stderr.on('data', (chunk) => (stderr += chunk));
		child.once('error', reject);
		child.once('exit', (code) => {
			if (code !== 0) {
				reject(new Error(stderr || stdout));
				return;
			}
			const [header = '', ...data] = stdout.trim().split('\n');
			const names = header.length === 0 ? [] : header.split(',');
			resolveResult({
				rows: data.filter(Boolean).map((line) => {
					const values = line.split(',');
					return Object.fromEntries(
						names.map((name, index) => {
							const value = values[index] ?? '';
							return [name, value === '' ? null : NUMBER_COLUMNS.has(name) ? Number(value) : value];
						})
					);
				})
			});
		});
		child.stdin.end(script);
	});
}

/** @param {{ publicReference: string, capability: string }} input */
function loadFromPostgres(input) {
	return loadOrderConfirmationInTransaction({ execute: executeWithPsql }, { ...input, now: NOW });
}

describe.sequential('guest confirmation against disposable PostgreSQL', () => {
	beforeAll(async () => {
		clusterRoot = await mkdtemp('/tmp/mpc-confirmation-');
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
			`-F -k ${socketDirectory} -p ${port}`,
			'--wait',
			'start'
		]);
		if (started.status !== 0) throw new Error(started.stderr);

		for (const migrationName of (await readdir(MIGRATIONS_DIRECTORY))
			.filter((name) => name.endsWith('.sql'))
			.sort()) {
			await readFile(join(MIGRATIONS_DIRECTORY, migrationName), 'utf8');
			const applied = run(binary('psql'), [
				'--no-psqlrc',
				'--set',
				'ON_ERROR_STOP=1',
				'--file',
				join(MIGRATIONS_DIRECTORY, migrationName)
			]);
			if (applied.status !== 0) throw new Error(applied.stderr);
		}

		query(`
			INSERT INTO bookstores (id, name, service_fee_cents)
			VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Campus Books', 500);
			INSERT INTO teachers (id, slug, name)
			VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'ada-lovelace', 'Ada Lovelace');
			INSERT INTO courses (id, teacher_id, code, title)
			VALUES (
				'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
				'ffffffff-ffff-4fff-8fff-ffffffffffff',
				'CSC 205',
				'Data Structures'
			);
			INSERT INTO books (id, bookstore_id, title, isbn, retailer_url, price_cents)
			VALUES (
				'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
				'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
				'Algorithms',
				'9780000000000',
				'https://books.example/algorithms',
				2000
			);
			INSERT INTO orders (
				id, customer_name, customer_email, public_reference,
				confirmation_token_hash, confirmation_expires_at, payment_status,
				subtotal_cents, service_fee_cents, tax_cents, total_cents
			) VALUES
			(
				'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Maya Chen', 'maya.chen@marianopolis.edu',
				'${REFERENCE}', '${hashConfirmationCapability(CAPABILITY)}', '2026-08-14T18:00:00.000Z',
				'paid', 4000, 500, 674, 5174
			),
			(
				'99999999-9999-4999-8999-999999999999', 'Alex Smith', 'alex.smith@example.com',
				'${EXPIRED_REFERENCE}', '${hashConfirmationCapability(EXPIRED_CAPABILITY)}', '${NOW.toISOString()}',
				'paid', 4000, 500, 674, 5174
			);
			INSERT INTO checkout_attempts (
				id, order_id, client_request_id, request_fingerprint, stripe_idempotency_key,
				stripe_session_id, payment_intent_id, stripe_charge_id, stripe_expires_at,
				checkout_ready_at, terminal_at, status
			) VALUES
			(
				'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				'ckr1_AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE', 'fingerprint-one', 'idempotency-one',
				'cs_test_one', 'pi_test_one', 'ch_test_one', '2026-08-14T18:00:00.000Z',
				'2026-08-13T17:00:00.000Z', '2026-08-13T17:30:00.000Z', 'completed'
			),
			(
				'88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999',
				'ckr1_AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI', 'fingerprint-two', 'idempotency-two',
				'cs_test_two', 'pi_test_two', 'ch_test_two', '2026-08-14T18:00:00.000Z',
				'2026-08-13T17:00:00.000Z', '2026-08-13T17:30:00.000Z', 'completed'
			);
			INSERT INTO order_lines (
				order_id, kind, label, isbn, bookstore_id, bookstore_name, book_id,
				teacher_id, teacher_name, course_id, course_code, course_title,
				quantity, unit_amount_cents, line_amount_cents
			)
			SELECT order_id, kind, label, isbn, bookstore_id, bookstore_name, book_id,
				teacher_id, teacher_name, course_id, course_code, course_title,
				quantity, unit_amount_cents, line_amount_cents
			FROM (VALUES
				('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'book', 'Algorithms', '9780000000000', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, 'Campus Books', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 'Ada Lovelace', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'CSC 205', 'Data Structures', 2, 2000, 4000),
				('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'service_fee', 'Campus Books pickup service', NULL, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, 'Campus Books', NULL, NULL, NULL, NULL, NULL, NULL, 1, 500, 500),
				('99999999-9999-4999-8999-999999999999'::uuid, 'book', 'Algorithms', '9780000000000', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, 'Campus Books', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 'Ada Lovelace', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'CSC 205', 'Data Structures', 2, 2000, 4000),
				('99999999-9999-4999-8999-999999999999'::uuid, 'service_fee', 'Campus Books pickup service', NULL, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, 'Campus Books', NULL, NULL, NULL, NULL, NULL, NULL, 1, 500, 500)
			) AS snapshot(order_id, kind, label, isbn, bookstore_id, bookstore_name, book_id,
				teacher_id, teacher_name, course_id, course_code, course_title,
				quantity, unit_amount_cents, line_amount_cents);
		`);
	}, 30000);

	afterAll(async () => {
		if (dataDirectory) {
			run(binary('pg_ctl'), ['--pgdata', dataDirectory, '--mode', 'immediate', '--wait', 'stop']);
		}
		if (clusterRoot) await rm(clusterRoot, { recursive: true, force: true });
	});

	it('loads one immutable masked receipt without changing payment or attempt state', async () => {
		const before = query(`
			SELECT o.payment_status || ':' || o.fulfillment_status || ':' || o.version || ':' ||
				ca.status || ':' || ca.version
			FROM orders o JOIN checkout_attempts ca ON ca.order_id = o.id
			WHERE o.public_reference = '${REFERENCE}'
		`);

		await expect(
			loadFromPostgres({ publicReference: REFERENCE, capability: CAPABILITY })
		).resolves.toMatchObject({
			state: 'paid',
			orderReference: REFERENCE,
			receiptEmail: 'm***@marianopolis.edu',
			totalCents: 5174,
			books: [{ title: 'Algorithms', quantity: 2 }]
		});

		expect(
			query(`
				SELECT o.payment_status || ':' || o.fulfillment_status || ':' || o.version || ':' ||
					ca.status || ':' || ca.version
				FROM orders o JOIN checkout_attempts ca ON ca.order_id = o.id
				WHERE o.public_reference = '${REFERENCE}'
			`)
		).toBe(before);
	});

	it('fails closed for forged, cross-order, and exactly expired capabilities', async () => {
		await expect(
			loadFromPostgres({
				publicReference: REFERENCE,
				capability: Buffer.alloc(32, 9).toString('base64url')
			})
		).resolves.toBeNull();
		await expect(
			loadFromPostgres({ publicReference: EXPIRED_REFERENCE, capability: CAPABILITY })
		).resolves.toBeNull();
		await expect(
			loadFromPostgres({
				publicReference: EXPIRED_REFERENCE,
				capability: EXPIRED_CAPABILITY
			})
		).resolves.toBeNull();
	});

	it('serves concurrent authorized reads without one-time mutation or data loss', async () => {
		const receipts = await Promise.all(
			Array.from({ length: 12 }, () =>
				loadFromPostgres({ publicReference: REFERENCE, capability: CAPABILITY })
			)
		);

		expect(receipts).toHaveLength(12);
		expect(receipts.every((receipt) => receipt?.orderReference === REFERENCE)).toBe(true);
		expect(new Set(receipts.map((receipt) => JSON.stringify(receipt)))).toHaveLength(1);
		expect(query(`SELECT count(*) FROM orders WHERE public_reference = '${REFERENCE}'`)).toBe('1');
		expect(query("SELECT count(*) FROM audit_log WHERE action LIKE 'confirmation%'")).toBe('0');
	});
});
