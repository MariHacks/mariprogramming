import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getPblById } from '$lib/pbl/catalog.js';
import { normalizeRoomCode } from '$lib/pbl/room-code.js';
import {
	MAX_SOURCE_CHARS,
	canAcceptMember,
	normalizeOpenedHints,
	normalizeTeamName,
	publicRoomView
} from '$lib/pbl/room-state.js';
import { SCIENCE_STARTER_SOURCE, SCIENCE_STEP_COUNT } from '$lib/pbl/science-workshop.js';
import { mergeAwarenessStates, mergeYjsStates, normalizeYjsState } from '$lib/pbl/yjs-collab.js';
import { pblRoomMembers, pblRooms, user } from '../db/schema';
import { generateRoomCode } from './ids.js';

export class PblInputError extends Error {
	/** @param {string} message @param {number} [status] */
	constructor(message, status = 400) {
		super(message);
		this.name = 'PblInputError';
		this.status = status;
	}
}

export class PblNotFoundError extends Error {
	constructor() {
		super('Room not found.');
		this.name = 'PblNotFoundError';
		this.status = 404;
	}
}

export class PblFullError extends Error {
	constructor() {
		super('This team is full (10 people).');
		this.name = 'PblFullError';
		this.status = 403;
	}
}

export class PblConflictError extends Error {
	/** @param {ReturnType<typeof publicRoomView>} room */
	constructor(room) {
		super('The room changed on another device.');
		this.name = 'PblConflictError';
		this.status = 409;
		this.room = room;
	}
}

/** @param {any} rows */
function oneRow(rows) {
	return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/** @param {any} row @param {string} [viewerMemberId] */
export function roomFromRow(row, viewerMemberId) {
	if (!row) return null;
	return publicRoomView(
		{
			code: row.code,
			pblId: row.pblId,
			teamName: row.teamName,
			source: row.source,
			currentStep: row.currentStep,
			unlockedStep: row.unlockedStep,
			lastCheck: row.lastCheck ?? null,
			openedHints: normalizeOpenedHints(row.openedHints),
			stepEnteredAt:
				row.stepEnteredAt instanceof Date
					? row.stepEnteredAt.toISOString()
					: String(row.stepEnteredAt),
			memberCount: row.memberCount,
			version: row.version,
			driverMemberId: row.driverMemberId ?? null,
			yjsState: row.yjsState ?? '',
			awarenessState: row.awarenessState ?? ''
		},
		viewerMemberId
	);
}

/** @param {any} transaction */
export function createDrizzlePblRepository(transaction) {
	return {
		/** @param {Record<string, unknown>} values */
		async insertRoom(values) {
			return oneRow(await transaction.insert(pblRooms).values(values).returning());
		},
		/** @param {Record<string, unknown>} values */
		async insertMember(values) {
			return oneRow(await transaction.insert(pblRoomMembers).values(values).returning());
		},
		/** @param {string} code */
		async findRoomByCode(code) {
			return oneRow(
				await transaction.select().from(pblRooms).where(eq(pblRooms.code, code)).limit(1)
			);
		},
		/**
		 * @param {string} roomId
		 * @param {string} memberId
		 */
		async findMember(roomId, memberId) {
			return oneRow(
				await transaction
					.select()
					.from(pblRoomMembers)
					.where(and(eq(pblRoomMembers.roomId, roomId), eq(pblRoomMembers.memberId, memberId)))
					.limit(1)
			);
		},
		/**
		 * @param {string} roomId
		 * @param {string} userId
		 */
		async findMemberByUser(roomId, userId) {
			return oneRow(
				await transaction
					.select()
					.from(pblRoomMembers)
					.where(and(eq(pblRoomMembers.roomId, roomId), eq(pblRoomMembers.userId, userId)))
					.limit(1)
			);
		},
		/**
		 * @param {string} code
		 * @param {number} expectedVersion
		 * @param {Record<string, unknown>} patch
		 */
		async updateRoom(code, expectedVersion, patch) {
			return oneRow(
				await transaction
					.update(pblRooms)
					.set(patch)
					.where(and(eq(pblRooms.code, code), eq(pblRooms.version, expectedVersion)))
					.returning()
			);
		},
		async listRooms() {
			return transaction.select().from(pblRooms).orderBy(desc(pblRooms.updatedAt), desc(pblRooms.code));
		},
		/** @param {string[]} roomIds */
		async listMembersWithUsers(roomIds) {
			if (!Array.isArray(roomIds) || roomIds.length === 0) return [];
			return transaction
				.select({
					roomId: pblRoomMembers.roomId,
					memberId: pblRoomMembers.memberId,
					userId: pblRoomMembers.userId,
					joinedAt: pblRoomMembers.joinedAt,
					email: user.email,
					name: user.name
				})
				.from(pblRoomMembers)
				.leftJoin(user, eq(pblRoomMembers.userId, user.id))
				.where(inArray(pblRoomMembers.roomId, roomIds));
		}
	};
}

/**
 * Process-local rooms for local preview when DATABASE_URL is not set.
 * Two browser sessions on the same Node process share this store.
 */
export function createMemoryPblRepository() {
	/** @type {any[]} */
	const rooms = [];
	/** @type {any[]} */
	const members = [];
	return {
		/** @param {Record<string, unknown>} values */
		async insertRoom(values) {
			const row = { id: randomUUID(), ...values };
			rooms.push(row);
			return row;
		},
		/** @param {Record<string, unknown>} values */
		async insertMember(values) {
			members.push(values);
			return values;
		},
		/** @param {string} code */
		async findRoomByCode(code) {
			return rooms.find((row) => row.code === code) ?? null;
		},
		/**
		 * @param {string} roomId
		 * @param {string} memberId
		 */
		async findMember(roomId, memberId) {
			return members.find((row) => row.roomId === roomId && row.memberId === memberId) ?? null;
		},
		/**
		 * @param {string} roomId
		 * @param {string} userId
		 */
		async findMemberByUser(roomId, userId) {
			return members.find((row) => row.roomId === roomId && row.userId === userId) ?? null;
		},
		/**
		 * @param {string} code
		 * @param {number} expectedVersion
		 * @param {Record<string, unknown>} patch
		 */
		async updateRoom(code, expectedVersion, patch) {
			const row = rooms.find((item) => item.code === code && item.version === expectedVersion);
			if (!row) return null;
			Object.assign(row, patch);
			return { ...row };
		},
		async listRooms() {
			return [...rooms].sort((a, b) => {
				const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
				const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
				if (bTime !== aTime) return bTime - aTime;
				return String(b.code).localeCompare(String(a.code));
			});
		},
		/** @param {string[]} roomIds */
		async listMembersWithUsers(roomIds) {
			const wanted = new Set(roomIds);
			return members
				.filter((row) => wanted.has(row.roomId))
				.map((row) => ({
					roomId: row.roomId,
					memberId: row.memberId,
					userId: row.userId ?? null,
					joinedAt: row.joinedAt ?? null,
					email: row.email ?? null,
					name: row.name ?? null
				}));
		}
	};
}

/** @type {ReturnType<typeof createMemoryPblRepository> | null} */
let sharedMemory = null;

export function getSharedMemoryPblRepository() {
	if (!sharedMemory) sharedMemory = createMemoryPblRepository();
	return sharedMemory;
}

export function _resetSharedMemoryPblRepository() {
	sharedMemory = null;
}

/**
 * @param {any} repository
 * @param {{ now?: () => Date, createCode?: () => string }} [clock]
 */
export function createPblStore(repository, clock = {}) {
	const now = clock.now ?? (() => new Date());
	const createCode = clock.createCode ?? generateRoomCode;

	async function uniqueCode() {
		for (let attempt = 0; attempt < 8; attempt += 1) {
			const code = createCode();
			const existing = await repository.findRoomByCode(code);
			if (!existing) return code;
		}
		throw new PblInputError('Could not create a room code.', 503);
	}

	return {
		/**
		 * @param {{ pblId: unknown, teamName: unknown, memberId: string, userId: string }} input
		 */
		async createRoom(input) {
			const catalogEntry = getPblById(input.pblId);
			if (!catalogEntry) throw new PblInputError('Unknown workshop.');
			const teamName = normalizeTeamName(input.teamName);
			if (!teamName) throw new PblInputError('Enter a team name.');
			if (typeof input.userId !== 'string' || input.userId.length === 0) {
				throw new PblInputError('Sign in with your club Google account to create a team.', 401);
			}
			const enteredAt = now();
			const row = await repository.insertRoom({
				code: await uniqueCode(),
				pblId: catalogEntry.id,
				teamName,
				source: SCIENCE_STARTER_SOURCE,
				currentStep: 0,
				unlockedStep: 0,
				lastCheck: null,
				openedHints: {},
				stepEnteredAt: enteredAt,
				memberCount: 1,
				version: 1,
				driverMemberId: input.memberId,
				yjsState: '',
				awarenessState: ''
			});
			if (!row) throw new PblInputError('Could not create the team room.', 503);
			await repository.insertMember({
				roomId: row.id,
				memberId: input.memberId,
				userId: input.userId
			});
			return roomFromRow(row, input.memberId);
		},

		/** @param {unknown} code @param {string} [viewerMemberId] */
		async getRoom(code, viewerMemberId) {
			const normalized = normalizeRoomCode(code);
			if (!normalized) throw new PblInputError('That room code is not valid.');
			const row = await repository.findRoomByCode(normalized);
			if (!row) throw new PblNotFoundError();
			return roomFromRow(row, viewerMemberId);
		},

		/**
		 * @param {{ code: unknown, memberId: string, userId: string }} input
		 */
		async joinRoom(input) {
			if (typeof input.userId !== 'string' || input.userId.length === 0) {
				throw new PblInputError('Sign in with your club Google account to join a team.', 401);
			}
			const room = await this.getRoom(input.code);
			const row = await repository.findRoomByCode(room.code);
			if (!row) throw new PblNotFoundError();
			const byUser = await repository.findMemberByUser(row.id, input.userId);
			if (byUser) return roomFromRow(row, input.memberId);
			const existing = await repository.findMember(row.id, input.memberId);
			if (existing) return roomFromRow(row, input.memberId);
			if (!canAcceptMember(row.memberCount)) throw new PblFullError();
			const updated = await repository.updateRoom(row.code, row.version, {
				memberCount: row.memberCount + 1,
				version: row.version + 1,
				updatedAt: now()
			});
			if (!updated) throw new PblConflictError(roomFromRow(row, input.memberId));
			await repository.insertMember({
				roomId: row.id,
				memberId: input.memberId,
				userId: input.userId
			});
			return roomFromRow(updated, input.memberId);
		},

		/**
		 * @param {{
		 *   code: unknown,
		 *   memberId: string,
		 *   version: unknown,
		 *   source?: unknown,
		 *   currentStep?: unknown,
		 *   unlockedStep?: unknown,
		 *   openedHints?: unknown,
		 *   lastCheck?: unknown,
		 *   yjsState?: unknown,
		 *   awarenessState?: unknown
		 * }} input
		 */
		async updateRoom(input) {
			const room = await this.getRoom(input.code);
			const row = await repository.findRoomByCode(room.code);
			if (!row) throw new PblNotFoundError();
			const member = await repository.findMember(row.id, input.memberId);
			if (!member) throw new PblInputError('Join this team before editing.', 403);
			if (!Number.isInteger(input.version)) throw new PblInputError('Missing room version.');
			if (input.version !== row.version)
				throw new PblConflictError(roomFromRow(row, input.memberId));

			/** @type {Record<string, unknown>} */
			const patch = { version: row.version + 1, updatedAt: now() };
			const yjsIncoming = normalizeYjsState(input.yjsState);
			if (yjsIncoming === null) throw new PblInputError('Invalid editor sync.');
			const awarenessIncoming = normalizeYjsState(input.awarenessState);
			if (awarenessIncoming === null) throw new PblInputError('Invalid editor sync.');
			if (yjsIncoming) {
				try {
					const merged = mergeYjsStates(row.yjsState || '', yjsIncoming);
					patch.yjsState = merged.yjsState;
					patch.source = merged.source;
				} catch (error) {
					throw new PblInputError(error instanceof Error ? error.message : 'Invalid editor sync.');
				}
			} else if (input.source !== undefined) {
				if (typeof input.source !== 'string' || input.source.length > MAX_SOURCE_CHARS) {
					throw new PblInputError('The program is too long to sync.');
				}
				patch.source = input.source;
			}
			if (awarenessIncoming) {
				patch.awarenessState = mergeAwarenessStates(
					row.awarenessState || '',
					awarenessIncoming,
					now().getTime()
				);
			}
			if (input.openedHints !== undefined)
				patch.openedHints = normalizeOpenedHints(input.openedHints);
			if (input.lastCheck !== undefined) patch.lastCheck = input.lastCheck;
			if (input.unlockedStep !== undefined) {
				if (!Number.isInteger(input.unlockedStep) || input.unlockedStep < row.unlockedStep) {
					throw new PblInputError('Invalid step.');
				}
				patch.unlockedStep = Math.min(SCIENCE_STEP_COUNT - 1, input.unlockedStep);
			}
			if (input.currentStep !== undefined) {
				if (!Number.isInteger(input.currentStep) || input.currentStep < 0) {
					throw new PblInputError('Invalid step.');
				}
				const unlocked = Number(patch.unlockedStep ?? row.unlockedStep);
				if (input.currentStep > unlocked) throw new PblInputError('That step is still locked.');
				patch.currentStep = input.currentStep;
				if (input.currentStep !== row.currentStep) patch.stepEnteredAt = now();
			}
			const updated = await repository.updateRoom(row.code, row.version, patch);
			if (!updated) throw new PblConflictError(roomFromRow(row, input.memberId));
			return roomFromRow(updated, input.memberId);
		},

		async listStaffRooms() {
			const rows = await repository.listRooms();
			const roomIds = rows.map((row) => row.id).filter(Boolean);
			const memberRows = await repository.listMembersWithUsers(roomIds);
			/** @type {Map<string, any[]>} */
			const byRoom = new Map();
			for (const member of memberRows) {
				const list = byRoom.get(member.roomId) ?? [];
				list.push({
					memberId: member.memberId,
					userId: member.userId ?? null,
					email: member.email ?? null,
					name: member.name ?? null,
					joinedAt:
						member.joinedAt instanceof Date
							? member.joinedAt.toISOString()
							: member.joinedAt
								? String(member.joinedAt)
								: null
				});
				byRoom.set(member.roomId, list);
			}
			return rows.map((row) => {
				const membersForRoom = byRoom.get(row.id) ?? [];
				return {
					code: row.code,
					pblId: row.pblId,
					teamName: row.teamName,
					source: row.source ?? '',
					currentStep: row.currentStep,
					unlockedStep: row.unlockedStep,
					lastCheck: row.lastCheck ?? null,
					memberCount: row.memberCount,
					updatedAt:
						row.updatedAt instanceof Date
							? row.updatedAt.toISOString()
							: row.updatedAt
								? String(row.updatedAt)
								: null,
					members: membersForRoom
				};
			});
		}
	};
}
