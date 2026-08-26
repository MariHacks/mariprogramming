import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { readRuntimeEnvironment } from '../config/environment.js';
import { mtFreeTimeBoards, mtFreeTimeMembers } from '../db/schema';
import { withDatabaseTransaction } from '../db/transaction.js';
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
		member.availability && typeof member.availability === 'object' && !Array.isArray(member.availability)
			? member.availability
			: {};
	return {
		id: member.id,
		displayName: member.displayName,
		availability,
		shareToken: member.shareToken ?? null
	};
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

		/** @param {string} slug */
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
				return publicBoardView({ ...board, members });
			} catch (error) {
				redactUnexpected(error);
			}
		},

		/**
		 * @param {{
		 *   boardId: unknown,
		 *   displayName: unknown,
		 *   availability: unknown,
		 *   shareToken?: unknown
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
					const rows = asRows(
						await transact((transaction) =>
							transaction
								.update(mtFreeTimeMembers)
								.set({
									displayName,
									availability,
									updatedAt: new Date()
								})
								.where(eq(mtFreeTimeMembers.id, member.id))
								.returning()
						)
					);
					const updated = rows[0];
					if (!updated) throw new MariToolsUnavailableError();
					return publicMemberView(updated);
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
								shareToken: token
							})
							.returning()
					)
				);
				const created = rows[0];
				if (!created) throw new MariToolsUnavailableError();
				return publicMemberView(created);
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
