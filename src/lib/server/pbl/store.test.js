import { describe, expect, it, vi } from 'vitest';
import { SCIENCE_STARTER_SOURCE } from '$lib/pbl/science-workshop.js';
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
		async updateRoom(code, expectedVersion, patch) {
			const row = rooms.find((item) => item.code === code && item.version === expectedVersion);
			if (!row) return null;
			Object.assign(row, patch);
			return { ...row };
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
			currentStep: 1,
			unlockedStep: 1,
			openedHints: { '0': 2 },
			lastCheck: { step: 0, passed: true, message: 'ok', at: NOW.toISOString() }
		});
		expect(updated.source).toBe('print("team")');
		expect(updated.currentStep).toBe(1);
		expect(updated.openedHints).toEqual({ '0': 2 });
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: MEMBER, version: 1, source: 'stale' })
		).rejects.toBeInstanceOf(PblConflictError);
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: 'b'.repeat(32), version: 2, source: 'x' })
		).rejects.toMatchObject({ status: 403 });
		await expect(
			store.updateRoom({ code: 'AB23JK', memberId: MEMBER, version: 2, currentStep: 8 })
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
			store.updateRoom({ code: 'AB23JK', memberId: MEMBER, version: 2, currentStep: -1 })
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
		expect(fromOther.isDriver).toBe(true);
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
});
