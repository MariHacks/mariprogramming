import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification
} from './auth-schema.generated';

/** @param {import('drizzle-orm/pg-core').PgTable} table */
function columnContract(table) {
	return Object.fromEntries(
		getTableConfig(table).columns.map((column) => [
			column.name,
			{
				notNull: column.notNull,
				primary: column.primary,
				unique: column.isUnique,
				dataType: column.dataType,
				columnType: column.columnType
			}
		])
	);
}

/** @param {import('drizzle-orm/pg-core').PgTable} table */
function indexContract(table) {
	const config = getTableConfig(table);
	return {
		indexes: config.indexes.map((index) => ({
			name: index.config.name,
			unique: index.config.unique,
			columns: index.config.columns.map((column) => /** @type {{ name: string }} */ (column).name)
		})),
		uniqueConstraints: config.uniqueConstraints.map((constraint) => ({
			name: constraint.name,
			columns: constraint.columns.map((column) => column.name)
		}))
	};
}

describe('generated Better Auth PostgreSQL schema contract', () => {
	it('exports only the four Better Auth persistence tables used by the runtime', () => {
		expect(
			[user, session, account, verification].map((table) => getTableConfig(table).name)
		).toEqual(['user', 'session', 'account', 'verification']);
	});

	it('defines the core user fields and unique normalized identity column', () => {
		expect(columnContract(user)).toEqual({
			id: {
				notNull: true,
				primary: true,
				unique: false,
				dataType: 'string',
				columnType: 'PgText'
			},
			name: {
				notNull: true,
				primary: false,
				unique: false,
				dataType: 'string',
				columnType: 'PgText'
			},
			email: {
				notNull: true,
				primary: false,
				unique: true,
				dataType: 'string',
				columnType: 'PgText'
			},
			email_verified: {
				notNull: true,
				primary: false,
				unique: false,
				dataType: 'boolean',
				columnType: 'PgBoolean'
			},
			image: {
				notNull: false,
				primary: false,
				unique: false,
				dataType: 'string',
				columnType: 'PgText'
			},
			created_at: {
				notNull: true,
				primary: false,
				unique: false,
				dataType: 'date',
				columnType: 'PgTimestamp'
			},
			updated_at: {
				notNull: true,
				primary: false,
				unique: false,
				dataType: 'date',
				columnType: 'PgTimestamp'
			}
		});
	});

	it('defines database sessions with a unique token, expiry, and user lookup index', () => {
		expect(Object.keys(columnContract(session))).toEqual([
			'id',
			'expires_at',
			'token',
			'created_at',
			'updated_at',
			'ip_address',
			'user_agent',
			'user_id'
		]);
		expect(columnContract(session)).toMatchObject({
			expires_at: { notNull: true, dataType: 'date' },
			token: { notNull: true, unique: true, dataType: 'string' },
			ip_address: { notNull: false },
			user_agent: { notNull: false },
			user_id: { notNull: true, dataType: 'string' }
		});
		expect(indexContract(session)).toEqual({
			indexes: [{ name: 'session_userId_idx', unique: false, columns: ['user_id'] }],
			uniqueConstraints: []
		});
	});

	it('defines encrypted-token account storage and its user lookup index', () => {
		expect(Object.keys(columnContract(account))).toEqual([
			'id',
			'account_id',
			'provider_id',
			'user_id',
			'access_token',
			'refresh_token',
			'id_token',
			'access_token_expires_at',
			'refresh_token_expires_at',
			'scope',
			'password',
			'created_at',
			'updated_at'
		]);
		expect(columnContract(account)).toMatchObject({
			account_id: { notNull: true },
			provider_id: { notNull: true },
			user_id: { notNull: true },
			access_token: { notNull: false },
			refresh_token: { notNull: false },
			id_token: { notNull: false },
			password: { notNull: false }
		});
		expect(indexContract(account)).toEqual({
			indexes: [{ name: 'account_userId_idx', unique: false, columns: ['user_id'] }],
			uniqueConstraints: []
		});
	});

	it('defines verification cleanup fields and its identifier lookup index', () => {
		expect(Object.keys(columnContract(verification))).toEqual([
			'id',
			'identifier',
			'value',
			'expires_at',
			'created_at',
			'updated_at'
		]);
		expect(indexContract(verification)).toEqual({
			indexes: [
				{
					name: 'verification_identifier_idx',
					unique: false,
					columns: ['identifier']
				}
			],
			uniqueConstraints: []
		});
	});

	it('exports generated user-session-account relations for adapter consumption', () => {
		expect(userRelations).toBeDefined();
		expect(sessionRelations).toBeDefined();
		expect(accountRelations).toBeDefined();
	});
});
