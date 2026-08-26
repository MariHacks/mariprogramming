import { eq } from 'drizzle-orm';
import { readRuntimeEnvironment } from '../config/environment.js';
import { mtGoogleCalendarGrants } from '../db/schema';
import { withDatabaseTransaction } from '../db/transaction.js';
import { MariToolsUnavailableError } from './repository.js';

export { MariToolsUnavailableError };

/**
 * @param {string} databaseUrl
 * @param {(operation: (transaction: any) => Promise<any>) => Promise<any>} [runTransaction]
 */
export function createGoogleCalendarStore(databaseUrl, runTransaction = withDatabaseTransaction) {
	if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
		throw new MariToolsUnavailableError();
	}

	/** @param {(transaction: any) => Promise<any>} operation */
	const transact = (operation) => runTransaction(operation, { databaseUrl });

	return Object.freeze({
		/** @param {string} userId */
		async hasGrant(userId) {
			const rows = await transact((transaction) =>
				transaction
					.select({ userId: mtGoogleCalendarGrants.userId })
					.from(mtGoogleCalendarGrants)
					.where(eq(mtGoogleCalendarGrants.userId, userId))
					.limit(1)
			);
			return rows.length > 0;
		},

		/** @param {string} userId */
		async getGrant(userId) {
			const rows = await transact((transaction) =>
				transaction
					.select()
					.from(mtGoogleCalendarGrants)
					.where(eq(mtGoogleCalendarGrants.userId, userId))
					.limit(1)
			);
			return rows[0] ?? null;
		},

		/**
		 * @param {string} userId
		 * @param {{ refreshToken: string, accessToken?: string | null, accessTokenExpiresAt?: Date | null }} tokens
		 */
		async upsertGrant(userId, tokens) {
			const existing = await this.getGrant(userId);
			if (existing) {
				await transact((transaction) =>
					transaction
						.update(mtGoogleCalendarGrants)
						.set({
							refreshToken: tokens.refreshToken,
							accessToken: tokens.accessToken ?? null,
							accessTokenExpiresAt: tokens.accessTokenExpiresAt ?? null,
							updatedAt: new Date()
						})
						.where(eq(mtGoogleCalendarGrants.userId, userId))
				);
				return;
			}

			await transact((transaction) =>
				transaction.insert(mtGoogleCalendarGrants).values({
					userId,
					refreshToken: tokens.refreshToken,
					accessToken: tokens.accessToken ?? null,
					accessTokenExpiresAt: tokens.accessTokenExpiresAt ?? null
				})
			);
		},

		/** @param {string} userId @param {{ accessToken: string, accessTokenExpiresAt: Date | null }} tokens */
		async updateAccessToken(userId, tokens) {
			await transact((transaction) =>
				transaction
					.update(mtGoogleCalendarGrants)
					.set({
						accessToken: tokens.accessToken,
						accessTokenExpiresAt: tokens.accessTokenExpiresAt,
						updatedAt: new Date()
					})
					.where(eq(mtGoogleCalendarGrants.userId, userId))
			);
		}
	});
}

/** @returns {ReturnType<typeof createGoogleCalendarStore>} */
export function openGoogleCalendarStore() {
	try {
		return createGoogleCalendarStore(readRuntimeEnvironment().databaseUrl);
	} catch {
		throw new MariToolsUnavailableError();
	}
}
