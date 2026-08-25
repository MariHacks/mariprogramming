#!/usr/bin/env node
/**
 * Apply drizzle/0008_maritools_persistence.sql when mt_academic_terms is missing.
 * Requires DATABASE_URL. Does not print connection details.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error('DATABASE_URL is required');
	process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = join(root, 'drizzle', '0008_maritools_persistence.sql');
const migrationSql = readFileSync(sqlPath, 'utf8');

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
	const existing = await client.query(
		"SELECT to_regclass('public.mt_academic_terms')::text AS table_name"
	);
	if (existing.rows[0]?.table_name) {
		console.log('ok: mt_academic_terms already present');
		process.exit(0);
	}

	const statements = migrationSql
		.split(/-->\s*statement-breakpoint/gu)
		.map((part) => part.trim())
		.filter(Boolean);
	if (statements.length === 0) {
		console.error('migration SQL is empty');
		process.exit(1);
	}

	await client.query('BEGIN');
	try {
		for (const statement of statements) {
			await client.query(statement);
		}
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	}

	const after = await client.query(
		"SELECT to_regclass('public.mt_academic_terms')::text AS table_name"
	);
	if (!after.rows[0]?.table_name) {
		console.error('migration finished but mt_academic_terms is still missing');
		process.exit(1);
	}
	console.log(`ok: applied ${statements.length} statements`);
} catch (error) {
	console.error('migration failed:', error instanceof Error ? error.name : 'unknown');
	process.exit(1);
} finally {
	client.release();
	await pool.end();
}
