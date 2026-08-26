// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as environment from '../config/environment.js';
import {
	MariToolsConflictError,
	MariToolsNotFoundError,
	MariToolsUnavailableError,
	MariToolsValidationError
} from './repository.js';
import {
	createFreeTimeStore,
	openFreeTimeStore,
	publicBoardView,
	publicMemberView
} from './free-time-store.js';

const USER = 'user-1';
const TERM = 'fall-2026';
const BOARD = '70000000-0000-4000-8000-000000000001';
const MEMBER = '80000000-0000-4000-8000-000000000001';
const TOKEN = 'share-token-1';

function uniqueError() {
	return Object.assign(new Error('duplicate'), { code: '23505' });
}

/** @param {unknown[]} queue */
function queuedStore(queue) {
	let index = 0;
	const runTransaction = vi.fn(async (operation) => {
		const take = () => {
			const item = queue[index++];
			if (item instanceof Error) throw item;
			return item;
		};
		const chain = {
			select: () => chain,
			from: () => chain,
			where: () => chain,
			orderBy: () => chain,
			limit: () => chain,
			insert: () => chain,
			values: () => chain,
			returning: () => chain,
			update: () => chain,
			set: () => chain,
			execute: async () => [],
			then(resolve, reject) {
				return Promise.resolve().then(take).then(resolve, reject);
			}
		};
		return operation(chain);
	});
	return createFreeTimeStore('postgresql://maritools-test', runTransaction);
}

const BOARD_ROW = {
	id: BOARD,
	slug: 'study-group',
	title: 'Study group',
	termId: TERM,
	ownerUserId: USER,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	updatedAt: new Date('2026-01-01T00:00:00.000Z')
};

const MEMBER_ROW = {
	id: MEMBER,
	boardId: BOARD,
	displayName: 'Ada',
	availability: { mon: { '08:00': true } },
	shareToken: TOKEN,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	updatedAt: new Date('2026-01-01T00:00:00.000Z')
};

describe('public views', () => {
	it('redacts internal fields from board and member views', () => {
		expect(publicBoardView(null)).toBeNull();
		expect(publicMemberView(null)).toBeNull();
		expect(publicBoardView({ ...BOARD_ROW, members: 'nope' }).members).toEqual([]);
		const board = publicBoardView({
			...BOARD_ROW,
			members: [MEMBER_ROW, null]
		});
		expect(board).toMatchObject({ slug: 'study-group', title: 'Study group', termId: TERM });
		expect(board.members[0]).toMatchObject({ displayName: 'Ada', shareToken: TOKEN });
		expect(board.members[0]).not.toHaveProperty('boardId');
		expect(publicMemberView({ ...MEMBER_ROW, availability: 'nope' }).availability).toEqual({});
		expect(publicMemberView({ ...MEMBER_ROW, shareToken: undefined }).shareToken).toBeNull();
	});
});

describe('createFreeTimeStore', () => {
	it('rejects invalid configuration', () => {
		expect(() => createFreeTimeStore('')).toThrow(MariToolsUnavailableError);
		expect(() => createFreeTimeStore('postgresql://x', null)).toThrow(MariToolsUnavailableError);
	});

	it('creates a board', async () => {
		const store = queuedStore([[BOARD_ROW]]);
		await expect(
			store.createBoard({ slug: 'study-group', title: 'Study group', termId: TERM, ownerUserId: USER })
		).resolves.toMatchObject({ slug: 'study-group', title: 'Study group' });
		await expect(
			queuedStore([
				[{ ...BOARD_ROW, slug: 'open-board', title: 'Open board', ownerUserId: null }]
			]).createBoard({
				slug: 'open-board',
				title: 'Open board',
				termId: TERM
			})
		).resolves.toMatchObject({ slug: 'open-board' });
	});

	it('rejects invalid owner ids and empty inserts', async () => {
		const store = queuedStore([]);
		await expect(
			store.createBoard({ slug: 'study-group', title: 'Study group', termId: TERM, ownerUserId: 1 })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			queuedStore([[]]).createBoard({ slug: 'study-group', title: 'Study group', termId: TERM })
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedStore([new Error('insert failed')]).createBoard({
				slug: 'study-group',
				title: 'Study group',
				termId: TERM
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
	});

	it('validates board input', async () => {
		const store = queuedStore([]);
		await expect(store.createBoard({ slug: '', title: 'x', termId: TERM })).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(
			store.createBoard({ slug: 'Study Group', title: 'x', termId: TERM })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			store.createBoard({ slug: 'study-group', title: '   ', termId: TERM })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			store.createBoard({ slug: 'study-group', title: 'x', termId: '   ' })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			store.createBoard({ slug: 123, title: 'x', termId: TERM })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(store.getBoardBySlug(/** @type {any} */ (null))).resolves.toBeNull();
	});

	it('maps slug conflicts', async () => {
		const store = queuedStore([uniqueError()]);
		await expect(
			store.createBoard({ slug: 'study-group', title: 'Study group', termId: TERM })
		).rejects.toBeInstanceOf(MariToolsConflictError);
	});

	it('loads a board with members by slug', async () => {
		const store = queuedStore([[BOARD_ROW], [MEMBER_ROW]]);
		await expect(store.getBoardBySlug('study-group')).resolves.toMatchObject({
			slug: 'study-group',
			members: [{ displayName: 'Ada', shareToken: TOKEN }]
		});
	});

	it('returns null for a missing slug', async () => {
		const store = queuedStore([[]]);
		await expect(store.getBoardBySlug('missing')).resolves.toBeNull();
		await expect(store.getBoardBySlug('   ')).resolves.toBeNull();
	});

	it('creates a member availability row', async () => {
		const store = queuedStore([[{ id: BOARD }], [MEMBER_ROW]]);
		await expect(
			store.upsertMemberAvailability({
				boardId: BOARD,
				displayName: 'Ada',
				availability: { mon: { '08:00': true } }
			})
		).resolves.toMatchObject({ displayName: 'Ada', shareToken: expect.any(String) });
	});

	it('updates an existing member by share token', async () => {
		const updated = { ...MEMBER_ROW, availability: { tue: { '10:00': true } } };
		const store = queuedStore([[{ id: BOARD }], [MEMBER_ROW], [updated]]);
		await expect(
			store.upsertMemberAvailability({
				boardId: BOARD,
				displayName: 'Ada',
				availability: { tue: { '10:00': true } },
				shareToken: TOKEN
			})
		).resolves.toMatchObject({ shareToken: TOKEN, availability: { tue: { '10:00': true } } });
	});

	it('validates member availability input', async () => {
		const store = queuedStore([]);
		await expect(
			store.upsertMemberAvailability({ boardId: 'bad', displayName: 'Ada', availability: {} })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			store.upsertMemberAvailability({ boardId: 123, displayName: 'Ada', availability: {} })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			store.upsertMemberAvailability({ boardId: BOARD, displayName: '   ', availability: {} })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			store.upsertMemberAvailability({ boardId: BOARD, displayName: 'Ada', availability: null })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			store.upsertMemberAvailability({
				boardId: BOARD,
				displayName: 'Ada',
				availability: {},
				shareToken: '   '
			})
		).rejects.toBeInstanceOf(MariToolsValidationError);
	});

	it('rejects a missing board or share token', async () => {
		const store = queuedStore([[]]);
		await expect(
			store.upsertMemberAvailability({ boardId: BOARD, displayName: 'Ada', availability: {} })
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		const missingToken = queuedStore([[{ id: BOARD }], []]);
		await expect(
			missingToken.upsertMemberAvailability({
				boardId: BOARD,
				displayName: 'Ada',
				availability: {},
				shareToken: TOKEN
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		const wrongBoard = queuedStore([[{ id: BOARD }], [{ ...MEMBER_ROW, boardId: 'other-board' }]]);
		await expect(
			wrongBoard.upsertMemberAvailability({
				boardId: BOARD,
				displayName: 'Ada',
				availability: {},
				shareToken: TOKEN
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		const emptyUpdate = queuedStore([[{ id: BOARD }], [MEMBER_ROW], []]);
		await expect(
			emptyUpdate.upsertMemberAvailability({
				boardId: BOARD,
				displayName: 'Ada',
				availability: {},
				shareToken: TOKEN
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		const emptyInsert = queuedStore([[{ id: BOARD }], []]);
		await expect(
			emptyInsert.upsertMemberAvailability({
				boardId: BOARD,
				displayName: 'Ada',
				availability: {}
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		const conflict = queuedStore([[{ id: BOARD }], uniqueError()]);
		await expect(
			conflict.upsertMemberAvailability({
				boardId: BOARD,
				displayName: 'Ada',
				availability: {}
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);
	});

	it('maps unexpected database errors to unavailable', async () => {
		const store = queuedStore([
			new Error('connection failed')
		]);
		await expect(store.getBoardBySlug('study-group')).rejects.toBeInstanceOf(MariToolsUnavailableError);
		const nonArray = queuedStore([null]);
		await expect(nonArray.getBoardBySlug('study-group')).resolves.toBeNull();
	});
});

describe('openFreeTimeStore', () => {
	afterEach(() => vi.restoreAllMocks());

	it('builds a store from the runtime database url', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockReturnValue({
			databaseUrl: 'postgresql://runtime:secret@db.example/free-time'
		});
		const store = openFreeTimeStore();
		expect(typeof store.createBoard).toBe('function');
	});

	it('treats missing runtime config as unavailable', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockImplementation(() => {
			throw new Error('Server configuration is unavailable');
		});
		expect(() => openFreeTimeStore()).toThrow(MariToolsUnavailableError);
	});
});
