import { createPythonHost } from './python-host.js';
import { isNewerLastCheck } from './room-state.js';
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
		joinable: true,
		yjsState: '',
		awarenessState: ''
	};
	let stdinText = '';
	let output = '';
	let files = /** @type {Record<string, string>} */ ({});
	let running = false;
	let pythonError = '';
	let roomError = '';
	let readOnly = false;
	let blocked = '';
	/** @type {string | null} */
	let runClearedAt = null;

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
			isDriver: blocked !== 'full',
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
			const merged = { ...room, ...next };
			const incomingCheck = next?.lastCheck;
			const keepLocalCheck = runClearedAt
				? !isNewerLastCheck(incomingCheck, { at: runClearedAt })
				: !isNewerLastCheck(incomingCheck, room.lastCheck);
			if (keepLocalCheck) {
				merged.lastCheck = room.lastCheck;
				const localUnlocked = Number(room.unlockedStep);
				const nextUnlocked = Number(next?.unlockedStep);
				if (
					Number.isFinite(localUnlocked) &&
					(!Number.isFinite(nextUnlocked) || localUnlocked > nextUnlocked)
				) {
					merged.unlockedStep = localUnlocked;
				}
			}
			room = merged;
			readOnly = blocked === 'full';
			publish();
		},
		onError: (message) => {
			roomError = message;
			if (message.includes('full')) {
				blocked = 'full';
				readOnly = true;
			}
			publish();
		}
	});

	async function join() {
		const joined = await sync.join();
		if (!joined) {
			readOnly = blocked === 'full';
			if (blocked === 'full') await sync.pull();
			publish();
			return snapshot();
		}
		room = { ...room, ...joined };
		readOnly = blocked === 'full';
		sync.start();
		publish();
		return snapshot();
	}

	/** @param {string} source */
	function setSource(source) {
		if (blocked) return;
		setCollab({ source, yjsState: room.yjsState, awarenessState: room.awarenessState });
	}

	/** @param {{ source?: string, yjsState?: string, awarenessState?: string }} payload */
	function setCollab(payload) {
		if (blocked) return;
		room = {
			...room,
			source: payload.source ?? room.source,
			yjsState: payload.yjsState ?? room.yjsState,
			awarenessState: payload.awarenessState ?? room.awarenessState
		};
		sync.update({
			source: room.source,
			yjsState: room.yjsState,
			awarenessState: room.awarenessState
		});
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
		const sourceSnapshot = room.source;
		const stepSnapshot = room.currentStep;
		running = true;
		pythonError = '';
		runClearedAt = now();
		if (!room.lastCheck || room.lastCheck.step === stepSnapshot) {
			room = { ...room, lastCheck: null };
			sync.update({ lastCheck: null });
		}
		publish();
		const stdin = stdinText
			.split('\n')
			.map((line) => line.replace(/\r$/u, ''))
			.filter((line, index, lines) => line.length > 0 || index < lines.length - 1);
		const result = await host.run(sourceSnapshot, { stdin });
		output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
		files = result.files ?? {};
		if (result.error) pythonError = result.error;
		running = false;
		publish();
		if (!result.error) await checkCurrent(sourceSnapshot, stepSnapshot);
		else runClearedAt = null;
		await sync.flush();
		return snapshot();
	}

	/**
	 * @param {string} [source]
	 * @param {number} [stepId]
	 */
	async function checkCurrent(source = room.source, stepId = room.currentStep) {
		const result = await (options.runCheck ?? runScienceCheck)(host, stepId, source);
		const unlockedStep = nextUnlockedStep(room.unlockedStep, result.passed);
		const lastCheck = {
			step: stepId,
			passed: result.passed,
			message: result.message,
			at: now()
		};
		room = { ...room, unlockedStep, lastCheck };
		runClearedAt = null;
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
		setCollab,
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
