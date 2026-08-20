import { defineConfig } from 'drizzle-kit';

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL;

if (!migrationDatabaseUrl) {
	throw new Error('MIGRATION_DATABASE_URL is required for controlled migration commands');
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: migrationDatabaseUrl
	},
	strict: true,
	verbose: true
});
