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
			isDriver: true
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
		runCheck: async () => ({ passed: true, message: 'The program printed your message.' }),
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
		expect(sync.update).toHaveBeenCalledWith({ source: 'print("team")' });
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

	it('does not push source from a follower until they take the keyboard', async () => {
		/** @type {any} */
		let inner;
		const follower = harness({
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
						isDriver: false
					})),
					start: vi.fn(),
					stop: vi.fn(),
					update: vi.fn(),
					flush: vi.fn(async () => {})
				};
				return inner;
			}
		});
		await follower.controller.join();
		follower.controller.setSource('stolen');
		expect(inner.update).not.toHaveBeenCalled();
		expect(follower.controller.getState().source).toBe('print("shared")');
		follower.controller.takeDriver();
		expect(inner.update).toHaveBeenCalledWith({ takeDriver: true });
		follower.controller.destroy();
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
