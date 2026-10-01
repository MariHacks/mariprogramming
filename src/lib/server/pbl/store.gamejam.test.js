import { describe, expect, it } from 'vitest';
import { GAMEJAM_STARTER_SOURCE, GAMEJAM_STEP_COUNT } from '$lib/pbl/gamejam-workshop.js';
import { SCIENCE_STARTER_SOURCE } from '$lib/pbl/science-workshop.js';
import { createMemoryPblRepository, createPblStore } from './store.js';

const NOW = new Date('2026-09-08T15:00:00.000Z');
const MEMBER = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USER = 'user-game-jam';

/** @param {{ role?: string, email?: string } | null} [actor] */
function store(actor = null) {
	const repo = createMemoryPblRepository();
	const who = { actor };
	return {
		repo,
		who,
		store: createPblStore(repo, {
			now: () => NOW,
			createCode: () => 'GJ23JK',
			findClubActor: async () => who.actor
		})
	};
}

async function createGameRoom(actor = null) {
	const made = store(actor);
	const room = await made.store.createRoom({
		pblId: 'gamejam',
		teamName: '  Survive Squad  ',
		memberId: MEMBER,
		userId: USER
	});
	return { ...made, room };
}

describe('PBL 2 rooms', () => {
	it('creates a game jam room with the game starter code, not the science starter', async () => {
		const { room } = await createGameRoom();
		expect(room).toMatchObject({
			code: 'GJ23JK',
			pblId: 'gamejam',
			teamName: 'Survive Squad',
			source: GAMEJAM_STARTER_SOURCE,
			unlockedStep: 0,
			memberCount: 1,
			isDriver: true
		});
		expect(room.stepSources).toEqual({ '0': GAMEJAM_STARTER_SOURCE });
		expect(room.source).not.toBe(SCIENCE_STARTER_SOURCE);
	});

	it('unlocks every game jam step for an executive creator', async () => {
		const { room } = await createGameRoom({ role: 'moderator', email: 'exec@marihacks.com' });
		expect(room.unlockedStep).toBe(GAMEJAM_STEP_COUNT - 1);
	});

	it('unlocks every step when the signed-in viewer is the staff account', async () => {
		const repo = createMemoryPblRepository();
		const actors = {
			[USER]: { role: 'student', email: 'nick.zhicheng@gmail.com' },
			'team-user': { role: 'staff', email: 'team@marihacks.com' }
		};
		const pbl = createPblStore(repo, {
			now: () => NOW,
			createCode: () => 'GJ23JK',
			findClubActor: async (userId) => actors[userId] ?? null
		});
		await pbl.createRoom({
			pblId: 'gamejam',
			teamName: 'test',
			memberId: MEMBER,
			userId: USER
		});
		const room = await pbl.getRoom('GJ23JK', MEMBER, 'team-user');
		expect(room.unlockedStep).toBe(GAMEJAM_STEP_COUNT - 1);
	});

	it('elevates an executive driver on read using the game jam step count', async () => {
		const { store: pbl, who } = await createGameRoom();
		who.actor = { role: 'moderator', email: 'exec@marihacks.com' };
		const room = await pbl.getRoom('GJ23JK', MEMBER);
		expect(room.unlockedStep).toBe(GAMEJAM_STEP_COUNT - 1);
	});

	it('syncs step code for any of the twelve steps and refuses a thirteenth', async () => {
		const { store: pbl } = await createGameRoom({ role: 'moderator', email: 'exec@marihacks.com' });
		const updated = await pbl.updateRoom({
			code: 'GJ23JK',
			memberId: MEMBER,
			version: 1,
			source: 'print("last")',
			editingStep: 11,
			unlockedStep: 11
		});
		expect(updated.stepSources['11']).toBe('print("last")');
		await expect(
			pbl.updateRoom({
				code: 'GJ23JK',
				memberId: MEMBER,
				version: updated.version,
				editingStep: 12
			})
		).rejects.toMatchObject({ message: 'Invalid step.' });
		await expect(
			pbl.updateRoom({
				code: 'GJ23JK',
				memberId: MEMBER,
				version: updated.version,
				unlockedStep: 40
			})
		).resolves.toMatchObject({ unlockedStep: 11 });
	});

	it('records submissions for game jam steps only up to the last one', async () => {
		const { store: pbl } = await createGameRoom();
		const saved = await pbl.recordSubmission({
			code: 'GJ23JK',
			memberId: MEMBER,
			step: 11,
			source: 'print(1)',
			passed: true,
			message: 'ok'
		});
		expect(saved.step).toBe(11);
		await expect(
			pbl.recordSubmission({
				code: 'GJ23JK',
				memberId: MEMBER,
				step: 12,
				source: 'print(1)',
				passed: true
			})
		).rejects.toMatchObject({ message: 'Invalid step.' });
	});
});
