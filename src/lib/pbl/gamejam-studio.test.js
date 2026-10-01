import { describe, expect, it, vi } from 'vitest';
import { pythonAvailable, runPython } from '../../test/python-worker-sim.js';
import { GAMEJAM_REFERENCE_SOURCES as REF } from './gamejam-reference.js';
import { GAMEJAM_STARTER_SOURCE, GAMEJAM_STEPS } from './gamejam-workshop.js';
import { SCIENCE_STARTER_SOURCE, SCIENCE_STEPS } from './science-workshop.js';
import { createWorkshopController } from './workshop-controller.js';

// What a student types into Program input. Generous on purpose: unused lines are ignored,
// and a guessing game that runs out of input stops with an error before it can be checked.
const PROGRAM_INPUT = [
	'my cat ate my alarm',
	'',
	'',
	'2',
	'',
	'1',
	'',
	'',
	'',
	...Array(20).fill('1')
].join('\n');

/** @param {{ pblId?: string, unlockedStep?: number, host?: any, runCheck?: any }} [options] */
function studio(options = {}) {
	const host = options.host ?? {
		run: vi.fn(async (code, trial) => runPython(code, trial)),
		destroy: vi.fn()
	};
	const sync = {
		join: vi.fn(async () => ({
			code: 'AB23JK',
			teamName: 'Game jam team',
			source: '',
			currentStep: 0,
			unlockedStep: options.unlockedStep ?? 0,
			openedHints: {},
			memberCount: 1,
			version: 1,
			isDriver: true,
			yjsState: '',
			awarenessState: ''
		})),
		start: vi.fn(),
		stop: vi.fn(),
		update: vi.fn(),
		flush: vi.fn(async () => {})
	};
	const controller = createWorkshopController({
		code: 'AB23JK',
		pblId: options.pblId,
		now: () => '2026-09-08T15:00:00.000Z',
		createHost: () => host,
		createSync: () => sync,
		fetch: vi.fn(async () => new Response('{}')),
		...(options.runCheck ? { runCheck: options.runCheck } : {})
	});
	return { controller, host, sync };
}

describe('game jam studio', () => {
	it('starts a team on the Game loaded starter with the game jam steps', async () => {
		const { controller } = studio({ pblId: 'gamejam' });
		await controller.join();
		const state = controller.getState();
		expect(state.steps).toBe(GAMEJAM_STEPS);
		expect(state.step.title).toBe('Get something running');
		expect(state.source).toBe(GAMEJAM_STARTER_SOURCE);
		expect(state.stepSources['0']).toBe(GAMEJAM_STARTER_SOURCE);
		controller.destroy();
	});

	it('keeps PBL 1 on the science steps and starter when no workshop is named', async () => {
		const { controller } = studio();
		await controller.join();
		const state = controller.getState();
		expect(state.steps).toBe(SCIENCE_STEPS);
		expect(state.source).toBe(SCIENCE_STARTER_SOURCE);
		controller.destroy();
	});

	it('echoes typed answers in a visible game run, and never for science', async () => {
		const game = studio({
			pblId: 'gamejam',
			runCheck: async () => ({ passed: false, message: 'no' })
		});
		await game.controller.join();
		game.controller.setStdin('my excuse\n\n');
		await game.controller.run();
		expect(game.host.run).toHaveBeenCalledWith(
			GAMEJAM_STARTER_SOURCE,
			expect.objectContaining({
				stdin: ['my excuse', ''],
				echo: true,
				interactive: true
			})
		);
		const science = studio({ runCheck: async () => ({ passed: false, message: 'no' }) });
		await science.controller.join();
		await science.controller.run();
		expect(science.host.run).toHaveBeenCalledWith(
			SCIENCE_STARTER_SOURCE,
			expect.objectContaining({ stdin: [], interactive: true })
		);
	});

	it('shows a typed answer right after its prompt in the Output panel', async () => {
		if (!pythonAvailable) return;
		const { controller } = studio({ pblId: 'gamejam' });
		await controller.join();
		controller.setSource(REF[2]);
		controller.setStdin('my cat ate my alarm');
		await controller.run();
		expect(controller.getState().output).toContain(
			'Enter your goofy excuse: my cat ate my alarm\n'
		);
	});

	it.skipIf(!pythonAvailable)(
		'plays through all twelve steps, carrying the whole program into each next step',
		async () => {
			const { controller } = studio({ pblId: 'gamejam' });
			await controller.join();
			for (let step = 0; step < 12; step += 1) {
				expect(controller.getState().viewStep).toBe(step);
				if (step > 0) {
					// The step opens with everything the team wrote so far.
					expect(controller.getState().source).toBe(REF[step - 1]);
				}
				controller.setSource(REF[step]);
				controller.setStdin(PROGRAM_INPUT);
				await controller.run();
				const state = controller.getState();
				expect(state.lastCheck, `step ${step}`).toMatchObject({ step, passed: true });
				expect(state.pythonError).toBe('');
				expect(state.unlockedStep).toBe(Math.min(11, step + 1));
				if (step < 11) {
					controller.selectStep(step + 1);
					// A real person types after the step switch settles; the controller ignores stale editor writes until then.
					await new Promise((resolve) => setTimeout(resolve, 0));
				}
			}
			const done = controller.getState();
			expect(done.nextAction).toBe('');
			expect(done.source).toBe(REF[11]);
			expect(done.unlockedStep).toBe(11);
			controller.destroy();
		},
		120000
	);

	it('opens an already-unlocked next step with the code from the step before', async () => {
		// Executive owners get every step unlocked up front, so no pass ever "newly unlocks" a step.
		const { controller } = studio({ pblId: 'gamejam', unlockedStep: 11 });
		await controller.join();
		controller.selectStep(0);
		await new Promise((resolve) => setTimeout(resolve, 0));
		controller.setSource(REF[0]);
		controller.selectStep(1);
		expect(controller.getState().viewStep).toBe(1);
		expect(controller.getState().source).toBe(REF[0]);
		controller.destroy();
	});

	it('carries code edited after a pass into the next step', async () => {
		const { controller } = studio({
			pblId: 'gamejam',
			runCheck: async () => ({ passed: true, message: 'ok' })
		});
		await controller.join();
		controller.setSource(REF[0]);
		await controller.run();
		expect(controller.getState().unlockedStep).toBe(1);
		await new Promise((resolve) => setTimeout(resolve, 0));
		controller.setSource(`${REF[0]}print("tweak")\n`);
		controller.selectStep(1);
		expect(controller.getState().source).toBe(`${REF[0]}print("tweak")\n`);
		controller.destroy();
	});

	it('keeps what the team already wrote in the next step when hopping back and forward', async () => {
		const { controller } = studio({ pblId: 'gamejam', unlockedStep: 11 });
		await controller.join();
		controller.selectStep(0);
		await new Promise((resolve) => setTimeout(resolve, 0));
		controller.setSource(REF[0]);
		controller.selectStep(1);
		await new Promise((resolve) => setTimeout(resolve, 0));
		controller.setSource(REF[1]);
		controller.selectStep(0);
		await new Promise((resolve) => setTimeout(resolve, 0));
		controller.selectStep(1);
		expect(controller.getState().source).toBe(REF[1]);
		controller.destroy();
	});

	it.skipIf(!pythonAvailable)(
		'does not unlock the next step for code that misses the step',
		async () => {
			const { controller } = studio({ pblId: 'gamejam' });
			await controller.join();
			controller.setSource('print("hello")\n');
			await controller.run();
			expect(controller.getState().lastCheck).toMatchObject({ step: 0, passed: false });
			expect(controller.getState().unlockedStep).toBe(0);
			expect(controller.getState().nextAction).toMatch(/header/i);
			controller.selectStep(1);
			expect(controller.getState().viewStep).toBe(0);
		}
	);
});
