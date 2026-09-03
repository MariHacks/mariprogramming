import { building } from '$app/environment';
import pg from 'pg';
import migrationSql0008 from '../../../../drizzle/0008_maritools_persistence.sql?raw';
import migrationSql0009 from '../../../../drizzle/0009_google_calendar_grants.sql?raw';
import migrationSql0010 from '../../../../drizzle/0010_free_time_boards.sql?raw';
import migrationSql0011 from '../../../../drizzle/0011_moderation_mutes_bans.sql?raw';
import migrationSql0012 from '../../../../drizzle/0012_moderation_ban_until.sql?raw';
import migrationSql0013 from '../../../../drizzle/0013_saved_schedules.sql?raw';
import migrationSql0014 from '../../../../drizzle/0014_outline_reviews.sql?raw';
import migrationSql0015 from '../../../../drizzle/0015_programming_club_memberships.sql?raw';
import migrationSql0016 from '../../../../drizzle/0016_required_club_form.sql?raw';
import migrationSql0017 from '../../../../drizzle/0017_member_onboarding_profile.sql?raw';
import migrationSql0019 from '../../../../drizzle/0019_case_preserved_usernames.sql?raw';
import { readRuntimeEnvironment } from '../config/environment.js';
import { createMariToolsRepository } from './repository.js';

/** @type {Promise<void> | null} */
let bootstrapPromise = null;

const RUNTIME_GRANT_TABLES = [
	'mt_academic_terms',
	'mt_academic_calendar_rules',
	'mt_courses',
	'mt_course_offerings',
	'mt_student_profiles',
	'mt_outline_documents',
	'mt_outline_extractions',
	'mt_catalog_contributions',
	'mt_clubs',
	'mt_club_submissions',
	'mt_forum_threads',
	'mt_forum_replies',
	'mt_forum_reports',
	'mt_google_calendar_grants',
	'mt_free_time_boards',
	'mt_free_time_members',
	'mt_saved_schedules',
	'mt_programming_club_memberships'
];

/** @param {string} sql */
function splitMigrationStatements(sql) {
	return String(sql)
		.split(/-->\s*statement-breakpoint/gu)
		.map((part) => part.trim())
		.filter(Boolean);
}

/** @param {string[]} tables */
function grantRuntimeTablesSql(tables) {
	return `
		GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
		  ${tables.join(',\n\t\t  ')}
		TO mariprogramming_runtime
	`;
}

/**
 * @typedef {{
 *   sentinel: string,
 *   column?: string,
 *   sql: string,
 *   grantTables: string[]
 * }} IncrementalMigration
 */

/** @type {IncrementalMigration[]} */
const INCREMENTAL_MIGRATIONS = [
	{
		sentinel: 'mt_academic_terms',
		sql: migrationSql0008,
		grantTables: RUNTIME_GRANT_TABLES
	},
	{
		sentinel: 'mt_google_calendar_grants',
		sql: migrationSql0009,
		grantTables: ['mt_google_calendar_grants']
	},
	{
		sentinel: 'mt_free_time_boards',
		sql: migrationSql0010,
		grantTables: ['mt_free_time_boards', 'mt_free_time_members']
	},
	{
		sentinel: 'mt_student_profiles',
		column: 'muted_until',
		sql: migrationSql0011,
		grantTables: []
	},
	{
		sentinel: 'mt_student_profiles',
		column: 'banned_until',
		sql: migrationSql0012,
		grantTables: []
	},
	{
		sentinel: 'mt_saved_schedules',
		sql: migrationSql0013,
		grantTables: ['mt_saved_schedules']
	},
	{
		sentinel: 'mt_outline_documents',
		column: 'review_proposals',
		sql: migrationSql0014,
		grantTables: []
	},
	{
		sentinel: 'mt_programming_club_memberships',
		sql: migrationSql0015,
		grantTables: ['mt_programming_club_memberships']
	},
	{
		sentinel: 'mt_programming_club_memberships',
		column: 'required_form_completed_at',
		sql: migrationSql0016,
		grantTables: []
	},
	{
		sentinel: 'mt_programming_club_memberships',
		column: 'year_level',
		sql: migrationSql0017,
		grantTables: []
	},
	{
		sentinel: 'mt_student_profiles_username_lower_unique_idx',
		sql: migrationSql0019,
		grantTables: []
	}
];

/**
 * Apply missing MariTools DDL when sentinel tables are absent.
 * Must use a migrator/owner connection (`MIGRATION_DATABASE_URL`), not the
 * least-privilege runtime role.
 *
 * @param {string} databaseUrl
 * @param {{
 *   createPool?: (databaseUrl: string) => InstanceType<typeof pg.Pool>
 * }} [dependencies]
 */
export function createDefaultMariToolsPool(databaseUrl) {
	return new pg.Pool({ connectionString: databaseUrl, max: 1 });
}

/**
 * @param {pg.PoolClient} client
 * @param {IncrementalMigration} migration
 */
async function migrationAlreadyApplied(client, migration) {
	if (migration.column) {
		const existing = await client.query(
			`SELECT 1 AS ok
			 FROM information_schema.columns
			 WHERE table_schema = 'public'
			   AND table_name = $1
			   AND column_name = $2
			 LIMIT 1`,
			[migration.sentinel, migration.column]
		);
		return Boolean(existing.rows[0]);
	}
	const existing = await client.query(
		`SELECT to_regclass('public.${migration.sentinel}')::text AS table_name`
	);
	return Boolean(existing.rows[0] && existing.rows[0].table_name);
}

export async function ensureMariToolsSchema(databaseUrl, dependencies = {}) {
	const createPool = dependencies.createPool ?? createDefaultMariToolsPool;
	const pool = createPool(databaseUrl);
	/** @type {pg.PoolClient | undefined} */
	let client;
	try {
		client = await pool.connect();
		for (const migration of INCREMENTAL_MIGRATIONS) {
			if (await migrationAlreadyApplied(client, migration)) continue;

			const statements = splitMigrationStatements(migration.sql);
			if (statements.length === 0) {
				throw new Error(`MariTools migration for ${migration.sentinel} is empty`);
			}
			await client.query('BEGIN');
			try {
				for (const statement of statements) {
					await client.query(statement);
				}
				if (migration.grantTables.length > 0) {
					await client.query(grantRuntimeTablesSql(migration.grantTables));
				}
				await client.query('COMMIT');
			} catch (error) {
				try {
					await client.query('ROLLBACK');
				} catch {
					/* ignore */
				}
				throw error;
			}
		}
	} finally {
		if (client) {
			try {
				client.release();
			} catch {
				/* ignore */
			}
		}
		try {
			await pool.end();
		} catch {
			/* ignore */
		}
	}
}

/** Seeds committed academic terms into Postgres once per process. */
export async function ensureMariToolsBootstrap() {
	if (building) return;
	if (bootstrapPromise) return bootstrapPromise;
	bootstrapPromise = (async () => {
		try {
			const { databaseUrl } = readRuntimeEnvironment();
			if (!databaseUrl) return;
			const repository = createMariToolsRepository({ databaseUrl });
			await repository.seedCommittedTerms();
		} catch (error) {
			bootstrapPromise = null;
			console.error('[maritools-bootstrap]', error);
		}
	})();
	return bootstrapPromise;
}
