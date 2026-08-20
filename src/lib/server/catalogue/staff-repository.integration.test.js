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
import { createCatalogueRepository } from './repository.js';
import {
	StaffCatalogueConflictError,
	StaffCatalogueUnavailableError,
	createStaffCatalogueRepository
} from './staff-repository.js';

const POSTGRES_BIN = '/Applications/Postgres.app/Contents/Versions/latest/bin';
const MIGRATIONS_DIRECTORY = resolve('drizzle');
const APPROVED_HOSTS = ['shop.example.com', 'images.example.com'];
const USER_ID = 'staff-user-id';
const ACTOR_EMAIL = 'team@marihacks.com';

let clusterRoot;
let dataDirectory;
let socketDirectory;
let port;
let databaseUrl;

/** @param {string} name */
function binary(name) {
	return join(POSTGRES_BIN, name);
}

/** @param {string} command @param {string[]} args */
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
	return createStaffCatalogueRepository({
		databaseUrl,
		approvedHostnames: APPROVED_HOSTS,
		runTransaction
	});
}

let requestSequence = 1;
function actor() {
	const suffix = String(requestSequence++).padStart(12, '0');
	return {
		userId: USER_ID,
		email: ACTOR_EMAIL,
		requestId: `60000000-0000-4000-8000-${suffix}`
	};
}

describe.sequential('staff catalogue against disposable PostgreSQL', () => {
	beforeAll(async () => {
		clusterRoot = await mkdtemp(join(tmpdir(), 'mpc-staff-catalogue-'));
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
			VALUES ('${USER_ID}', 'Programming Club Staff', '${ACTOR_EMAIL}', true, now(), now())
		`);
	}, 30000);

	afterAll(async () => {
		if (dataDirectory) {
			run(binary('pg_ctl'), ['--pgdata', dataDirectory, '--mode', 'immediate', '--wait', 'stop']);
		}
		if (clusterRoot) await rm(clusterRoot, { recursive: true, force: true });
	});

	it('creates every resource, reads all records, and exposes the live public course', async () => {
		const staffRepository = repository();
		const teacher = await staffRepository.createStaffCatalogueRecord(
			'teachers',
			{ slug: 'ada-lovelace', name: 'Ada Lovelace' },
			actor()
		);
		const course = await staffRepository.createStaffCatalogueRecord(
			'courses',
			{ teacherId: teacher.id, code: 'CSC 205', title: 'Data Structures' },
			actor()
		);
		const bookstore = await staffRepository.createStaffCatalogueRecord(
			'bookstores',
			{ name: 'Campus Books', serviceFee: '5.00' },
			actor()
		);
		const book = await staffRepository.createStaffCatalogueRecord(
			'books',
			{
				bookstoreId: bookstore.id,
				title: 'The C Programming Language',
				author: 'Brian Kernighan and Dennis Ritchie',
				isbn: '978-0-13-110362-7',
				retailerUrl: 'https://shop.example.com/books/c-programming',
				coverUrl: 'https://images.example.com/covers/c-programming.webp',
				price: '42.99'
			},
			actor()
		);
		const assignment = await staffRepository.createStaffCatalogueRecord(
			'assignments',
			{ courseId: course.id, bookId: book.id, position: '0' },
			actor()
		);

		await expect(staffRepository.listStaffCatalogue('teachers', 'ada')).resolves.toMatchObject({
			totalCount: 1,
			records: [{ id: teacher.id, effectiveActive: true }]
		});
		await expect(staffRepository.listStaffCatalogue('courses', '')).resolves.toMatchObject({
			records: [{ id: course.id, teacherName: 'Ada Lovelace', effectiveActive: true }]
		});
		await expect(staffRepository.listStaffCatalogue('bookstores', '')).resolves.toMatchObject({
			records: [{ id: bookstore.id, serviceFeeCents: 500 }]
		});
		await expect(staffRepository.listStaffCatalogue('books', '')).resolves.toMatchObject({
			records: [{ id: book.id, isbn: '9780131103627', priceCents: 4299 }]
		});
		await expect(staffRepository.listStaffCatalogue('assignments', '')).resolves.toMatchObject({
			records: [{ id: assignment.id, position: 0, effectiveActive: true }]
		});

		const publicRepository = createCatalogueRepository({
			databaseUrl,
			approvedHostnames: APPROVED_HOSTS,
			taxRateBps: 1498,
			runTransaction
		});
		await expect(publicRepository.listActiveCourseSummaries()).resolves.toMatchObject([
			{
				id: course.id,
				teacher: { slug: 'ada-lovelace', name: 'Ada Lovelace' },
				books: [{ id: book.id, priceCents: 4299 }]
			}
		]);
		expect(query("SELECT count(*) FROM audit_log WHERE actor_kind = 'staff'")).toBe('5');
	});

	it('deactivates without cascading and reports direct versus effective visibility', async () => {
		const staffRepository = repository();
		const teacher = (await staffRepository.listStaffCatalogue('teachers', '')).records[0];
		await staffRepository.setStaffCatalogueRecordActive(
			'teachers',
			teacher.id,
			teacher.version,
			false,
			actor()
		);
		await expect(staffRepository.listStaffCatalogue('courses', '')).resolves.toMatchObject({
			records: [{ active: true, effectiveActive: false, blockedBy: ['teacher'] }]
		});
		await expect(staffRepository.listStaffCatalogue('assignments', '')).resolves.toMatchObject({
			records: [
				{ active: true, effectiveActive: false, blockedBy: expect.arrayContaining(['teacher']) }
			]
		});
		const publicRepository = createCatalogueRepository({
			databaseUrl,
			approvedHostnames: APPROVED_HOSTS,
			taxRateBps: 1498,
			runTransaction
		});
		await expect(publicRepository.listActiveCourseSummaries()).resolves.toEqual([]);
		expect(query('SELECT active::text FROM courses LIMIT 1')).toBe('true');
		expect(query('SELECT active::text FROM course_books LIMIT 1')).toBe('true');
	});

	it('allows one of two concurrent versioned writers and audits only the winner', async () => {
		const staffRepository = repository();
		const teacher = (await staffRepository.listStaffCatalogue('teachers', '')).records[0];
		const before = Number(
			query("SELECT count(*) FROM audit_log WHERE action = 'catalogue.teacher.updated'")
		);
		const settled = await Promise.allSettled([
			staffRepository.updateStaffCatalogueRecord(
				'teachers',
				teacher.id,
				teacher.version,
				{ slug: 'ada-lovelace', name: 'Ada Byron' },
				actor()
			),
			staffRepository.updateStaffCatalogueRecord(
				'teachers',
				teacher.id,
				teacher.version,
				{ slug: 'ada-lovelace', name: 'Ada King' },
				actor()
			)
		]);
		expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		const rejected = settled.find(({ status }) => status === 'rejected');
		expect(rejected.reason).toBeInstanceOf(StaffCatalogueConflictError);
		expect(
			Number(query("SELECT count(*) FROM audit_log WHERE action = 'catalogue.teacher.updated'"))
		).toBe(before + 1);
		expect(query(`SELECT version::text FROM teachers WHERE id = '${teacher.id}'`)).toBe(
			String(teacher.version + 1)
		);
	});

	it('rolls the catalogue update back when its audit insert fails', async () => {
		const staffRepository = repository();
		const teacher = (await staffRepository.listStaffCatalogue('teachers', '')).records[0];
		const original = query(
			`SELECT name || ':' || version::text FROM teachers WHERE id = '${teacher.id}'`
		);
		query(`
			CREATE FUNCTION reject_catalogue_audit() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				IF NEW.action = 'catalogue.teacher.updated' THEN RAISE EXCEPTION 'forced audit failure'; END IF;
				RETURN NEW;
			END $$;
			CREATE TRIGGER reject_catalogue_audit BEFORE INSERT ON audit_log
			FOR EACH ROW EXECUTE FUNCTION reject_catalogue_audit();
		`);
		await expect(
			staffRepository.updateStaffCatalogueRecord(
				'teachers',
				teacher.id,
				teacher.version,
				{ slug: 'ada-lovelace', name: 'This Must Roll Back' },
				actor()
			)
		).rejects.toBeInstanceOf(StaffCatalogueUnavailableError);
		expect(
			query(`SELECT name || ':' || version::text FROM teachers WHERE id = '${teacher.id}'`)
		).toBe(original);
		query(
			'DROP TRIGGER reject_catalogue_audit ON audit_log; DROP FUNCTION reject_catalogue_audit();'
		);
	});
});
