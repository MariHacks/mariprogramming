import { createPythonHost } from './python-host.js';
import { runScienceCheck } from './run-checks.js';
import { SCIENCE_STARTER_SOURCE, SCIENCE_STEPS, getScienceStep } from './science-workshop.js';
import { createRoomSync } from './sync-client.js';
import {
	canOpenStep,
	nextUnlockedStep,
	studioNextAction,
	withOpenedHint
} from './workshop-session.js';

/**
 * @param {{
 *   code: string,
 *   createHost?: typeof createPythonHost,
 *   createSync?: typeof createRoomSync,
 *   runCheck?: typeof runScienceCheck,
 *   now?: () => string
 * }} options
 */
export function createWorkshopController(options) {
	const now = options.now ?? (() => new Date().toISOString());
	const host = (options.createHost ?? createPythonHost)();
	/** @type {(state: any) => void} */
	function idle() {}
	let emit = idle;
	/** @type {any} */
	let room = {
		code: options.code,
		teamName: '',
		source: SCIENCE_STARTER_SOURCE,
		currentStep: 0,
		unlockedStep: 0,
		openedHints: {},
		lastCheck: null,
		memberCount: 1,
		version: 0,
		stepEnteredAt: now(),
		joinable: true
	};
	let stdinText = '';
	let output = '';
	let files = /** @type {Record<string, string>} */ ({});
	let running = false;
	let pythonError = '';
	let roomError = '';
	let readOnly = false;
	let blocked = '';
	let isDriver = true;

	function snapshot() {
		return {
			...room,
			step: getScienceStep(room.currentStep) ?? SCIENCE_STEPS[0],
			steps: SCIENCE_STEPS,
			stdinText,
			output,
			files,
			running,
			pythonError,
			roomError,
			readOnly,
			blocked,
			isDriver,
			nextAction: studioNextAction({
				blocked,
				lastCheck: room.lastCheck,
				currentStep: room.currentStep
			})
		};
	}

	function publish() {
		emit(snapshot());
	}

	const sync = (options.createSync ?? createRoomSync)({
		code: options.code,
		onState: (next) => {
			room = { ...room, ...next };
			if (typeof next.isDriver === 'boolean') isDriver = next.isDriver;
			readOnly = blocked === 'full' || !isDriver;
			publish();
		},
		onError: (message) => {
			roomError = message;
			if (message.includes('full')) {
				blocked = 'full';
				readOnly = true;
				isDriver = false;
			}
			publish();
		}
	});

	async function join() {
		const joined = await sync.join();
		if (!joined) {
			readOnly = blocked === 'full' || !isDriver;
			if (blocked === 'full') await sync.pull();
			publish();
			return snapshot();
		}
		room = { ...room, ...joined };
		if (typeof joined.isDriver === 'boolean') isDriver = joined.isDriver;
		readOnly = blocked === 'full' || !isDriver;
		sync.start();
		publish();
		return snapshot();
	}

	/** @param {string} source */
	function setSource(source) {
		if (blocked || !isDriver) return;
		room = { ...room, source };
		sync.update({ source });
		publish();
	}

	function takeDriver() {
		if (blocked) return;
		sync.update({ takeDriver: true });
		void sync.flush();
		publish();
	}

	/** @param {string} value */
	function setStdin(value) {
		stdinText = value;
		publish();
	}

	/** @param {number} stepId */
	function selectStep(stepId) {
		if (blocked) return;
		if (!canOpenStep(stepId, room.unlockedStep)) return;
		room = { ...room, currentStep: stepId };
		sync.update({ currentStep: stepId });
		void sync.flush();
		publish();
	}

	/** @param {number} level */
	function openHint(level) {
		if (blocked) return;
		const openedHints = withOpenedHint(room.openedHints ?? {}, room.currentStep, level);
		room = { ...room, openedHints };
		sync.update({ openedHints });
		void sync.flush();
		publish();
	}

	async function run() {
		if (blocked) return snapshot();
		running = true;
		pythonError = '';
		publish();
		const stdin = stdinText
			.split('\n')
			.map((line) => line.replace(/\r$/u, ''))
			.filter((line, index, lines) => line.length > 0 || index < lines.length - 1);
		const result = await host.run(room.source, { stdin });
		output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
		files = result.files ?? {};
		if (result.error) pythonError = result.error;
		running = false;
		publish();
		if (!result.error) await checkCurrent();
		await sync.flush();
		return snapshot();
	}

	async function checkCurrent() {
		const result = await (options.runCheck ?? runScienceCheck)(host, room.currentStep, room.source);
		const unlockedStep = nextUnlockedStep(room.unlockedStep, result.passed);
		const lastCheck = {
			step: room.currentStep,
			passed: result.passed,
			message: result.message,
			at: now()
		};
		room = { ...room, unlockedStep, lastCheck };
		sync.update({ unlockedStep, lastCheck });
		publish();
		return result;
	}

	function destroy() {
		sync.stop();
		host.destroy();
	}

	return {
		join,
		setSource,
		takeDriver,
		setStdin,
		selectStep,
		openHint,
		run,
		destroy,
		getState: snapshot,
		/**
		 * @param {(state: any) => void} listener
		 */
		subscribe(listener) {
			emit = listener;
			listener(snapshot());
			return () => {
				emit = idle;
			};
		}
	};
}
