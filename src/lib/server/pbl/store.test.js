import { describe, expect, it, vi } from 'vitest';
import { SCIENCE_STARTER_SOURCE, SCIENCE_STEP_COUNT } from '$lib/pbl/science-workshop.js';
import {
	PblConflictError,
	PblFullError,
	PblInputError,
	PblNotFoundError,
	_resetSharedMemoryPblRepository,
	createDrizzlePblRepository,
	createMemoryPblRepository,
	createPblStore,
	getSharedMemoryPblRepository,
	isExecutiveOwner,
	roomFromRow
} from './store.js';

const NOW = new Date('2026-09-08T15:00:00.000Z');
const MEMBER = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USER = 'user-lab-3';

function roomRow(overrides = {}) {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		code: 'AB23JK',
		pblId: 'science',
		teamName: 'Lab table 3',
		source: SCIENCE_STARTER_SOURCE,
		currentStep: 0,
		unlockedStep: 0,
		lastCheck: null,
		openedHints: {},
		stepEnteredAt: NOW,
		memberCount: 1,
		version: 1,
		driverMemberId: MEMBER,
		...overrides
	};
}

function memoryRepo(seed = roomRow()) {
	/** @type {any[]} */
	const rooms = [seed];
	/** @type {any[]} */
	const members = [{ roomId: seed.id, memberId: MEMBER, userId: USER }];
	return {
		rooms,
		members,
		async insertRoom(values) {
			const row = roomRow({ ...values, id: '22222222-2222-4222-8222-222222222222' });
			rooms.push(row);
			return row;
		},
		async insertMember(values) {
			members.push(values);
			return values;
		},
		async findRoomByCode(code) {
			return rooms.find((row) => row.code === code) ?? null;
		},
		async findMember(roomId, memberId) {
			return members.find((row) => row.roomId === roomId && row.memberId === memberId) ?? null;
		},
		async findMemberByUser(roomId, userId) {
			return members.find((row) => row.roomId === roomId && row.userId === userId) ?? null;
		},
		async listRooms() {
			return [...rooms];
		},
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
		async updateRoom(code, expectedVersion, patch) {
			const row = rooms.find((item) => item.code === code && item.version === expectedVersion);
			if (!row) return null;
			Object.assign(row, patch);
			return { ...row };
		},
		async insertSubmission(values) {
			const row = { id: 'sub-1', createdAt: NOW, ...values };
			(this.submissions ??= []).push(row);
			return row;
		},
		async listSubmissions(roomId) {
			return (this.submissions ?? []).filter((row) => row.roomId === roomId);
		},
		async findClubActor(_userId) {
			return null;
		},
		async deleteMember(roomId, memberId) {
			const index = members.findIndex((row) => row.roomId === roomId && row.memberId === memberId);
			if (index >= 0) members.splice(index, 1);
			return true;
		},
		async deleteRoom(roomId) {
			const index = rooms.findIndex((row) => row.id === roomId);
			if (index >= 0) rooms.splice(index, 1);
			for (let i = members.length - 1; i >= 0; i -= 1) {
				if (members[i].roomId === roomId) members.splice(i, 1);
			}
			return true;
		}
	};
}

describe('PBL room store', () => {
	it('creates a science room with starter code and one member', async () => {
		const repo = memoryRepo(roomRow({ code: 'TAKEN1' }));
		const store = createPblStore(repo, { now: () => NOW, createCode: () => 'AB23JK' });
		const room = await store.createRoom({
			pblId: 'science',
			teamName: '  Lab table 3  ',
			memberId: MEMBER,
			userId: USER
		});
		expect(room).toMatchObject({
			code: 'AB23JK',
			pblId: 'science',
			teamName: 'Lab table 3',
			source: SCIENCE_STARTER_SOURCE,
			memberCount: 1,
			joinable: true,
			isDriver: true
		});
		expect(repo.members.at(-1)?.memberId).toBe(MEMBER);
		expect(repo.members.at(-1)?.userId).toBe(USER);
		const generated = await createPblStore(memoryRepo(roomRow({ code: 'TAKEN1' }))).createRoom({
			pblId: 'science',
			teamName: 'Lab table 4',
			memberId: MEMBER,
			userId: USER
		});
		expect(generated.code).toHaveLength(6);
	});

	it('retries when the first room code is already taken', async () => {
		let n = 0;
		const repo = memoryRepo(roomRow({ code: 'TAKEN1' }));
		const store = createPblStore(repo, {
			now: () => NOW,
			createCode: () => (n++ === 0 ? 'TAKEN1' : 'AB23JK')
		});
		const room = await store.createRoom({
			pblId: 'science',
			teamName: 'Lab table 3',
			memberId: MEMBER,
			userId: USER
		});
		expect(room.code).toBe('AB23JK');
	});

	it('fails closed when insert does not return a room', async () => {
		const repo = memoryRepo(roomRow({ code: 'TAKEN1' }));
		repo.insertRoom = async () => null;
		const store = createPblStore(repo, { now: () => NOW, createCode: () => 'AB23JK' });
		await expect(
			store.createRoom({ pblId: 'science', teamName: 'Lab', memberId: MEMBER, userId: USER })
		).rejects.toMatchObject({ status: 503 });
	});

	it('rejects unknown workshops, blank names, and missing rooms', async () => {
		const store = createPblStore(memoryRepo());
		await expect(
			store.createRoom({ pblId: 'nope', teamName: 'Lab', memberId: MEMBER, userId: USER })
		).rejects.toBeInstanceOf(PblInputError);
		await expect(
			store.createRoom({ pblId: 'science', teamName: '  ', memberId: MEMBER, userId: USER })
		).rejects.toBeInstanceOf(PblInputError);
		await expect(store.getRoom('??????')).rejects.toBeInstanceOf(PblInputError);
		await expect(store.getRoom('ZZZZZZ')).rejects.toBeInstanceOf(PblNotFoundError);
	});

	it('joins until the tenth person, then refuses', async () => {
		const repo = memoryRepo(roomRow({ memberCount: 9 }));
		const store = createPblStore(repo, { now: () => NOW });
		const first = await store.joinRoom({ code: 'ab23jk', memberId: MEMBER, userId: USER });
		expect(first.memberCount).toBe(9);
		const extra = await store.joinRoom({ code: 'AB23JK', memberId: 'b'.repeat(32), userId: 'user-b' });
		expect(extra.memberCount).toBe(10);
		repo.rooms[0].memberCount = 10;
		repo.rooms[0].version += 1;
		await expect(
			store.joinRoom({ code: 'AB23JK', memberId: 'c'.repeat(32), userId: 'user-c' })
		).rejects.toBeInstanceOf(PblFullError);
	});

	it('syncs source and step progress with optimistic versions', async () => {
		const repo = memoryRepo(roomRow({ unlockedStep: 1 }));
		const store = createPblStore(repo, { now: () => NOW });
		const updated = await store.updateRoom({
			code: 'AB23JK',
			memberId: MEMBER,
			version: 1,
			source: 'print("team")',
			editingStep: 1,
			unlockedStep: 1,
			openedHints: { '0': 2 },
			lastCheck: { step: 0, passed: true, message: 'ok', at: NOW.toISOString() }
		});
		expect(updated.source).toBe('print("team")');
		expect(updated.currentStep).toBe(1);
		expect(updated.unlockedStep).toBe(1);
		expect(updated.stepSources['1']).toBe('print("team")');
		expect(updated.openedHints).toEqual({ '0': 2 });
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: MEMBER, version: 1, source: 'stale' })
		).rejects.toBeInstanceOf(PblConflictError);
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: 'b'.repeat(32), version: 2, source: 'x' })
		).rejects.toMatchObject({ status: 403 });
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: MEMBER, version: 2, editingStep: 8 })
		).rejects.toMatchObject({ message: 'That step is still locked.' });
		await expect(
			store.updateRoom({
				code: 'AB23JK',
				memberId: MEMBER,
				version: 2,
				source: 'x'.repeat(100001)
			})
		).rejects.toMatchObject({ message: 'The program is too long to sync.' });
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: MEMBER, version: 2, unlockedStep: 0 })
		).rejects.toMatchObject({ message: 'Invalid step.' });
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: MEMBER, version: 2, editingStep: -1 })
		).rejects.toMatchObject({ message: 'Invalid step.' });
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: MEMBER, version: 1.5, source: 'x' })
		).rejects.toMatchObject({ message: 'Missing room version.' });
		repo.updateRoom = async () => null;
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: MEMBER, version: 2, source: 'again' })
		).rejects.toBeInstanceOf(PblConflictError);
	});

	it('maps drizzle rows and repository chains', async () => {
		const row = roomRow();
		const transaction = {
			insert: vi.fn(() => ({
				values: vi.fn(() => ({ returning: vi.fn(async () => [row]) }))
			})),
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ limit: vi.fn(async () => [row]) }))
				}))
			})),
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({ returning: vi.fn(async () => [row]) }))
				}))
			}))
		};
		const repo = createDrizzlePblRepository(transaction);
		expect(await repo.insertRoom({ code: 'AB23JK' })).toEqual(row);
		expect(await repo.insertMember({ memberId: MEMBER })).toEqual(row);
		expect(await repo.findRoomByCode('AB23JK')).toEqual(row);
		expect(await repo.findMember(row.id, MEMBER)).toEqual(row);
		expect(await repo.findMemberByUser(row.id, USER)).toEqual(row);
		expect(await repo.updateRoom('AB23JK', 1, { source: 'x' })).toEqual(row);
		const empty = createDrizzlePblRepository({
			insert: vi.fn(() => ({
				values: vi.fn(() => ({ returning: vi.fn(async () => []) }))
			})),
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ limit: vi.fn(async () => []) }))
				}))
			})),
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({ returning: vi.fn(async () => []) }))
				}))
			}))
		});
		expect(await empty.insertRoom({})).toBeNull();
		expect(roomFromRow(null)).toBeNull();
		expect(roomFromRow({ ...row, stepEnteredAt: NOW.toISOString() })?.stepEnteredAt).toBe(
			NOW.toISOString()
		);
		expect(
			roomFromRow({ ...row, yjsState: 'QQ==', awarenessState: 'QQ==' })?.yjsState
		).toBe('QQ==');
	});

	it('treats a vanished room as not found and keeps join counts if the update races', async () => {
		const repo = memoryRepo();
		const store = createPblStore(repo);
		let calls = 0;
		const originalFind = repo.findRoomByCode.bind(repo);
		repo.findRoomByCode = async (code) => {
			calls += 1;
			if (calls === 1) return originalFind(code);
			return null;
		};
		await expect(
			store.joinRoom({ code: 'AB23JK', memberId: 'b'.repeat(32), userId: 'user-b' })
		).rejects.toBeInstanceOf(PblNotFoundError);
		const updater = memoryRepo();
		let updateLooks = 0;
		const originalUpdateFind = updater.findRoomByCode.bind(updater);
		updater.findRoomByCode = async (code) => {
			updateLooks += 1;
			if (updateLooks === 1) return originalUpdateFind(code);
			return null;
		};
		await expect(
			createPblStore(updater, { now: () => NOW }).updateRoom({
				code: 'AB23JK',
				memberId: MEMBER,
				version: 1,
				source: 'print(1)'
			})
		).rejects.toBeInstanceOf(PblNotFoundError);
		const updating = memoryRepo();
		updating.updateRoom = async () => null;
		const joining = createPblStore(updating, { now: () => NOW });
		await expect(
			joining.joinRoom({ code: 'AB23JK', memberId: 'b'.repeat(32), userId: 'user-b' })
		).rejects.toBeInstanceOf(PblConflictError);
	});

	it('lets every member change source and merges Yjs updates', async () => {
		const other = 'b'.repeat(32);
		const repo = memoryRepo(roomRow({ memberCount: 2 }));
		repo.members.push({ roomId: repo.rooms[0].id, memberId: other });
		const store = createPblStore(repo, { now: () => NOW });
		const fromOther = await store.updateRoom({
			code: 'AB23JK',
			memberId: other,
			version: 1,
			source: 'print("from B")'
		});
		expect(fromOther.source).toBe('print("from B")');
		expect(fromOther.isDriver).toBe(false);
		const fromFirst = await store.updateRoom({
			code: 'AB23JK',
			memberId: MEMBER,
			version: 2,
			source: 'print("from A")'
		});
		expect(fromFirst.source).toBe('print("from A")');
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: other, version: 3, yjsState: '%%%' })
		).rejects.toMatchObject({ message: 'Invalid editor sync.' });
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: other, version: 3, awarenessState: '%%%' })
		).rejects.toMatchObject({ message: 'Invalid editor sync.' });
		const Y = await import('yjs');
		const { Awareness } = await import('y-protocols/awareness');
		const { PYTHON_YTEXT, bytesToBase64, encodeLocalAwareness } = await import(
			'$lib/pbl/yjs-collab.js'
		);
		const { MAX_SOURCE_CHARS } = await import('$lib/pbl/room-state.js');
		const left = new Y.Doc();
		left.getText(PYTHON_YTEXT).insert(0, 'AAA');
		const awDoc = new Y.Doc();
		const awareness = new Awareness(awDoc);
		awareness.setLocalStateField('user', { name: 'Ada', color: '#ff6188' });
		const merged = await store.updateRoom({
			code: 'AB23JK',
			memberId: other,
			version: 3,
			yjsState: bytesToBase64(Y.encodeStateAsUpdate(left)),
			awarenessState: encodeLocalAwareness(awareness)
		});
		expect(merged.source).toContain('AAA');
		expect(merged.awarenessState.length).toBeGreaterThan(0);
		const huge = new Y.Doc();
		huge.getText(PYTHON_YTEXT).insert(0, 'x'.repeat(MAX_SOURCE_CHARS + 1));
		await expect(
			store.updateRoom({
				code: 'AB23JK',
				memberId: other,
				version: 4,
				yjsState: bytesToBase64(Y.encodeStateAsUpdate(huge))
			})
		).rejects.toMatchObject({ message: 'The program is too long to sync.' });
		left.destroy();
		awareness.destroy();
		awDoc.destroy();
		huge.destroy();
	});

	it('keeps rooms in process memory for local preview', async () => {
		_resetSharedMemoryPblRepository();
		const first = getSharedMemoryPblRepository();
		expect(getSharedMemoryPblRepository()).toBe(first);
		const repo = createMemoryPblRepository();
		const store = createPblStore(repo, { now: () => NOW, createCode: () => 'MEM001' });
		const created = await store.createRoom({
			pblId: 'science',
			teamName: 'Memory lab',
			memberId: MEMBER,
			userId: USER
		});
		expect(created.code).toBe('MEM001');
		expect(await repo.findRoomByCode('NOPE01')).toBeNull();
		expect(await repo.updateRoom('MEM001', 99, { source: 'x' })).toBeNull();
		expect(await repo.updateRoom('MEM001', 1, { source: 'print(2)' })).toMatchObject({
			source: 'print(2)'
		});
		const stored = await repo.findRoomByCode('MEM001');
		expect(await repo.findMember(stored.id, 'missing')).toBeNull();
	});

	it('lists rooms with member accounts for staff', async () => {
		const repo = memoryRepo(
			roomRow({
				currentStep: 1,
				unlockedStep: 2,
				lastCheck: { step: 1, passed: true, message: 'ok' },
				source: 'print(1)',
				updatedAt: NOW
			})
		);
		repo.members[0].email = 'lab@marihacks.com';
		repo.members[0].name = 'Lab';
		const store = createPblStore(repo, { now: () => NOW });
		const rooms = await store.listStaffRooms();
		expect(rooms).toHaveLength(1);
		expect(rooms[0]).toMatchObject({
			code: 'AB23JK',
			teamName: 'Lab table 3',
			unlockedStep: 2,
			members: [
				{
					memberId: MEMBER,
					userId: USER,
					email: 'lab@marihacks.com',
					name: 'Lab'
				}
			]
		});
		expect(rooms[0].currentStep).toBeUndefined();
		expect(rooms[0].source).toBeUndefined();
	});

	it('records step submissions and loads a staff room detail', async () => {
		const repo = memoryRepo(
			roomRow({
				unlockedStep: 1,
				stepSources: { '0': 'print(0)', '1': 'print(1)' },
				source: 'print(1)'
			})
		);
		const store = createPblStore(repo, { now: () => NOW });
		const saved = await store.recordSubmission({
			code: 'AB23JK',
			memberId: MEMBER,
			step: 0,
			source: 'print(0)',
			passed: true,
			message: 'ok'
		});
		expect(saved).toMatchObject({ step: 0, passed: true, message: 'ok' });
		const detail = await store.getStaffRoom('AB23JK');
		expect(detail.unlockedStep).toBe(1);
		expect(detail.stepSources['0']).toBe('print(0)');
		expect(detail.submissions).toHaveLength(1);
		expect(detail.currentStep).toBeUndefined();
	});

	it('stores userId and refuses a second join for the same account', async () => {
		const repo = memoryRepo(roomRow({ memberCount: 1 }));
		const store = createPblStore(repo, { now: () => NOW });
		const again = await store.joinRoom({
			code: 'AB23JK',
			memberId: 'b'.repeat(32),
			userId: USER
		});
		expect(again.memberCount).toBe(1);
		expect(repo.members).toHaveLength(1);
		await expect(
			store.createRoom({ pblId: 'science', teamName: 'Lab', memberId: MEMBER, userId: '' })
		).rejects.toMatchObject({ status: 401 });
		await expect(
			store.joinRoom({ code: 'AB23JK', memberId: 'c'.repeat(32), userId: '' })
		).rejects.toMatchObject({ status: 401 });
	});

	it('gives up when every generated code is taken', async () => {
		const repo = memoryRepo();
		repo.findRoomByCode = async () => roomRow();
		const store = createPblStore(repo, { createCode: () => 'AB23JK', now: () => NOW });
		await expect(
			store.createRoom({ pblId: 'science', teamName: 'Lab', memberId: MEMBER, userId: USER })
		).rejects.toMatchObject({ status: 503 });
	});


	it('includes members for a room member viewer', async () => {
		const repo = memoryRepo(roomRow({ memberCount: 1 }));
		repo.members[0].email = 'lead@marihacks.com';
		repo.members[0].name = 'Lead';
		const store = createPblStore(repo, { now: () => NOW });
		const room = await store.getRoom('AB23JK', MEMBER);
		expect(room.isDriver).toBe(true);
		expect(room.members).toEqual([
			{ memberId: MEMBER, userId: USER, email: 'lead@marihacks.com', name: 'Lead' }
		]);
		const publicView = await store.getRoom('AB23JK');
		expect(publicView.members).toBeUndefined();
	});

	it('rebinds getRoom when cookie is stale but the same userId still has a membership', async () => {
		const repo = memoryRepo(roomRow({ memberCount: 1 }));
		const store = createPblStore(repo, { now: () => NOW });
		const stale = 'b'.repeat(32);
		const room = await store.getRoom('AB23JK', stale, USER);
		expect(room.memberId).toBe(MEMBER);
		expect(room.isDriver).toBe(true);
		expect(room.members).toEqual([
			expect.objectContaining({ memberId: MEMBER, userId: USER })
		]);
	});

	it('rebinds getRoom when cookie is missing but the signed-in user is a member', async () => {
		const repo = memoryRepo(roomRow({ memberCount: 1 }));
		const store = createPblStore(repo, { now: () => NOW });
		const room = await store.getRoom('AB23JK', undefined, USER);
		expect(room.memberId).toBe(MEMBER);
		expect(room.members?.[0]?.memberId).toBe(MEMBER);
	});

	it('still 403s getRoom when membership is truly gone for this userId', async () => {
		const repo = memoryRepo(roomRow({ memberCount: 1 }));
		const store = createPblStore(repo, { now: () => NOW });
		const stale = 'b'.repeat(32);
		await expect(store.getRoom('AB23JK', stale, 'someone-else')).rejects.toMatchObject({
			status: 403,
			message: /removed from this team/i
		});
		await expect(store.getRoom('AB23JK', stale)).rejects.toMatchObject({
			status: 403,
			message: /removed from this team/i
		});
	});

	it('lets the leader eject a teammate but not themselves or the driver', async () => {
		const other = 'b'.repeat(32);
		const repo = memoryRepo(roomRow({ memberCount: 2 }));
		repo.members.push({ roomId: repo.rooms[0].id, memberId: other, userId: 'user-b' });
		const store = createPblStore(repo, { now: () => NOW });
		const updated = await store.ejectMember({
			code: 'AB23JK',
			actorMemberId: MEMBER,
			targetMemberId: other
		});
		expect(updated.memberCount).toBe(1);
		expect(repo.members).toHaveLength(1);
		await expect(
			store.ejectMember({ code: 'AB23JK', actorMemberId: MEMBER, targetMemberId: MEMBER })
		).rejects.toMatchObject({ message: /leader cannot be removed|cannot remove yourself/i });
	});

	it('lets staff eject, transfer leadership, and disband a room', async () => {
		const other = 'b'.repeat(32);
		const repo = memoryRepo(roomRow({ memberCount: 2 }));
		repo.members.push({ roomId: repo.rooms[0].id, memberId: other, userId: 'user-b' });
		const store = createPblStore(repo, { now: () => NOW });
		await store.transferDriver({ code: 'AB23JK', newDriverMemberId: other });
		expect(repo.rooms[0].driverMemberId).toBe(other);
		await store.staffEjectMember({ code: 'AB23JK', targetMemberId: MEMBER });
		expect(repo.members.map((m) => m.memberId)).toEqual([other]);
		const gone = await store.disbandRoom({ code: 'AB23JK' });
		expect(gone).toEqual({ ok: true, code: 'AB23JK' });
		expect(repo.rooms).toHaveLength(0);
	});


	it('persists lastRun on updateRoom and exposes it on the public room', async () => {
		const repo = createMemoryPblRepository();
		const store = createPblStore(repo, { now: () => NOW, createCode: () => 'AB23JK' });
		await store.createRoom({ pblId: 'science', teamName: 'Lab table 3', memberId: MEMBER, userId: USER });
		const updated = await store.updateRoom({
			code: 'AB23JK',
			memberId: MEMBER,
			version: 1,
			lastRun: {
				output: 'Lab table 3\n',
				error: '',
				step: 0,
				at: NOW.toISOString(),
				running: false
			}
		});
		expect(updated.lastRun).toMatchObject({ output: 'Lab table 3\n', running: false, step: 0 });
		await expect(
			store.updateRoom({
				code: 'AB23JK',
				memberId: MEMBER,
				version: 2,
				lastRun: { output: 'x', step: 0, running: false }
			})
		).rejects.toBeInstanceOf(PblInputError);
	});


	it('keeps unlockedStep at 0 when a student creates a room', async () => {
		const repo = createMemoryPblRepository();
		const store = createPblStore(repo, {
			now: () => NOW,
			createCode: () => 'AB23JK',
			findClubActor: async () => ({ role: 'student', email: 'student@marihacks.com' })
		});
		const room = await store.createRoom({
			pblId: 'science',
			teamName: 'Student lab',
			memberId: MEMBER,
			userId: USER
		});
		expect(room.unlockedStep).toBe(0);
		expect(isExecutiveOwner({ role: 'student', email: 'student@marihacks.com' })).toBe(false);
	});

	it.each(['moderator', 'staff', 'executive'])(
		'unlocks every Science step when a %s creates a room',
		async (role) => {
			const repo = createMemoryPblRepository();
			const store = createPblStore(repo, {
				now: () => NOW,
				createCode: () => 'AB23JK',
				findClubActor: async () => ({ role, email: 'exec@marihacks.com' })
			});
			const room = await store.createRoom({
				pblId: 'science',
				teamName: 'Exec lab',
				memberId: MEMBER,
				userId: USER
			});
			expect(room.unlockedStep).toBe(SCIENCE_STEP_COUNT - 1);
		}
	);

	it('unlocks when the creator is a staff email even without an executive role', async () => {
		const repo = createMemoryPblRepository();
		const store = createPblStore(repo, {
			now: () => NOW,
			createCode: () => 'AB23JK',
			findClubActor: async () => ({ role: 'student', email: 'team@marihacks.com' })
		});
		const room = await store.createRoom({
			pblId: 'science',
			teamName: 'Team lab',
			memberId: MEMBER,
			userId: USER
		});
		expect(room.unlockedStep).toBe(SCIENCE_STEP_COUNT - 1);
	});

	it('elevates and persists unlockedStep when getRoom sees an executive driver', async () => {
		const repo = memoryRepo(roomRow({ unlockedStep: 0, version: 1 }));
		repo.findClubActor = async (userId) =>
			userId === USER ? { role: 'moderator', email: 'mod@marihacks.com' } : null;
		const store = createPblStore(repo, { now: () => NOW });
		const room = await store.getRoom('AB23JK');
		expect(room.unlockedStep).toBe(SCIENCE_STEP_COUNT - 1);
		expect(repo.rooms[0].unlockedStep).toBe(SCIENCE_STEP_COUNT - 1);
		expect(repo.rooms[0].version).toBe(2);
		const again = await store.getRoom('AB23JK');
		expect(again.unlockedStep).toBe(SCIENCE_STEP_COUNT - 1);
		expect(repo.rooms[0].version).toBe(2);
	});


});
