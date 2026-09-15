import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { readRuntimeEnvironment } from '../config/environment.js';
import { mtFreeTimeBoards, mtFreeTimeMembers, mtStudentProfiles, user } from '../db/schema';
import { withDatabaseTransaction } from '../db/transaction.js';
import { isExecutiveAccount } from './community.js';
import {
	MariToolsConflictError,
	MariToolsNotFoundError,
	MariToolsUnavailableError,
	MariToolsValidationError,
	isUniqueViolation
} from './repository.js';

export { MariToolsUnavailableError };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** @returns {never} */
function invalid() {
	throw new MariToolsValidationError();
}

/** @returns {never} */
function notFound() {
	throw new MariToolsNotFoundError();
}

/** @param {unknown} error */
function redactUnexpected(error) {
	if (
		error instanceof MariToolsValidationError ||
		error instanceof MariToolsConflictError ||
		error instanceof MariToolsNotFoundError
	) {
		throw error;
	}
	throw new MariToolsUnavailableError();
}

/** @param {unknown} value @param {number} max */
function requiredText(value, max) {
	const text = typeof value === 'string' ? value.trim() : '';
	if (!text || text.length > max) return invalid();
	return text;
}

/** @param {unknown} value */
function requiredUuid(value) {
	const text = typeof value === 'string' ? value.trim() : '';
	if (!UUID_PATTERN.test(text)) return invalid();
	return text;
}

/** @param {unknown} value */
function optionalUserId(value) {
	if (value == null || value === '') return null;
	const text = typeof value === 'string' ? value.trim() : '';
	if (!text || text.length > 128) return invalid();
	return text;
}

/** @param {unknown} value */
function availabilityObject(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
	return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} rows */
function asRows(rows) {
	return Array.isArray(rows) ? rows : [];
}

/**
 * @param {string | null | undefined} userId
 * @param {{ role?: string | null, email?: string | null } | null | undefined} [account]
 * @returns {'guest' | 'signed_in' | 'executive'}
 */
export function freeTimeAccountKind(userId, account = null) {
	if (!userId) return 'guest';
	if (isExecutiveAccount(account)) return 'executive';
	return 'signed_in';
}

/** @param {any} board */
export function publicBoardView(board) {
	if (!board || typeof board !== 'object') return null;
	const members = Array.isArray(board.members)
		? board.members.map(publicMemberView).filter(Boolean)
		: [];
	return {
		id: board.id,
		slug: board.slug,
		title: board.title,
		termId: board.termId,
		createdAt: board.createdAt,
		members
	};
}

/** @param {any} member */
export function publicMemberView(member) {
	if (!member || typeof member !== 'object') return null;
	const availability =
		member.availability &&
		typeof member.availability === 'object' &&
		!Array.isArray(member.availability)
			? member.availability
			: {};
	const userId = typeof member.userId === 'string' && member.userId.trim() ? member.userId : null;
	const accountKind =
		member.accountKind === 'executive' ||
		member.accountKind === 'signed_in' ||
		member.accountKind === 'guest'
			? member.accountKind
			: freeTimeAccountKind(userId);
	return {
		id: member.id,
		displayName: member.displayName,
		availability,
		shareToken: member.shareToken ?? null,
		userId,
		accountKind
	};
}

/**
 * @param {(operation: (transaction: any) => Promise<any>) => Promise<any>} transact
 * @param {any[]} members
 */
async function withAccountKinds(transact, members) {
	const userIds = [
		...new Set(
			members
				.map((member) => (typeof member?.userId === 'string' ? member.userId.trim() : ''))
				.filter(Boolean)
		)
	];
	/** @type {Map<string, { email: string | null, role: string | null }>} */
	const accounts = new Map();
	if (userIds.length > 0) {
		const rows = asRows(
			await transact((transaction) =>
				transaction
					.select({
						userId: user.id,
						email: user.email,
						role: mtStudentProfiles.role
					})
					.from(user)
					.leftJoin(mtStudentProfiles, eq(mtStudentProfiles.userId, user.id))
					.where(inArray(user.id, userIds))
			)
		);
		for (const row of rows) {
			if (!row?.userId) continue;
			accounts.set(row.userId, {
				email: typeof row.email === 'string' ? row.email : null,
				role: typeof row.role === 'string' ? row.role : null
			});
		}
	}
	return members.map((member) => {
		const userId =
			typeof member?.userId === 'string' && member.userId.trim() ? member.userId : null;
		return {
			...member,
			userId,
			accountKind: freeTimeAccountKind(userId, userId ? (accounts.get(userId) ?? null) : null)
		};
	});
}

/**
 * @param {string} databaseUrl
 * @param {(operation: (transaction: any) => Promise<any>) => Promise<any>} [runTransaction]
 */
export function createFreeTimeStore(databaseUrl, runTransaction = withDatabaseTransaction) {
	if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
		throw new MariToolsUnavailableError();
	}
	if (typeof runTransaction !== 'function') {
		throw new MariToolsUnavailableError();
	}

	/** @param {(transaction: any) => Promise<any>} operation */
	const transact = (operation) => runTransaction(operation, { databaseUrl });

	/**
	 * @param {any} member
	 * @param {string | null} [signedInUserId]
	 */
	async function publishMember(member, signedInUserId = null) {
		const [enriched] = await withAccountKinds(transact, [
			{
				...member,
				userId: member.userId ?? signedInUserId ?? null
			}
		]);
		return publicMemberView(enriched);
	}

	return Object.freeze({
		/** @param {{ slug: unknown, title: unknown, termId: unknown, ownerUserId?: unknown }} input */
		async createBoard(input) {
			const slug = requiredText(input.slug, 120);
			if (!SLUG_PATTERN.test(slug)) return invalid();
			const title = requiredText(input.title, 240);
			const termId = requiredText(input.termId, 64);
			const ownerUserId = optionalUserId(input.ownerUserId);
			try {
				const rows = asRows(
					await transact((transaction) =>
						transaction
							.insert(mtFreeTimeBoards)
							.values({ slug, title, termId, ownerUserId })
							.returning()
					)
				);
				const board = rows[0];
				if (!board) throw new MariToolsUnavailableError();
				return publicBoardView({ ...board, members: [] });
			} catch (error) {
				if (isUniqueViolation(error)) throw new MariToolsConflictError();
				redactUnexpected(error);
			}
		},

		async listBoards(limit = 20, userId = null) {
			const capped = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 20;
			const viewer =
				typeof userId === 'string' && userId.trim().length > 0 && userId.trim().length <= 128
					? userId.trim()
					: null;
			if (!viewer) return [];
			try {
				const owned = asRows(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtFreeTimeBoards)
							.where(eq(mtFreeTimeBoards.ownerUserId, viewer))
							.orderBy(desc(mtFreeTimeBoards.createdAt))
							.limit(capped)
					)
				);
				const memberRows = asRows(
					await transact((transaction) =>
						transaction
							.select({ boardId: mtFreeTimeMembers.boardId })
							.from(mtFreeTimeMembers)
							.where(eq(mtFreeTimeMembers.userId, viewer))
					)
				);
				const ownedIds = new Set(owned.map((board) => board.id));
				const joinedIds = [
					...new Set(
						memberRows
							.map((row) => (typeof row?.boardId === 'string' ? row.boardId : ''))
							.filter((id) => id && !ownedIds.has(id))
					)
				];
				/** @type {any[]} */
				let joined = [];
				if (joinedIds.length > 0) {
					joined = asRows(
						await transact((transaction) =>
							transaction
								.select()
								.from(mtFreeTimeBoards)
								.where(inArray(mtFreeTimeBoards.id, joinedIds))
						)
					);
				}
				const merged = [...owned, ...joined].sort((a, b) => {
					const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
					const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
					return bTime - aTime;
				});
				return merged
					.slice(0, capped)
					.map((board) => publicBoardView({ ...board, members: [] }));
			} catch (error) {
				redactUnexpected(error);
			}
		},

		async getBoardBySlug(slug) {
			const normalized = typeof slug === 'string' ? slug.trim() : '';
			if (!normalized) return null;
			try {
				const boards = asRows(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtFreeTimeBoards)
							.where(eq(mtFreeTimeBoards.slug, normalized))
							.limit(1)
					)
				);
				const board = boards[0];
				if (!board) return null;
				const members = asRows(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtFreeTimeMembers)
							.where(eq(mtFreeTimeMembers.boardId, board.id))
							.orderBy(asc(mtFreeTimeMembers.createdAt))
					)
				);
				const withKinds = await withAccountKinds(transact, members);
				return publicBoardView({ ...board, members: withKinds });
			} catch (error) {
				redactUnexpected(error);
			}
		},

		/**
		 * Soft-join a signed-in account when they open a shared board link.
		 * Empty availability until they save; enough to list under Your boards.
		 * @param {{ boardId: unknown, userId: unknown, displayName?: unknown }} input
		 */
		async ensureBoardMembership(input) {
			const boardId = requiredUuid(input.boardId);
			const userId = optionalUserId(input.userId);
			if (!userId) return invalid();
			const displayName =
				typeof input.displayName === 'string' && input.displayName.trim()
					? requiredText(input.displayName, 120)
					: 'Member';
			try {
				const boards = asRows(
					await transact((transaction) =>
						transaction
							.select({ id: mtFreeTimeBoards.id })
							.from(mtFreeTimeBoards)
							.where(eq(mtFreeTimeBoards.id, boardId))
							.limit(1)
					)
				);
				if (!boards[0]) return notFound();

				const existing = asRows(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtFreeTimeMembers)
							.where(
								and(eq(mtFreeTimeMembers.boardId, boardId), eq(mtFreeTimeMembers.userId, userId))
							)
							.limit(1)
					)
				);
				if (existing[0]) return publishMember(existing[0], userId);

				const token = randomUUID();
				const rows = asRows(
					await transact((transaction) =>
						transaction
							.insert(mtFreeTimeMembers)
							.values({
								boardId,
								displayName,
								availability: {},
								shareToken: token,
								userId
							})
							.returning()
					)
				);
				const created = rows[0];
				if (!created) throw new MariToolsUnavailableError();
				return publishMember(created, userId);
			} catch (error) {
				if (isUniqueViolation(error)) {
					// concurrent join — re-read
					const again = asRows(
						await transact((transaction) =>
							transaction
								.select()
								.from(mtFreeTimeMembers)
								.where(
									and(eq(mtFreeTimeMembers.boardId, boardId), eq(mtFreeTimeMembers.userId, userId))
								)
								.limit(1)
						)
					);
					if (again[0]) return publishMember(again[0], userId);
				}
				redactUnexpected(error);
			}
		},

		/**
		 * @param {{
		 *   boardId: unknown,
		 *   displayName: unknown,
		 *   availability: unknown,
		 *   shareToken?: unknown,
		 *   userId?: unknown
		 * }} input
		 */
		async upsertMemberAvailability(input) {
			const boardId = requiredUuid(input.boardId);
			const displayName = requiredText(input.displayName, 120);
			const availability = availabilityObject(input.availability);
			const shareToken =
				input.shareToken == null || input.shareToken === ''
					? null
					: requiredText(input.shareToken, 64);
			const userId = optionalUserId(input.userId);
			try {
				const boards = asRows(
					await transact((transaction) =>
						transaction
							.select({ id: mtFreeTimeBoards.id })
							.from(mtFreeTimeBoards)
							.where(eq(mtFreeTimeBoards.id, boardId))
							.limit(1)
					)
				);
				if (!boards[0]) return notFound();

				if (userId) {
					const byUser = asRows(
						await transact((transaction) =>
							transaction
								.select()
								.from(mtFreeTimeMembers)
								.where(
									and(eq(mtFreeTimeMembers.boardId, boardId), eq(mtFreeTimeMembers.userId, userId))
								)
								.limit(1)
						)
					);
					const existingByUser = byUser[0];
					if (existingByUser) {
						const rows = asRows(
							await transact((transaction) =>
								transaction
									.update(mtFreeTimeMembers)
									.set({
										displayName,
										availability,
										userId,
										updatedAt: new Date()
									})
									.where(eq(mtFreeTimeMembers.id, existingByUser.id))
									.returning()
							)
						);
						const updated = rows[0];
						if (!updated) throw new MariToolsUnavailableError();
						return publishMember(updated, userId);
					}
				}

				if (shareToken) {
					const existing = asRows(
						await transact((transaction) =>
							transaction
								.select()
								.from(mtFreeTimeMembers)
								.where(eq(mtFreeTimeMembers.shareToken, shareToken))
								.limit(1)
						)
					);
					const member = existing[0];
					if (!member || member.boardId !== boardId) return notFound();
					/** @type {Record<string, unknown>} */
					const patch = {
						displayName,
						availability,
						updatedAt: new Date()
					};
					if (userId) patch.userId = userId;
					const rows = asRows(
						await transact((transaction) =>
							transaction
								.update(mtFreeTimeMembers)
								.set(patch)
								.where(eq(mtFreeTimeMembers.id, member.id))
								.returning()
						)
					);
					const updated = rows[0];
					if (!updated) throw new MariToolsUnavailableError();
					return publishMember(updated, userId);
				}

				const token = randomUUID();
				const rows = asRows(
					await transact((transaction) =>
						transaction
							.insert(mtFreeTimeMembers)
							.values({
								boardId,
								displayName,
								availability,
								shareToken: token,
								userId
							})
							.returning()
					)
				);
				const created = rows[0];
				if (!created) throw new MariToolsUnavailableError();
				return publishMember(created, userId);
			} catch (error) {
				if (isUniqueViolation(error)) throw new MariToolsConflictError();
				redactUnexpected(error);
			}
		}
	});
}

/** @returns {ReturnType<typeof createFreeTimeStore>} */
export function openFreeTimeStore() {
	try {
		return createFreeTimeStore(readRuntimeEnvironment().databaseUrl);
	} catch {
		throw new MariToolsUnavailableError();
	}
}
