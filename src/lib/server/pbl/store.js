import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getPblById } from '$lib/pbl/catalog.js';
import { normalizeRoomCode } from '$lib/pbl/room-code.js';
import {
	MAX_SOURCE_CHARS,
	canAcceptMember,
	normalizeOpenedHints,
	normalizeStepSources,
	normalizeStepYjs,
	normalizeTeamName,
	publicRoomView
} from '$lib/pbl/room-state.js';
import { SCIENCE_STARTER_SOURCE, SCIENCE_STEP_COUNT } from '$lib/pbl/science-workshop.js';
import {
	encodeSourceAsYjs,
	mergeAwarenessStates,
	mergeYjsStates,
	normalizeYjsState
} from '$lib/pbl/yjs-collab.js';
import { pblRoomMembers, pblRooms, pblStepSubmissions, user } from '../db/schema';
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
			awarenessState: row.awarenessState ?? '',
			stepSources: row.stepSources ?? {},
			stepYjs: row.stepYjs ?? {},
			members: Array.isArray(row.members) ? row.members : undefined
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
		},
		/** @param {Record<string, unknown>} values */
		async insertSubmission(values) {
			return oneRow(await transaction.insert(pblStepSubmissions).values(values).returning());
		},
		/** @param {string} roomId */
		async listSubmissions(roomId) {
			return transaction
				.select()
				.from(pblStepSubmissions)
				.where(eq(pblStepSubmissions.roomId, roomId))
				.orderBy(desc(pblStepSubmissions.createdAt));
		},
		/**
		 * @param {string} roomId
		 * @param {string} memberId
		 */
		async deleteMember(roomId, memberId) {
			await transaction
				.delete(pblRoomMembers)
				.where(and(eq(pblRoomMembers.roomId, roomId), eq(pblRoomMembers.memberId, memberId)));
			return true;
		},
		/** @param {string} roomId */
		async deleteRoom(roomId) {
			await transaction.delete(pblRooms).where(eq(pblRooms.id, roomId));
			return true;
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
	/** @type {any[]} */
	const submissions = [];
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
		},
		/** @param {Record<string, unknown>} values */
		async insertSubmission(values) {
			const row = { id: randomUUID(), createdAt: new Date(), ...values };
			submissions.push(row);
			return row;
		},
		/** @param {string} roomId */
		async listSubmissions(roomId) {
			return submissions
				.filter((row) => row.roomId === roomId)
				.sort((a, b) => {
					const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
					const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
					return bTime - aTime;
				});
		},
		/**
		 * @param {string} roomId
		 * @param {string} memberId
		 */
		async deleteMember(roomId, memberId) {
			const index = members.findIndex((row) => row.roomId === roomId && row.memberId === memberId);
			if (index >= 0) members.splice(index, 1);
			return true;
		},
		/** @param {string} roomId */
		async deleteRoom(roomId) {
			const index = rooms.findIndex((row) => row.id === roomId);
			if (index >= 0) rooms.splice(index, 1);
			for (let i = members.length - 1; i >= 0; i -= 1) {
				if (members[i].roomId === roomId) members.splice(i, 1);
			}
			for (let i = submissions.length - 1; i >= 0; i -= 1) {
				if (submissions[i].roomId === roomId) submissions.splice(i, 1);
			}
			return true;
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
				awarenessState: '',
				stepSources: { '0': SCIENCE_STARTER_SOURCE },
				stepYjs: {}
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
			if (viewerMemberId) {
				const membership = await repository.findMember(row.id, viewerMemberId);
				if (!membership) {
					throw new PblInputError('You were removed from this team.', 403);
				}
				const memberRows = await repository.listMembersWithUsers([row.id]);
				const members = memberRows.map((member) => ({
					memberId: member.memberId,
					userId: member.userId ?? null,
					email: member.email ?? null,
					name: member.name ?? null
				}));
				return roomFromRow({ ...row, members }, viewerMemberId);
			}
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
		 *   unlockedStep?: unknown,
		 *   openedHints?: unknown,
		 *   lastCheck?: unknown,
		 *   yjsState?: unknown,
		 *   awarenessState?: unknown,
		 *   stepSources?: unknown,
		 *   stepYjs?: unknown,
		 *   editingStep?: unknown,
		 *   replaceEditor?: unknown
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

			let stepSources = normalizeStepSources(row.stepSources);
			let stepYjs = normalizeStepYjs(row.stepYjs);
			if (input.stepSources !== undefined) {
				stepSources = {
					...stepSources,
					...normalizeStepSources(input.stepSources)
				};
			}
			if (input.stepYjs !== undefined) {
				stepYjs = {
					...stepYjs,
					...normalizeStepYjs(input.stepYjs)
				};
			}

			const editingStep = Number.isInteger(input.editingStep) ? input.editingStep : null;
			if (editingStep !== null) {
				if (editingStep < 0 || editingStep >= SCIENCE_STEP_COUNT) {
					throw new PblInputError('Invalid step.');
				}
				const unlockedGate = Number(input.unlockedStep ?? row.unlockedStep);
				if (editingStep > unlockedGate) throw new PblInputError('That step is still locked.');
			}

			const replaceEditor = input.replaceEditor === true;
			const stepKey = editingStep !== null ? String(editingStep) : null;

			if (yjsIncoming) {
				try {
					const priorYjs = replaceEditor
						? ''
						: stepKey
							? stepYjs[stepKey] || row.yjsState || ''
							: row.yjsState || '';
					const merged = mergeYjsStates(priorYjs, yjsIncoming);
					patch.yjsState = merged.yjsState;
					patch.source = merged.source;
					if (stepKey) {
						stepYjs = { ...stepYjs, [stepKey]: merged.yjsState };
						stepSources = { ...stepSources, [stepKey]: merged.source };
					}
				} catch (error) {
					throw new PblInputError(error instanceof Error ? error.message : 'Invalid editor sync.');
				}
			} else if (input.source !== undefined) {
				if (typeof input.source !== 'string' || input.source.length > MAX_SOURCE_CHARS) {
					throw new PblInputError('The program is too long to sync.');
				}
				patch.source = input.source;
				if (stepKey) {
					stepSources = { ...stepSources, [stepKey]: input.source };
					if (replaceEditor || !stepYjs[stepKey]) {
						try {
							const encoded = encodeSourceAsYjs(input.source);
							stepYjs = { ...stepYjs, [stepKey]: encoded };
							patch.yjsState = encoded;
						} catch (error) {
							throw new PblInputError(
								error instanceof Error ? error.message : 'Invalid editor sync.'
							);
						}
					}
				}
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

			patch.stepSources = stepSources;
			patch.stepYjs = stepYjs;
			// Shared progress is unlockedStep only — keep DB currentStep aligned for legacy checks.
			const unlocked = Number(patch.unlockedStep ?? row.unlockedStep);
			if (unlocked !== row.currentStep) {
				patch.currentStep = unlocked;
				patch.stepEnteredAt = now();
			} else {
				patch.currentStep = unlocked;
			}

			const updated = await repository.updateRoom(row.code, row.version, patch);
			if (!updated) throw new PblConflictError(roomFromRow(row, input.memberId));
			return roomFromRow(updated, input.memberId);
		},

		/**
		 * @param {{
		 *   code: unknown,
		 *   memberId: string,
		 *   step: unknown,
		 *   source: unknown,
		 *   passed: unknown,
		 *   message?: unknown
		 * }} input
		 */
		async recordSubmission(input) {
			const room = await this.getRoom(input.code);
			const row = await repository.findRoomByCode(room.code);
			if (!row) throw new PblNotFoundError();
			const member = await repository.findMember(row.id, input.memberId);
			if (!member) throw new PblInputError('Join this team before editing.', 403);
			if (!Number.isInteger(input.step) || input.step < 0 || input.step >= SCIENCE_STEP_COUNT) {
				throw new PblInputError('Invalid step.');
			}
			if (typeof input.source !== 'string' || input.source.length > MAX_SOURCE_CHARS) {
				throw new PblInputError('The program is too long to sync.');
			}
			if (typeof input.passed !== 'boolean') throw new PblInputError('Invalid check result.');
			const message =
				typeof input.message === 'string' ? input.message.slice(0, 2000) : null;
			const saved = await repository.insertSubmission({
				roomId: row.id,
				step: input.step,
				source: input.source,
				passed: input.passed,
				message,
				memberId: input.memberId
			});
			if (!saved) throw new PblInputError('Could not save the submission.', 503);
			return {
				id: saved.id,
				step: saved.step,
				passed: saved.passed,
				message: saved.message ?? null,
				createdAt:
					saved.createdAt instanceof Date
						? saved.createdAt.toISOString()
						: String(saved.createdAt ?? now().toISOString())
			};
		},

		/** @param {unknown} code */
		async getStaffRoom(code) {
			const normalized = (await this.getRoom(code)).code;
			const row = await repository.findRoomByCode(normalized);
			if (!row) throw new PblNotFoundError();
			const memberRows = await repository.listMembersWithUsers([row.id]);
			const submissions = repository.listSubmissions
				? await repository.listSubmissions(row.id)
				: [];
			return {
				code: row.code,
				pblId: row.pblId,
				teamName: row.teamName,
				source: row.source ?? '',
				unlockedStep: row.unlockedStep,
				driverMemberId: row.driverMemberId ?? null,
				lastCheck: row.lastCheck ?? null,
				memberCount: row.memberCount,
				stepSources: normalizeStepSources(row.stepSources),
				stepYjs: normalizeStepYjs(row.stepYjs),
				updatedAt:
					row.updatedAt instanceof Date
						? row.updatedAt.toISOString()
						: row.updatedAt
							? String(row.updatedAt)
							: null,
				members: memberRows.map((member) => ({
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
				})),
				submissions: submissions.map((item) => ({
					id: item.id,
					step: item.step,
					source: item.source ?? '',
					passed: Boolean(item.passed),
					message: item.message ?? null,
					memberId: item.memberId ?? null,
					createdAt:
						item.createdAt instanceof Date
							? item.createdAt.toISOString()
							: item.createdAt
								? String(item.createdAt)
								: null
				}))
			};
		},

		/**
		 * Leader eject (or staff via staffEjectMember).
		 * @param {{ code: unknown, actorMemberId?: string, targetMemberId: string, asStaff?: boolean }} input
		 */
		async ejectMember(input) {
			const normalized = normalizeRoomCode(input.code);
			if (!normalized) throw new PblInputError('That room code is not valid.');
			const row = await repository.findRoomByCode(normalized);
			if (!row) throw new PblNotFoundError();
			const targetId = typeof input.targetMemberId === 'string' ? input.targetMemberId : '';
			if (!targetId) throw new PblInputError('Pick a teammate to remove.');
			if (targetId === row.driverMemberId) {
				throw new PblInputError('The team leader cannot be removed. Transfer leadership first.');
			}
			if (!input.asStaff) {
				const actorId = typeof input.actorMemberId === 'string' ? input.actorMemberId : '';
				if (!actorId || actorId !== row.driverMemberId) {
					throw new PblInputError('Only the team leader can remove teammates.', 403);
				}
				if (actorId === targetId) {
					throw new PblInputError('You cannot remove yourself.');
				}
			}
			const target = await repository.findMember(row.id, targetId);
			if (!target) throw new PblInputError('That teammate is not on this team.', 404);
			await repository.deleteMember(row.id, targetId);
			const nextCount = Math.max(1, Number(row.memberCount) - 1);
			const updated = await repository.updateRoom(row.code, row.version, {
				memberCount: nextCount,
				version: row.version + 1,
				updatedAt: now()
			});
			if (!updated) {
				// Member already deleted; still return current view for staff.
				const fresh = await repository.findRoomByCode(normalized);
				return roomFromRow(fresh ?? row);
			}
			return roomFromRow(updated);
		},

		/**
		 * @param {{ code: unknown, targetMemberId: string }} input
		 */
		async staffEjectMember(input) {
			return this.ejectMember({ ...input, asStaff: true });
		},

		/**
		 * @param {{ code: unknown, newDriverMemberId: string }} input
		 */
		async transferDriver(input) {
			const normalized = normalizeRoomCode(input.code);
			if (!normalized) throw new PblInputError('That room code is not valid.');
			const row = await repository.findRoomByCode(normalized);
			if (!row) throw new PblNotFoundError();
			const nextDriver =
				typeof input.newDriverMemberId === 'string' ? input.newDriverMemberId : '';
			if (!nextDriver) throw new PblInputError('Pick a new team leader.');
			const target = await repository.findMember(row.id, nextDriver);
			if (!target) throw new PblInputError('That teammate is not on this team.', 404);
			if (nextDriver === row.driverMemberId) {
				return roomFromRow(row);
			}
			const updated = await repository.updateRoom(row.code, row.version, {
				driverMemberId: nextDriver,
				version: row.version + 1,
				updatedAt: now()
			});
			if (!updated) throw new PblConflictError(roomFromRow(row));
			return roomFromRow(updated);
		},

		/** @param {{ code: unknown }} input */
		async disbandRoom(input) {
			const normalized = normalizeRoomCode(input.code);
			if (!normalized) throw new PblInputError('That room code is not valid.');
			const row = await repository.findRoomByCode(normalized);
			if (!row) throw new PblNotFoundError();
			await repository.deleteRoom(row.id);
			return { ok: true, code: normalized };
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
					unlockedStep: row.unlockedStep,
					lastCheck: row.lastCheck ?? null,
					memberCount: row.memberCount,
					stepCount: Object.keys(normalizeStepSources(row.stepSources)).length,
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
