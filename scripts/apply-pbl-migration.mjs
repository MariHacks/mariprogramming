#!/usr/bin/env node
/**
 * Apply drizzle/0020_pbl_rooms.sql and drizzle/0021_pbl_room_driver.sql when missing.
 * Requires MIGRATION_DATABASE_URL or DATABASE_URL. Does not print connection details.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error('MIGRATION_DATABASE_URL or DATABASE_URL is required');
	process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {import('pg').PoolClient} client
 * @param {string} relative
 */
async function applyFile(client, relative) {
	const sql = readFileSync(join(root, relative), 'utf8');
	const statements = sql
		.split(/-->\s*statement-breakpoint/gu)
		.map((part) => part.trim())
		.filter(Boolean);
	for (const statement of statements) {
		await client.query(statement);
	}
	return statements.length;
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
	const rooms = await client.query("SELECT to_regclass('public.pbl_rooms')::text AS table_name");
	if (!rooms.rows[0]?.table_name) {
		await client.query('BEGIN');
		try {
			const count = await applyFile(client, 'drizzle/0020_pbl_rooms.sql');
			await applyFile(client, 'drizzle/0021_pbl_room_driver.sql');
			try {
				await client.query(
					'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pbl_rooms, pbl_room_members TO mariprogramming_runtime'
				);
			} catch (error) {
				if (
					!String(error instanceof Error ? error.message : error).includes(
						'mariprogramming_runtime'
					)
				) {
					throw error;
				}
			}
			await client.query('COMMIT');
			console.log(`ok: applied 0020 (${count} statements) and 0021`);
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		}
	} else {
		const column = await client.query(
			`SELECT column_name FROM information_schema.columns
			 WHERE table_schema = 'public' AND table_name = 'pbl_rooms' AND column_name = 'driver_member_id'`
		);
		if (column.rows[0]?.column_name) {
			console.log('ok: pbl_rooms and driver_member_id already present');
		} else {
			await client.query('BEGIN');
			try {
				await applyFile(client, 'drizzle/0021_pbl_room_driver.sql');
				await client.query('COMMIT');
				console.log('ok: applied 0021 driver_member_id');
			} catch (error) {
				await client.query('ROLLBACK');
				throw error;
			}
		}
	}
} catch (error) {
	console.error('migration failed:', error instanceof Error ? error.message : 'unknown');
	process.exit(1);
} finally {
	client.release();
	await pool.end();
}
