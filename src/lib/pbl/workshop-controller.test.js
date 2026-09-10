import { describe, expect, it, vi } from 'vitest';
import { createWorkshopController } from './workshop-controller.js';

function harness(overrides = {}) {
	const host = {
		run: vi.fn(async () => ({
			stdout: 'Lab table 3\n',
			stderr: '',
			error: null,
			globals: {},
			files: {},
			inputCount: 0
		})),
		destroy: vi.fn()
	};
	/** @type {any} */
	let onState = () => {};
	const sync = {
		join: vi.fn(async () => ({
			code: 'AB23JK',
			teamName: 'Lab table 3',
			source: 'print("Lab table 3")',
			currentStep: 0,
			unlockedStep: 0,
			openedHints: {},
			memberCount: 2,
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
		now: () => '2026-09-08T15:00:00.000Z',
		createHost: () => host,
		createSync: (options) => {
			onState = options.onState;
			options.onError?.('keep going');
			return sync;
		},
		runCheck: async () => ({ passed: true, message: 'Printed a custom message. Starter text is gone.' }),
		...overrides
	});
	return { controller, host, sync, onState: () => onState };
}

describe('workshop controller', () => {
	it('joins a room, runs Python, and unlocks the next step after a passing check', async () => {
		const { controller, host, sync } = harness();
		const states = [];
		const stop = controller.subscribe((state) => states.push(state));
		await controller.join();
		expect(sync.join).toHaveBeenCalled();
		expect(sync.start).toHaveBeenCalled();
		controller.setStdin('20\n');
		controller.openHint(1);
		expect(sync.flush).toHaveBeenCalled();
		await controller.run();
		expect(sync.flush).toHaveBeenCalledTimes(2);
		expect(host.run).toHaveBeenCalled();
		expect(controller.getState().unlockedStep).toBe(1);
		expect(controller.getState().lastCheck?.passed).toBe(true);
		controller.selectStep(1);
		expect(controller.getState().currentStep).toBe(1);
		controller.selectStep(8);
		expect(controller.getState().currentStep).toBe(1);
		controller.destroy();
		stop();
		expect(sync.stop).toHaveBeenCalled();
	});

	it('keeps the page usable when Python returns an error and when the team is full', async () => {
		const { controller, host, onState, sync } = harness();
		host.run.mockResolvedValueOnce({
			stdout: '',
			stderr: 'boom',
			error: 'boom',
			globals: {},
			files: {},
			inputCount: 0
		});
		await controller.run();
		expect(controller.getState().pythonError).toBe('boom');
		expect(controller.getState().unlockedStep).toBe(0);
		controller.setSource('print("team")');
		expect(sync.update).toHaveBeenCalledWith(
			expect.objectContaining({
				source: 'print("team")',
				editingStep: 0,
				stepSources: expect.objectContaining({ '0': 'print("team")' })
			})
		);
		onState()({ source: 'print(1)', currentStep: 99, unlockedStep: 0, openedHints: null });
		expect(controller.getState().step.title).toBe('Get something running');
		controller.openHint(1);
		expect(controller.getState().source).toBe('print(1)');
		/** @type {any} */
		let fullSync;
		const full = harness({
			createSync: (options) => {
				options.onError?.('This team is full (10 people).');
				fullSync = {
					join: vi.fn(async () => null),
					start: vi.fn(),
					stop: vi.fn(),
					update: vi.fn(),
					flush: vi.fn(async () => {}),
					pull: vi.fn(async () => {})
				};
				return fullSync;
			}
		});
		await full.controller.join();
		expect(full.controller.getState().blocked).toBe('full');
		expect(fullSync.pull).toHaveBeenCalled();
		expect(full.controller.getState().readOnly).toBe(true);
		full.controller.setSource('nope');
		expect(full.controller.getState().source).not.toBe('nope');
		expect(fullSync.start).not.toHaveBeenCalled();
		full.controller.destroy();
	});


	it('keeps viewStep local and copies code forward on unlock', async () => {
		const { controller, sync } = harness({
			runCheck: async () => ({ passed: true, message: 'ok' })
		});
		await controller.join();
		sync.update.mockClear();
		controller.selectStep(0);
		expect(controller.getState().viewStep).toBe(0);
		await controller.run();
		expect(controller.getState().unlockedStep).toBe(1);
		expect(controller.getState().stepSources['1']).toBeTruthy();
		sync.update.mockClear();
		controller.selectStep(1);
		expect(controller.getState().currentStep).toBe(1);
		expect(controller.getState().viewStep).toBe(1);
		const payloads = sync.update.mock.calls.map((call) => call[0]);
		expect(payloads.some((p) => 'currentStep' in p)).toBe(false);
		expect(payloads.at(-1)).toMatchObject({
			editingStep: 1,
			replaceEditor: true
		});
		controller.destroy();
	});
	it('pushes source from every joined member', async () => {
		/** @type {any} */
		let inner;
		const teammate = harness({
			createSync: () => {
				inner = {
					join: vi.fn(async () => ({
						code: 'AB23JK',
						source: 'print("shared")',
						currentStep: 0,
						unlockedStep: 0,
						openedHints: {},
						memberCount: 2,
						version: 1,
						yjsState: '',
						awarenessState: ''
					})),
					start: vi.fn(),
					stop: vi.fn(),
					update: vi.fn(),
					flush: vi.fn(async () => {})
				};
				return inner;
			}
		});
		await teammate.controller.join();
		teammate.controller.setSource('print("from B")');
		expect(inner.update).toHaveBeenCalledWith(
			expect.objectContaining({
				source: 'print("from B")',
				editingStep: 0,
				stepSources: expect.objectContaining({ '0': 'print("from B")' })
			})
		);
		teammate.controller.setCollab({});
		expect(inner.update).toHaveBeenCalledWith(
			expect.objectContaining({
				source: 'print("from B")',
				editingStep: 0
			})
		);
		teammate.controller.setCollab({
			source: 'print("from B")\nprint("from A")',
			yjsState: 'abc=',
			awarenessState: 'def='
		});
		expect(inner.update).toHaveBeenCalledWith(
			expect.objectContaining({
				source: 'print("from B")\nprint("from A")',
				yjsState: 'abc=',
				awarenessState: 'def=',
				editingStep: 0,
				stepSources: expect.objectContaining({ '0': 'print("from B")\nprint("from A")' }),
				stepYjs: expect.objectContaining({ '0': 'abc=' })
			})
		);
		teammate.controller.destroy();
	});

	it('can be constructed with default factories and missing output fields', async () => {
		const controller = createWorkshopController({ code: 'AB23JK' });
		expect(controller.getState().code).toBe('AB23JK');
		controller.destroy();
		const host = {
			run: vi.fn(async () => ({
				stdout: undefined,
				stderr: undefined,
				error: null,
				globals: {},
				files: undefined,
				inputCount: 0
			})),
			destroy: vi.fn()
		};
		const inner = createWorkshopController({
			code: 'AB23JK',
			createHost: () => host,
			createSync: () => ({
				join: vi.fn(async () => null),
				start: vi.fn(),
				stop: vi.fn(),
				update: vi.fn(),
				flush: vi.fn(async () => {}),
				pull: vi.fn(async () => {})
			})
		});
		await inner.run();
		inner.destroy();
	});
});

	it('fail then pass updates the status message to Accepted', async () => {
		let tick = 0;
		const stamps = [
			'2026-09-08T15:00:00.000Z',
			'2026-09-08T15:00:01.000Z',
			'2026-09-08T15:00:02.000Z',
			'2026-09-08T15:00:03.000Z',
			'2026-09-08T15:00:04.000Z'
		];
		const outcomes = [
			{ passed: false, message: 'Still printing Experiment loaded.' },
			{ passed: true, message: 'Printed a custom message. Starter text is gone.' }
		];
		const { controller, sync } = harness({
			now: () => stamps[Math.min(tick++, stamps.length - 1)],
			runCheck: async () => outcomes.shift()
		});
		await controller.join();
		await controller.run();
		expect(controller.getState().lastCheck).toMatchObject({
			passed: false,
			message: 'Still printing Experiment loaded.'
		});
		expect(controller.getState().nextAction).toBe('Still printing Experiment loaded.');
		controller.setSource('print("Lab table 3")');
		await controller.run();
		expect(controller.getState().lastCheck).toMatchObject({
			passed: true,
			message: 'Printed a custom message. Starter text is gone.'
		});
		expect(controller.getState().nextAction).toBe('Open the next step.');
		expect(sync.update.mock.calls.some((call) => call[0].lastCheck === null)).toBe(true);
		controller.destroy();
	});

	it('fail then a different fail updates the status message text', async () => {
		let tick = 0;
		const stamps = [
			'2026-09-08T15:10:00.000Z',
			'2026-09-08T15:10:01.000Z',
			'2026-09-08T15:10:02.000Z',
			'2026-09-08T15:10:03.000Z',
			'2026-09-08T15:10:04.000Z'
		];
		const outcomes = [
			{ passed: false, message: 'Still printing Experiment loaded.' },
			{ passed: false, message: 'Print a custom message for this step.' }
		];
		const { controller } = harness({
			now: () => stamps[Math.min(tick++, stamps.length - 1)],
			runCheck: async () => outcomes.shift()
		});
		await controller.join();
		await controller.run();
		expect(controller.getState().lastCheck?.message).toBe('Still printing Experiment loaded.');
		await controller.run();
		expect(controller.getState().lastCheck).toMatchObject({
			passed: false,
			message: 'Print a custom message for this step.'
		});
		expect(controller.getState().nextAction).toBe('Print a custom message for this step.');
		controller.destroy();
	});

	it('grades the source snapshot from Run click even if onState changes room mid-await', async () => {
		let tick = 0;
		const stamps = [
			'2026-09-08T15:20:00.000Z',
			'2026-09-08T15:20:01.000Z',
			'2026-09-08T15:20:02.000Z',
			'2026-09-08T15:20:03.000Z'
		];
		/** @type {(source: string) => void} */
		let resume;
		const gate = new Promise((resolve) => {
			resume = resolve;
		});
		const seen = [];
		const { controller, host, onState } = harness({
			now: () => stamps[Math.min(tick++, stamps.length - 1)],
			runCheck: async (_host, stepId, source) => {
				seen.push({ stepId, source });
				return { passed: true, message: 'Printed a custom message. Starter text is gone.' };
			}
		});
		host.run.mockImplementationOnce(async (source) => {
			await gate;
			return {
				stdout: 'ok\n',
				stderr: '',
				error: null,
				globals: {},
				files: {},
				inputCount: 0
			};
		});
		await controller.join();
		controller.setSource('print("snapshot")');
		const running = controller.run();
		onState()({
			source: 'print("poll-overwrite")',
			lastCheck: {
				step: 0,
				passed: false,
				message: 'old fail',
				at: '2026-09-08T15:19:00.000Z'
			}
		});
		expect(controller.getState().lastCheck).toBeNull();
		resume();
		await running;
		expect(host.run).toHaveBeenCalledWith('print("snapshot")', expect.any(Object));
		expect(seen[0]).toEqual({ stepId: 0, source: 'print("snapshot")' });
		expect(controller.getState().lastCheck?.passed).toBe(true);
		controller.destroy();
	});

	it('mid-run onState with an old lastCheck cannot stick after check completes', async () => {
		let tick = 0;
		const stamps = [
			'2026-09-08T15:30:00.000Z',
			'2026-09-08T15:30:01.000Z',
			'2026-09-08T15:30:02.000Z',
			'2026-09-08T15:30:03.000Z',
			'2026-09-08T15:30:04.000Z'
		];
		/** @type {() => void} */
		let resume;
		const gate = new Promise((resolve) => {
			resume = resolve;
		});
		const { controller, host, onState } = harness({
			now: () => stamps[Math.min(tick++, stamps.length - 1)],
			runCheck: async () => ({
				passed: true,
				message: 'Printed a custom message. Starter text is gone.'
			})
		});
		host.run.mockImplementation(async () => {
			await gate;
			return {
				stdout: 'ok\n',
				stderr: '',
				error: null,
				globals: {},
				files: {},
				inputCount: 0
			};
		});
		await controller.join();
		// Seed an old fail through a completed run path first would need another gate;
		// inject via onState before the re-run.
		onState()({
			lastCheck: {
				step: 0,
				passed: false,
				message: 'old fail',
				at: '2026-09-08T15:29:00.000Z'
			}
		});
		expect(controller.getState().lastCheck?.message).toBe('old fail');
		const running = controller.run();
		expect(controller.getState().lastCheck).toBeNull();
		onState()({
			lastCheck: {
				step: 0,
				passed: false,
				message: 'old fail',
				at: '2026-09-08T15:29:00.000Z'
			},
			source: 'print("still old")'
		});
		expect(controller.getState().lastCheck).toBeNull();
		resume();
		await running;
		expect(controller.getState().lastCheck).toMatchObject({
			passed: true,
			message: 'Printed a custom message. Starter text is gone.'
		});
		onState()({
			lastCheck: {
				step: 0,
				passed: false,
				message: 'old fail',
				at: '2026-09-08T15:29:00.000Z'
			}
		});
		expect(controller.getState().lastCheck).toMatchObject({
			passed: true,
			message: 'Printed a custom message. Starter text is gone.'
		});
		controller.destroy();
	});
