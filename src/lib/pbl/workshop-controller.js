import { createPythonHost } from './python-host.js';
import {
	isNewerLastCheck,
	normalizeStepSources,
	normalizeStepYjs
} from './room-state.js';
import { runScienceCheck } from './run-checks.js';
import { SCIENCE_STARTER_SOURCE, SCIENCE_STEPS, getScienceStep } from './science-workshop.js';
import { createRoomSync } from './sync-client.js';
import {
	canOpenStep,
	nextUnlockedStep,
	studioNextAction,
	withOpenedHint
} from './workshop-session.js';
import { encodeSourceAsYjs } from './yjs-collab.js';

/**
 * @param {{
 *   code: string,
 *   createHost?: typeof createPythonHost,
 *   createSync?: typeof createRoomSync,
 *   runCheck?: typeof runScienceCheck,
 *   now?: () => string,
 *   fetch?: typeof fetch
 * }} options
 */
export function createWorkshopController(options) {
	const now = options.now ?? (() => new Date().toISOString());
	const fetchImpl = options.fetch ?? fetch;
	const host = (options.createHost ?? createPythonHost)();
	/** @type {(state: any) => void} */
	function idle() {}
	let emit = idle;
	/** Local navigation only — never synced as shared currentStep. */
	let viewStep = 0;
	/** @type {any} */
	let room = {
		code: options.code,
		teamName: '',
		source: SCIENCE_STARTER_SOURCE,
		unlockedStep: 0,
		openedHints: {},
		lastCheck: null,
		memberCount: 1,
		version: 0,
		stepEnteredAt: now(),
		joinable: true,
		yjsState: '',
		awarenessState: '',
		stepSources: { '0': SCIENCE_STARTER_SOURCE },
		stepYjs: {},
		editingStep: 0
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
			viewStep,
			currentStep: viewStep,
			step: getScienceStep(viewStep) ?? SCIENCE_STEPS[0],
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
				currentStep: viewStep
			})
		};
	}

	function publish() {
		emit(snapshot());
	}

	function ensureMaps() {
		room.stepSources = normalizeStepSources(room.stepSources);
		room.stepYjs = normalizeStepYjs(room.stepYjs);
	}

	/** Persist the editor into the local step slot for viewStep. */
	function persistViewStep() {
		ensureMaps();
		const key = String(viewStep);
		room.stepSources = { ...room.stepSources, [key]: String(room.source ?? '') };
		room.stepYjs = { ...room.stepYjs, [key]: String(room.yjsState ?? '') };
	}

	/**
	 * Load editor buffers from a step slot (source + optional yjs).
	 * @param {number} stepId
	 */
	function loadViewStep(stepId) {
		ensureMaps();
		const key = String(stepId);
		const storedSource = room.stepSources[key];
		const storedYjs = room.stepYjs[key] ?? '';
		let source =
			typeof storedSource === 'string'
				? storedSource
				: stepId === 0
					? SCIENCE_STARTER_SOURCE
					: '';
		let yjsState = storedYjs;
		if (!yjsState && source) {
			try {
				yjsState = encodeSourceAsYjs(source);
			} catch {
				yjsState = '';
			}
		}
		room = {
			...room,
			source,
			yjsState,
			editingStep: stepId
		};
	}

	/**
	 * @param {Record<string, unknown> | null | undefined} next
	 */
	function applyRemoteRoom(next) {
		if (!next || typeof next !== 'object') return;
		const prevSource = room.source;
		const prevYjs = room.yjsState;
		const prevAwareness = room.awarenessState;
		const incomingCheck = next.lastCheck;
		const keepLocalCheck = runClearedAt
			? !isNewerLastCheck(/** @type {any} */ (incomingCheck), { at: runClearedAt })
			: !isNewerLastCheck(/** @type {any} */ (incomingCheck), room.lastCheck);

		const merged = { ...room, ...next };
		merged.stepSources = normalizeStepSources({
			...normalizeStepSources(room.stepSources),
			...normalizeStepSources(next.stepSources)
		});
		merged.stepYjs = normalizeStepYjs({
			...normalizeStepYjs(room.stepYjs),
			...normalizeStepYjs(next.stepYjs)
		});

		if (keepLocalCheck) {
			merged.lastCheck = room.lastCheck;
			const localUnlocked = Number(room.unlockedStep);
			const nextUnlocked = Number(next.unlockedStep);
			if (
				Number.isFinite(localUnlocked) &&
				(!Number.isFinite(nextUnlocked) || localUnlocked > nextUnlocked)
			) {
				merged.unlockedStep = localUnlocked;
			}
		}

		const remoteEditing = Number(next.editingStep);
		const key = String(viewStep);
		const remoteOnOtherStep = Number.isInteger(remoteEditing) && remoteEditing !== viewStep;

		if (remoteOnOtherStep) {
			// Teammate is on another step — keep our editor, take their maps.
			merged.source = prevSource;
			merged.yjsState = prevYjs;
			merged.awarenessState = prevAwareness;
			merged.stepSources = { ...merged.stepSources, [key]: prevSource };
			if (prevYjs) merged.stepYjs = { ...merged.stepYjs, [key]: prevYjs };
		} else {
			// Same step (or legacy payload without editingStep): apply live editor fields.
			if (typeof next.source === 'string') {
				merged.source = next.source;
				merged.stepSources = { ...merged.stepSources, [key]: next.source };
			} else if (typeof merged.stepSources[key] === 'string') {
				merged.source = merged.stepSources[key];
			}
			if (typeof next.yjsState === 'string') {
				merged.yjsState = next.yjsState;
				if (next.yjsState) {
					merged.stepYjs = { ...merged.stepYjs, [key]: next.yjsState };
				}
			} else if (typeof merged.stepYjs[key] === 'string' && merged.stepYjs[key]) {
				merged.yjsState = merged.stepYjs[key];
			}
		}

		// Never adopt remote currentStep as local navigation.
		delete merged.currentStep;
		merged.editingStep = viewStep;
		room = merged;
		readOnly = blocked === 'full';
		publish();
	}

	const sync = (options.createSync ?? createRoomSync)({
		code: options.code,
		onState: (next) => {
			applyRemoteRoom(next);
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
		room = {
			...room,
			...joined,
			stepSources: normalizeStepSources({
				'0': SCIENCE_STARTER_SOURCE,
				...normalizeStepSources(joined.stepSources),
				...(joined.source && !normalizeStepSources(joined.stepSources)['0']
					? { '0': joined.source }
					: {})
			}),
			stepYjs: normalizeStepYjs(joined.stepYjs)
		};
		const unlocked = Number(joined.unlockedStep);
		viewStep = Number.isInteger(unlocked) && unlocked >= 0 ? Math.min(unlocked, SCIENCE_STEPS.length - 1) : 0;
		// Start on the latest unlocked step with that step's saved code when present.
		if (!room.stepSources['0'] && room.source) {
			room.stepSources = { ...room.stepSources, '0': room.source };
		}
		loadViewStep(viewStep);
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
		ensureMaps();
		const key = String(viewStep);
		const source = payload.source ?? room.source;
		const yjsState = payload.yjsState ?? room.yjsState;
		const awarenessState = payload.awarenessState ?? room.awarenessState;
		room = {
			...room,
			source,
			yjsState,
			awarenessState,
			stepSources: { ...room.stepSources, [key]: source },
			stepYjs: { ...room.stepYjs, [key]: yjsState },
			editingStep: viewStep
		};
		sync.update({
			source: room.source,
			yjsState: room.yjsState,
			awarenessState: room.awarenessState,
			stepSources: room.stepSources,
			stepYjs: room.stepYjs,
			editingStep: viewStep
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
		if (stepId === viewStep) return;
		persistViewStep();
		viewStep = stepId;
		loadViewStep(stepId);
		sync.update({
			stepSources: room.stepSources,
			stepYjs: room.stepYjs,
			source: room.source,
			yjsState: room.yjsState,
			editingStep: viewStep,
			replaceEditor: true
		});
		void sync.flush();
		publish();
	}

	/** @param {number} level */
	function openHint(level) {
		if (blocked) return;
		const openedHints = withOpenedHint(room.openedHints ?? {}, viewStep, level);
		room = { ...room, openedHints };
		sync.update({ openedHints });
		void sync.flush();
		publish();
	}

	async function run() {
		if (blocked) return snapshot();
		// Normalize NBSP (U+00A0) from paste/docs — Python rejects it as invalid.
		const sourceSnapshot = String(room.source ?? '').replace(/\u00a0/gu, ' ');
		if (sourceSnapshot !== room.source) {
			setCollab({
				source: sourceSnapshot,
				yjsState: room.yjsState,
				awarenessState: room.awarenessState
			});
		}
		const stepSnapshot = viewStep;
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
			.map((line) => line.replace(/\r$/u, '').replace(/\u00a0/gu, ' '))
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
	 * @param {string} source
	 * @param {number} step
	 * @param {boolean} passed
	 * @param {string} message
	 */
	async function recordSubmission(source, step, passed, message) {
		try {
			await fetchImpl(`/api/pbl/rooms/${options.code}/submissions`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ step, source, passed, message })
			});
		} catch {
			/* best-effort history for staff */
		}
	}

	/**
	 * @param {string} [source]
	 * @param {number} [stepId]
	 */
	async function checkCurrent(source = room.source, stepId = viewStep) {
		const result = await (options.runCheck ?? runScienceCheck)(host, stepId, source);
		const previousUnlocked = Number(room.unlockedStep) || 0;
		const unlockedStep = nextUnlockedStep(previousUnlocked, result.passed);
		const lastCheck = {
			step: stepId,
			passed: result.passed,
			message: result.message,
			at: now()
		};
		ensureMaps();
		const stepKey = String(stepId);
		let stepSources = {
			...room.stepSources,
			[stepKey]: String(source ?? '')
		};
		let stepYjs = { ...room.stepYjs };
		try {
			stepYjs[stepKey] = encodeSourceAsYjs(String(source ?? ''));
		} catch {
			stepYjs[stepKey] = room.yjsState ?? '';
		}

		// Unlocking copies the passed step's code into the newly unlocked step.
		if (result.passed && unlockedStep > previousUnlocked) {
			const nextKey = String(unlockedStep);
			stepSources = { ...stepSources, [nextKey]: String(source ?? '') };
			stepYjs = { ...stepYjs, [nextKey]: stepYjs[stepKey] };
		}

		room = {
			...room,
			unlockedStep,
			lastCheck,
			source: String(source ?? room.source),
			stepSources,
			stepYjs,
			yjsState: stepYjs[String(viewStep)] ?? room.yjsState
		};
		runClearedAt = null;
		sync.update({
			unlockedStep,
			lastCheck,
			stepSources,
			stepYjs,
			source: room.source,
			yjsState: room.yjsState,
			editingStep: viewStep
		});
		void recordSubmission(String(source ?? ''), stepId, result.passed, result.message);
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
