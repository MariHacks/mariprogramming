// @vitest-environment node

import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const POSTGRES_BIN = '/Applications/Postgres.app/Contents/Versions/latest/bin';
const MIGRATIONS_DIRECTORY = resolve('drizzle');

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
function sql(statement) {
	return run(binary('psql'), [
		'--no-psqlrc',
		'--set',
		'ON_ERROR_STOP=1',
		'--tuples-only',
		'--command',
		statement
	]);
}

/** @param {string} statement */
function query(statement) {
	const result = sql(statement);
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout);
	}
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

/** @param {string} statement */
async function concurrentSql(statement) {
	return new Promise((resolveResult) => {
		const child = spawn(
			binary('psql'),
			['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--command', statement],
			{
				env: {
					...process.env,
					PGHOST: socketDirectory,
					PGPORT: String(port),
					PGDATABASE: 'postgres',
					PGUSER: process.env.USER
				},
				stdio: 'ignore'
			}
		);
		child.once('exit', (code) => resolveResult(code));
	});
}

describe.sequential('committed migration against disposable PostgreSQL', () => {
	beforeAll(async () => {
		clusterRoot = await mkdtemp(join(tmpdir(), 'club-book-delivery-wu2-'));
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

		const migrations = (await readdir(MIGRATIONS_DIRECTORY))
			.filter((name) => name.endsWith('.sql'))
			.sort();
		expect(migrations).toHaveLength(7);
		const migrationSql = [];
		for (const migrationName of migrations) {
			const migration = await readFile(join(MIGRATIONS_DIRECTORY, migrationName), 'utf8');
			migrationSql.push(migration);
			const applied = run(binary('psql'), [
				'--no-psqlrc',
				'--set',
				'ON_ERROR_STOP=1',
				'--file',
				join(MIGRATIONS_DIRECTORY, migrationName)
			]);
			if (applied.status !== 0) throw new Error(applied.stderr);
		}
		const combinedMigration = migrationSql.join('\n');
		expect(combinedMigration).toContain('CREATE TRIGGER "order_lines_immutable"');
		expect(combinedMigration).toContain('CREATE TRIGGER "audit_log_append_only"');
		expect(combinedMigration).toContain('checkout_attempts_nonterminal_fingerprint_unique_idx');
		expect(combinedMigration).toContain('orders_fulfillment_payment_consistent');
		expect(combinedMigration).toContain('orders_staff_ledger_idx');
		expect(combinedMigration).toContain('orders_staff_email_created_idx');
	}, 30000);

	afterAll(async () => {
		if (dataDirectory) {
			run(binary('pg_ctl'), ['--pgdata', dataDirectory, '--mode', 'immediate', '--wait', 'stop']);
		}
		if (clusterRoot) await rm(clusterRoot, { recursive: true, force: true });
	});

	it('applies all tables, foreign keys, indexes, and named checks', () => {
		expect(
			query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
		).toBe('20');
		expect(query("SELECT count(*) FROM pg_constraint WHERE contype IN ('c', 'f')")).toBe('87');
		expect(query("SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'")).toBe('79');
		expect(
			query(
				"SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'event_deliveries_sink_valid'"
			)
		).toContain("'postmark'");
	});

	it('commits and rolls back atomically', () => {
		expect(
			sql(
				"BEGIN; INSERT INTO teachers (slug, name) VALUES ('rolled-back', 'Rolled Back'); ROLLBACK;"
			).status
		).toBe(0);
		expect(query("SELECT count(*) FROM teachers WHERE slug = 'rolled-back'")).toBe('0');
		expect(
			sql("BEGIN; INSERT INTO teachers (slug, name) VALUES ('committed', 'Committed'); COMMIT;")
				.status
		).toBe(0);
		expect(query("SELECT count(*) FROM teachers WHERE slug = 'committed'")).toBe('1');
	});

	it.each([
		['non-CAD currency', 'currency', "'usd'"],
		['negative subtotal', 'subtotal_cents', '-1'],
		['incorrect total equation', 'total_cents', '1'],
		['invalid payment status', 'payment_status', "'forged'"],
		['invalid fulfillment status', 'fulfillment_status', "'shipped'"],
		['non-positive version', 'version', '0']
	])('rejects an order with %s', (_label, column, value) => {
		const result = sql(
			`INSERT INTO orders (customer_name, customer_email, public_reference, ${column}) VALUES ('Student', 'student@example.com', gen_random_uuid()::text, ${value})`
		);
		expect(result.status).not.toBe(0);
	});

	it('rejects impossible unpaid fulfillment while preserving paid and refunded history', () => {
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, fulfillment_status) VALUES ('A', 'a@example.com', 'STATE-PENDING', 'pending', 'purchasing')"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, fulfillment_status) VALUES ('A', 'a@example.com', 'STATE-EXPIRED', 'expired', 'received')"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, fulfillment_status) VALUES ('A', 'a@example.com', 'STATE-PAID', 'paid', 'purchasing')"
			).status
		).toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, fulfillment_status, subtotal_cents, total_cents, refunded_amount_cents) VALUES ('A', 'a@example.com', 'STATE-REFUNDED', 'refunded', 'received', 1000, 1000, 1000)"
			).status
		).toBe(0);
	});

	it('enforces cumulative refund amount and payment-state consistency', () => {
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, subtotal_cents, total_cents, refunded_amount_cents) VALUES ('A', 'a@example.com', 'REFUND-NEGATIVE', 1000, 1000, -1)"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, subtotal_cents, total_cents, refunded_amount_cents) VALUES ('A', 'a@example.com', 'REFUND-EXCESS', 1000, 1000, 1001)"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, subtotal_cents, total_cents, refunded_amount_cents) VALUES ('A', 'a@example.com', 'REFUND-PENDING', 'pending', 1000, 1000, 1)"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, subtotal_cents, total_cents, refunded_amount_cents) VALUES ('A', 'a@example.com', 'REFUND-PARTIAL-ZERO', 'partially_refunded', 1000, 1000, 0)"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, subtotal_cents, total_cents, refunded_amount_cents) VALUES ('A', 'a@example.com', 'REFUND-PARTIAL-FULL', 'partially_refunded', 1000, 1000, 1000)"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, subtotal_cents, total_cents, refunded_amount_cents) VALUES ('A', 'a@example.com', 'REFUND-FULL-SHORT', 'refunded', 1000, 1000, 999)"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, subtotal_cents, total_cents, refunded_amount_cents) VALUES ('A', 'a@example.com', 'REFUND-PARTIAL-VALID', 'partially_refunded', 1000, 1000, 400)"
			).status
		).toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, payment_status, subtotal_cents, total_cents, refunded_amount_cents) VALUES ('A', 'a@example.com', 'REFUND-FULL-VALID', 'refunded', 1000, 1000, 1000)"
			).status
		).toBe(0);
	});

	it('rejects catalogue fees outside $5 through $7 and negative prices', () => {
		expect(
			sql("INSERT INTO bookstores (name, service_fee_cents) VALUES ('Too Low', 499)").status
		).not.toBe(0);
		expect(
			sql("INSERT INTO bookstores (name, service_fee_cents) VALUES ('Too High', 701)").status
		).not.toBe(0);
		const bookstoreId = query(
			"WITH inserted AS (INSERT INTO bookstores (name, service_fee_cents) VALUES ('Valid Store', 500) RETURNING id) SELECT id FROM inserted"
		);
		expect(
			sql("INSERT INTO bookstores (name, service_fee_cents) VALUES ('Seven Dollar Store', 700)")
				.status
		).toBe(0);
		expect(
			sql(
				`INSERT INTO books (bookstore_id, title, retailer_url, price_cents) VALUES ('${bookstoreId}', 'Bad', 'https://store.example/bad', -1)`
			).status
		).not.toBe(0);
	});

	it('enforces foreign keys and the confirmation capability pair and uniqueness', () => {
		expect(
			sql(
				"INSERT INTO courses (teacher_id, code, title) VALUES (gen_random_uuid(), 'BAD', 'Missing teacher')"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, confirmation_token_hash) VALUES ('Student', 'student@example.com', 'BAD-CAPABILITY', 'hash')"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, confirmation_token_hash, confirmation_expires_at) VALUES ('Student', 'student@example.com', 'CAPABILITY-A', 'unique-hash', now() + interval '1 hour')"
			).status
		).toBe(0);
		expect(
			sql(
				"INSERT INTO orders (customer_name, customer_email, public_reference, confirmation_token_hash, confirmation_expires_at) VALUES ('Student', 'student@example.com', 'CAPABILITY-B', 'unique-hash', now() + interval '1 hour')"
			).status
		).not.toBe(0);
	});

	it('enforces attempt states, versions, and provider identifier uniqueness', () => {
		const firstOrder = query(
			"WITH inserted AS (INSERT INTO orders (customer_name, customer_email, public_reference) VALUES ('A', 'a@example.com', 'ATTEMPT-A') RETURNING id) SELECT id FROM inserted"
		);
		const secondOrder = query(
			"WITH inserted AS (INSERT INTO orders (customer_name, customer_email, public_reference) VALUES ('B', 'b@example.com', 'ATTEMPT-B') RETURNING id) SELECT id FROM inserted"
		);
		expect(
			sql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key, status) VALUES ('${firstOrder}', 'bad-status', 'fingerprint', 'bad-status-key', 'unknown')`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key, version) VALUES ('${firstOrder}', 'bad-version', 'fingerprint', 'bad-version-key', 0)`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key, stripe_session_id, payment_intent_id, stripe_expires_at, checkout_ready_at, status) VALUES ('${firstOrder}', 'provider-a', 'fingerprint-a', 'provider-key-a', 'cs_unique', 'pi_unique', now() + interval '1 hour', now(), 'ready')`
			).status
		).toBe(0);
		expect(
			sql(
				`UPDATE checkout_attempts SET stripe_charge_id = 'ch_unique', status = 'completed', terminal_at = now() WHERE order_id = '${firstOrder}'`
			).status
		).toBe(0);
		expect(
			sql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key, stripe_session_id, stripe_expires_at, checkout_ready_at, status) VALUES ('${secondOrder}', 'provider-b', 'fingerprint-b', 'provider-key-b', 'cs_unique', now() + interval '1 hour', now(), 'ready')`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key, stripe_session_id, payment_intent_id, stripe_expires_at, checkout_ready_at, status) VALUES ('${secondOrder}', 'provider-c', 'fingerprint-c', 'provider-key-c', 'cs_other', 'pi_unique', now() + interval '1 hour', now(), 'ready')`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key, stripe_session_id, payment_intent_id, stripe_charge_id, stripe_expires_at, checkout_ready_at, terminal_at, status) VALUES ('${secondOrder}', 'provider-charge', 'fingerprint-charge', 'provider-key-charge', 'cs_charge', 'pi_charge', 'ch_unique', now() + interval '1 hour', now(), now(), 'completed')`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key) VALUES ('${secondOrder}', 'provider-d', 'fingerprint-d', 'provider-key-a')`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key, stripe_session_id) VALUES ('${secondOrder}', 'bad-created-provider', 'bad-created-provider', 'bad-created-provider', 'cs_forbidden')`
			).status
		).not.toBe(0);
	});

	it('accepts bounded unsupported Stripe event types but rejects invalid event metadata', () => {
		expect(
			sql(
				"INSERT INTO stripe_events (id, type, mode, disposition) VALUES ('evt_unknown', 'payment_intent.processing', 'test', 'ignored_unsupported_type')"
			).status
		).toBe(0);
		expect(
			sql(
				"INSERT INTO stripe_events (id, type, mode, disposition) VALUES ('evt_blank', ' ', 'test', 'ignored_unsupported_type')"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO stripe_events (id, type, mode, disposition) VALUES ('evt_mode', 'charge.refunded', 'sandbox', 'applied')"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO stripe_events (id, type, mode, disposition) VALUES ('evt_disposition', 'charge.refunded', 'test', 'invented')"
			).status
		).not.toBe(0);
	});

	it('enforces durable rate bucket scope, count, window, and version', () => {
		expect(
			sql(
				"INSERT INTO rate_limit_buckets (bucket_key, scope, count, window_started_at, expires_at) VALUES ('auth-valid', 'auth_request', 0, now(), now() + interval '1 minute')"
			).status
		).toBe(0);
		expect(
			sql(
				"INSERT INTO rate_limit_buckets (bucket_key, scope, count, window_started_at, expires_at) VALUES ('valid', 'checkout_email', 0, now(), now() + interval '15 minutes')"
			).status
		).toBe(0);
		expect(
			sql(
				"INSERT INTO rate_limit_buckets (bucket_key, scope, count, window_started_at, expires_at) VALUES ('bad-scope', 'raw_ip', 0, now(), now() + interval '15 minutes')"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO rate_limit_buckets (bucket_key, scope, count, window_started_at, expires_at) VALUES ('bad-count', 'checkout_email', -1, now(), now() + interval '15 minutes')"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO rate_limit_buckets (bucket_key, scope, count, window_started_at, expires_at) VALUES ('bad-window', 'checkout_email', 0, now(), now())"
			).status
		).not.toBe(0);
		expect(
			sql(
				"INSERT INTO rate_limit_buckets (bucket_key, scope, count, window_started_at, expires_at, version) VALUES ('bad-version', 'checkout_email', 0, now(), now() + interval '15 minutes', 0)"
			).status
		).not.toBe(0);
	});

	it('removes the raw Better Auth rate-limit table in favor of HMAC-keyed durable buckets', () => {
		expect(query("SELECT to_regclass('public.rate_limit') IS NULL")).toBe('t');
	});

	it('rejects non-positive quantities and inconsistent line amounts', () => {
		query(
			"INSERT INTO orders (customer_name, customer_email, public_reference) VALUES ('Student', 'student@example.com', 'LINE-ORDER') RETURNING id"
		);
		const orderId = query("SELECT id FROM orders WHERE public_reference = 'LINE-ORDER'");
		const bookstoreId = query("SELECT id FROM bookstores WHERE name = 'Valid Store'");
		expect(
			sql(
				`INSERT INTO order_lines (order_id, kind, label, bookstore_id, bookstore_name, quantity, unit_amount_cents, line_amount_cents) VALUES ('${orderId}', 'service_fee', 'Bad quantity', '${bookstoreId}', 'Valid Store', 0, 500, 0)`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO order_lines (order_id, kind, label, bookstore_id, bookstore_name, quantity, unit_amount_cents, line_amount_cents) VALUES ('${orderId}', 'service_fee', 'Bad amount', '${bookstoreId}', 'Valid Store', 1, 500, 499)`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO order_lines (order_id, kind, label, bookstore_id, bookstore_name, quantity, unit_amount_cents, line_amount_cents) VALUES ('${orderId}', 'book', 'Missing snapshot', '${bookstoreId}', 'Valid Store', 1, 100, 100)`
			).status
		).not.toBe(0);
	});

	it('makes order lines immutable and audit rows append-only', () => {
		const orderId = query("SELECT id FROM orders WHERE public_reference = 'LINE-ORDER'");
		const bookstoreId = query("SELECT id FROM bookstores WHERE name = 'Valid Store'");
		const lineId = query(
			`WITH inserted AS (INSERT INTO order_lines (order_id, kind, label, bookstore_id, bookstore_name, quantity, unit_amount_cents, line_amount_cents) VALUES ('${orderId}', 'service_fee', 'Snapshot', '${bookstoreId}', 'Valid Store', 1, 500, 500) RETURNING id) SELECT id FROM inserted`
		);
		expect(sql(`UPDATE order_lines SET label = 'Changed' WHERE id = '${lineId}'`).status).not.toBe(
			0
		);
		expect(sql(`DELETE FROM order_lines WHERE id = '${lineId}'`).status).not.toBe(0);
		const auditId = query(
			`WITH inserted AS (INSERT INTO audit_log (order_id, resource_type, resource_id, actor_kind, action) VALUES ('${orderId}', 'order', '${orderId}', 'system', 'order_created') RETURNING id) SELECT id FROM inserted`
		);
		expect(sql(`UPDATE audit_log SET action = 'changed' WHERE id = '${auditId}'`).status).not.toBe(
			0
		);
		expect(sql(`DELETE FROM audit_log WHERE id = '${auditId}'`).status).not.toBe(0);
	});

	it('supports constrained order and catalogue audit targets without fake orders', () => {
		const orderId = query("SELECT id FROM orders WHERE public_reference = 'LINE-ORDER'");
		const teacherId = query(
			"WITH inserted AS (INSERT INTO teachers (slug, name) VALUES ('audit-teacher', 'Audit Teacher') RETURNING id) SELECT id FROM inserted"
		);
		expect(
			sql(
				`INSERT INTO audit_log (order_id, resource_type, resource_id, actor_kind, action) VALUES ('${orderId}', 'order', '${orderId}', 'system', 'order_created')`
			).status
		).toBe(0);
		expect(
			sql(
				`INSERT INTO audit_log (resource_type, resource_id, actor_kind, action) VALUES ('teacher', '${teacherId}', 'system', 'teacher_created')`
			).status
		).toBe(0);
		expect(
			sql(
				`INSERT INTO audit_log (order_id, resource_type, resource_id, actor_kind, action) VALUES ('${orderId}', 'order', '${teacherId}', 'system', 'mismatched_order')`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO audit_log (order_id, resource_type, resource_id, actor_kind, action) VALUES ('${orderId}', 'teacher', '${teacherId}', 'system', 'fake_order_target')`
			).status
		).not.toBe(0);
		expect(
			sql(
				`INSERT INTO audit_log (resource_type, resource_id, actor_kind, action) VALUES ('unknown', '${teacherId}', 'system', 'unknown_target')`
			).status
		).not.toBe(0);
	});

	it('rolls back webhook event, payment state, attempt state, and audit as one unit', () => {
		const orderId = query(
			"WITH inserted AS (INSERT INTO orders (customer_name, customer_email, public_reference, subtotal_cents, total_cents) VALUES ('Rollback', 'rollback@example.com', 'WEBHOOK-ROLLBACK', 2500, 2500) RETURNING id) SELECT id FROM inserted"
		);
		const attemptId = query(
			`WITH inserted AS (INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key, stripe_session_id, stripe_expires_at, checkout_ready_at, status) VALUES ('${orderId}', 'webhook-rollback', 'webhook-rollback-fingerprint', 'webhook-rollback-key', 'cs_test_webhook_rollback', now() + interval '1 hour', now(), 'ready') RETURNING id) SELECT id FROM inserted`
		);
		const result = sql(`BEGIN;
			INSERT INTO stripe_events (id, type, mode, disposition) VALUES ('evt_webhook_rollback', 'checkout.session.completed', 'test', 'rejected');
			UPDATE checkout_attempts SET payment_intent_id = 'pi_webhook_rollback', stripe_charge_id = 'ch_webhook_rollback', status = 'completed', terminal_at = now(), version = version + 1 WHERE id = '${attemptId}' AND version = 1;
			UPDATE orders SET payment_status = 'paid', version = version + 1 WHERE id = '${orderId}' AND version = 1;
			INSERT INTO audit_log (order_id, resource_type, resource_id, actor_kind, action, provider_event_id) VALUES ('${orderId}', 'order', '${orderId}', 'stripe', 'stripe_completed_applied', 'evt_webhook_rollback');
			UPDATE stripe_events SET disposition = 'applied', processed_at = now() WHERE id = 'evt_webhook_rollback';
			SELECT 1 / 0;
			COMMIT;`);
		expect(result.status).not.toBe(0);
		expect(query("SELECT count(*) FROM stripe_events WHERE id = 'evt_webhook_rollback'")).toBe('0');
		expect(
			query("SELECT count(*) FROM audit_log WHERE provider_event_id = 'evt_webhook_rollback'")
		).toBe('0');
		expect(
			query(`SELECT payment_status || ':' || version FROM orders WHERE id = '${orderId}'`)
		).toBe('pending:1');
		expect(
			query(`SELECT status || ':' || version FROM checkout_attempts WHERE id = '${attemptId}'`)
		).toBe('ready:1');
	});

	it('serializes duplicate webhook reducers so only one transaction applies effects', async () => {
		const orderId = query(
			"WITH inserted AS (INSERT INTO orders (customer_name, customer_email, public_reference, subtotal_cents, total_cents) VALUES ('Race', 'race-webhook@example.com', 'WEBHOOK-RACE', 2500, 2500) RETURNING id) SELECT id FROM inserted"
		);
		const attemptId = query(
			`WITH inserted AS (INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key, stripe_session_id, stripe_expires_at, checkout_ready_at, status) VALUES ('${orderId}', 'webhook-race', 'webhook-race-fingerprint', 'webhook-race-key', 'cs_test_webhook_race', now() + interval '1 hour', now(), 'ready') RETURNING id) SELECT id FROM inserted`
		);
		const reducer = `BEGIN;
			INSERT INTO stripe_events (id, type, mode, disposition) VALUES ('evt_webhook_race', 'checkout.session.completed', 'test', 'rejected') ON CONFLICT (id) DO NOTHING;
			SELECT pg_sleep(0.5) FROM stripe_events WHERE id = 'evt_webhook_race' AND processed_at IS NULL;
			UPDATE checkout_attempts SET payment_intent_id = 'pi_webhook_race', stripe_charge_id = 'ch_webhook_race', status = 'completed', terminal_at = now(), version = version + 1 WHERE id = '${attemptId}' AND status = 'ready' AND version = 1 AND EXISTS (SELECT 1 FROM stripe_events WHERE id = 'evt_webhook_race' AND processed_at IS NULL);
			UPDATE orders SET payment_status = 'paid', version = version + 1 WHERE id = '${orderId}' AND payment_status = 'pending' AND version = 1 AND EXISTS (SELECT 1 FROM stripe_events WHERE id = 'evt_webhook_race' AND processed_at IS NULL);
			INSERT INTO audit_log (order_id, resource_type, resource_id, actor_kind, action, provider_event_id) SELECT '${orderId}', 'order', '${orderId}', 'stripe', 'stripe_completed_applied', id FROM stripe_events WHERE id = 'evt_webhook_race' AND processed_at IS NULL;
			UPDATE stripe_events SET disposition = 'applied', processed_at = now() WHERE id = 'evt_webhook_race' AND processed_at IS NULL;
			COMMIT;`;
		const race = await Promise.all([concurrentSql(reducer), concurrentSql(reducer)]);
		expect(race.sort()).toEqual([0, 0]);
		expect(
			query(`SELECT payment_status || ':' || version FROM orders WHERE id = '${orderId}'`)
		).toBe('paid:2');
		expect(
			query(`SELECT status || ':' || version FROM checkout_attempts WHERE id = '${attemptId}'`)
		).toBe('completed:2');
		expect(query("SELECT count(*) FROM stripe_events WHERE id = 'evt_webhook_race'")).toBe('1');
		expect(
			query("SELECT count(*) FROM audit_log WHERE provider_event_id = 'evt_webhook_race'")
		).toBe('1');
	}, 10000);

	it('serializes concurrent races on unique public references and request IDs', async () => {
		const orderRace = await Promise.all([
			concurrentSql(
				"BEGIN; INSERT INTO orders (customer_name, customer_email, public_reference) VALUES ('A', 'a@example.com', 'RACE-ORDER'); SELECT pg_sleep(0.5); COMMIT;"
			),
			concurrentSql(
				"INSERT INTO orders (customer_name, customer_email, public_reference) VALUES ('B', 'b@example.com', 'RACE-ORDER');"
			)
		]);
		expect(orderRace.sort()).toEqual([0, 1]);

		const firstOrder = query(
			"WITH inserted AS (INSERT INTO orders (customer_name, customer_email, public_reference) VALUES ('A', 'a@example.com', 'RACE-A') RETURNING id) SELECT id FROM inserted"
		);
		const secondOrder = query(
			"WITH inserted AS (INSERT INTO orders (customer_name, customer_email, public_reference) VALUES ('B', 'b@example.com', 'RACE-B') RETURNING id) SELECT id FROM inserted"
		);
		const requestRace = await Promise.all([
			concurrentSql(
				`BEGIN; INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key) VALUES ('${firstOrder}', 'request-race', 'fingerprint-a', 'idem-a'); SELECT pg_sleep(0.5); COMMIT;`
			),
			concurrentSql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key) VALUES ('${secondOrder}', 'request-race', 'fingerprint-b', 'idem-b');`
			)
		]);
		expect(requestRace.sort()).toEqual([0, 1]);

		const thirdOrder = query(
			"WITH inserted AS (INSERT INTO orders (customer_name, customer_email, public_reference) VALUES ('C', 'c@example.com', 'RACE-C') RETURNING id) SELECT id FROM inserted"
		);
		const fourthOrder = query(
			"WITH inserted AS (INSERT INTO orders (customer_name, customer_email, public_reference) VALUES ('D', 'd@example.com', 'RACE-D') RETURNING id) SELECT id FROM inserted"
		);
		const fingerprintRace = await Promise.all([
			concurrentSql(
				`BEGIN; INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key) VALUES ('${thirdOrder}', 'fingerprint-request-a', 'same-active-fingerprint', 'fingerprint-idem-a'); SELECT pg_sleep(0.5); COMMIT;`
			),
			concurrentSql(
				`INSERT INTO checkout_attempts (order_id, client_request_id, request_fingerprint, stripe_idempotency_key) VALUES ('${fourthOrder}', 'fingerprint-request-b', 'same-active-fingerprint', 'fingerprint-idem-b');`
			)
		]);
		expect(fingerprintRace.sort()).toEqual([0, 1]);
		expect(
			query(
				"SELECT count(*) FROM checkout_attempts WHERE request_fingerprint = 'same-active-fingerprint' AND status IN ('created', 'ready')"
			)
		).toBe('1');
	}, 10000);

	it('keeps pickup rows append-only and prevents concurrent overselling', async () => {
		const staffId = query(
			"WITH inserted AS (INSERT INTO \"user\" (id, name, email, email_verified, created_at, updated_at) VALUES (gen_random_uuid()::text, 'Staff', 'pickup-staff@example.com', true, now(), now()) RETURNING id) SELECT id FROM inserted"
		);
		const requestId = query(
			"WITH inserted AS (INSERT INTO book_requests (public_reference, client_request_id, student_name, student_email, teacher_name, course_name) VALUES ('REQ-ABCDEFGHJKM2', 'pickup-request', 'Student', 'student@example.com', 'Teacher', 'Course') RETURNING id) SELECT id FROM inserted"
		);
		const itemId = query(
			`WITH inserted AS (INSERT INTO book_request_items (request_id, position, title, quantity) VALUES ('${requestId}', 0, 'Concurrency', 3) RETURNING id) SELECT id FROM inserted`
		);
		/** @param {string} clientRequestId @param {number} quantity @param {boolean} [delay] */
		const insert = (clientRequestId, quantity, delay = false) =>
			`${delay ? 'BEGIN; ' : ''}INSERT INTO book_pickups (need_kind, request_id, request_item_id, quantity, client_request_id, staff_user_id, staff_identity) VALUES ('request_item', '${requestId}', '${itemId}', ${quantity}, '${clientRequestId}', '${staffId}', 'pickup-staff@example.com');${delay ? ' SELECT pg_sleep(0.5); COMMIT;' : ''}`;

		const race = await Promise.all([
			concurrentSql(insert('pickup-race-a', 2, true)),
			concurrentSql(insert('pickup-race-b', 2))
		]);
		expect(race.sort()).toEqual([0, 1]);
		expect(
			query(`SELECT sum(quantity) FROM book_pickups WHERE request_item_id = '${itemId}'`)
		).toBe('2');
		expect(sql('UPDATE book_pickups SET quantity = quantity').status).not.toBe(0);
		expect(sql('DELETE FROM book_pickups').status).not.toBe(0);
	}, 10000);
});
