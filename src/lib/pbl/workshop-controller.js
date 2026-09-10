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
	/** Bumps when the editor must replace (not merge) its document. */
	let editorEpoch = 0;
	/**
	 * After selectStep, ignore poll live source/yjs until our replace flush lands
	 * (server still holds the previous step's live buffer briefly).
	 */
	let replacePending = false;
	/** @type {any} */
	let room = {
		code: options.code,
		teamName: '',
		source: SCIENCE_STARTER_SOURCE,
		unlockedStep: 0,
		openedHints: {},
		lastCheck: null,
		lastRun: null,
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
			editorEpoch,
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
			isDriver: Boolean(room.isDriver),
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

	/**
	 * Adopt a shared lastRun into local terminal fields (output / error / running).
	 * @param {{ output?: string, error?: string, step?: number, at?: string, running?: boolean } | null | undefined} lastRun
	 */
	function applySharedLastRun(lastRun) {
		if (!lastRun || typeof lastRun !== 'object') {
			room = { ...room, lastRun: null };
			return;
		}
		room = { ...room, lastRun };
		output = typeof lastRun.output === 'string' ? lastRun.output : '';
		pythonError = typeof lastRun.error === 'string' ? lastRun.error : '';
		running = Boolean(lastRun.running);
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

		const incomingRun = next.lastRun;
		const keepLocalRun = !isNewerLastCheck(
			/** @type {any} */ (incomingRun),
			/** @type {any} */ (room.lastRun)
		);
		if (keepLocalRun) {
			merged.lastRun = room.lastRun;
		} else if (incomingRun && typeof incomingRun === 'object') {
			merged.lastRun = incomingRun;
			output = typeof incomingRun.output === 'string' ? incomingRun.output : '';
			pythonError = typeof incomingRun.error === 'string' ? incomingRun.error : '';
			running = Boolean(incomingRun.running);
		}

		const remoteEditing = Number(next.editingStep);
		const key = String(viewStep);
		const remoteOnSameStep = Number.isInteger(remoteEditing) && remoteEditing === viewStep;
		const remoteOnOtherStep = Number.isInteger(remoteEditing) && remoteEditing !== viewStep;
		// Polls omit editingStep; while replacePending, live fields are still the prior step.
		const holdLocalEditor = replacePending && !remoteOnSameStep;

		if (remoteOnOtherStep || holdLocalEditor) {
			// Teammate on another step, or our step switch in flight — keep our editor.
			merged.source = prevSource;
			merged.yjsState = prevYjs;
			// Accept awareness unless mid-replace (avoids caret flicker during step swap).
			merged.awarenessState =
				typeof next.awarenessState === 'string' && !holdLocalEditor
					? next.awarenessState
					: prevAwareness;
			merged.stepSources = { ...merged.stepSources, [key]: prevSource };
			if (prevYjs) merged.stepYjs = { ...merged.stepYjs, [key]: prevYjs };
		} else if (remoteOnSameStep) {
			// Explicit same-step sync from a peer (or our own update echo).
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
			if (replacePending) replacePending = false;
		} else {
			// Legacy / poll without editingStep: apply live CRDT for collab. When the
			// payload also includes step maps and they disagree with live source, the
			// live field is another step's buffer — keep our per-step slot instead.
			const remoteHasStepMaps =
				next.stepSources !== undefined || next.stepYjs !== undefined;
			const mapSource = merged.stepSources[key];
			const mapYjs = merged.stepYjs[key];
			const liveSource = typeof next.source === 'string' ? next.source : null;
			const liveYjs = typeof next.yjsState === 'string' ? next.yjsState : null;
			const mapMatchesLive =
				liveSource === null ||
				typeof mapSource !== 'string' ||
				mapSource === liveSource;
			if (!remoteHasStepMaps || mapMatchesLive) {
				if (liveSource !== null) {
					merged.source = liveSource;
					merged.stepSources = { ...merged.stepSources, [key]: liveSource };
				} else if (typeof mapSource === 'string') {
					merged.source = mapSource;
				}
				if (liveYjs !== null) {
					merged.yjsState = liveYjs;
					if (liveYjs) merged.stepYjs = { ...merged.stepYjs, [key]: liveYjs };
				} else if (typeof mapYjs === 'string' && mapYjs) {
					merged.yjsState = mapYjs;
				}
			} else {
				merged.source = mapSource;
				merged.yjsState = typeof mapYjs === 'string' && mapYjs ? mapYjs : prevYjs;
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
		if (joined.lastRun && typeof joined.lastRun === 'object') {
			applySharedLastRun(/** @type {any} */ (joined.lastRun));
		}
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

	/** @param {{ source?: string, yjsState?: string, awarenessState?: string, replaceEditor?: boolean }} payload */
	function setCollab(payload) {
		if (blocked) return;
		ensureMaps();
		const key = String(viewStep);
		const source = payload.source ?? room.source;
		const yjsState = payload.yjsState ?? room.yjsState;
		const awarenessState = payload.awarenessState ?? room.awarenessState;
		const replaceEditor = payload.replaceEditor === true;
		if (replaceEditor) {
			editorEpoch += 1;
			replacePending = true;
		}
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
			editingStep: viewStep,
			...(replaceEditor ? { replaceEditor: true } : {})
		});
		if (replaceEditor) {
			void sync.flush().finally(() => {
				replacePending = false;
			});
		}
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
		editorEpoch += 1;
		replacePending = true;
		sync.update({
			stepSources: room.stepSources,
			stepYjs: room.stepYjs,
			source: room.source,
			yjsState: room.yjsState,
			editingStep: viewStep,
			replaceEditor: true
		});
		void sync.flush().finally(() => {
			replacePending = false;
		});
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
			let cleanedYjs = room.yjsState;
			try {
				cleanedYjs = encodeSourceAsYjs(sourceSnapshot);
			} catch {
				cleanedYjs = room.yjsState;
			}
			setCollab({
				source: sourceSnapshot,
				yjsState: cleanedYjs,
				awarenessState: room.awarenessState,
				replaceEditor: true
			});
		}
		const stepSnapshot = viewStep;
		runClearedAt = now();
		const startingRun = {
			output: '',
			error: '',
			step: stepSnapshot,
			at: runClearedAt,
			running: true
		};
		applySharedLastRun(startingRun);
		/** @type {Record<string, unknown>} */
		const startPatch = { lastRun: startingRun };
		if (!room.lastCheck || room.lastCheck.step === stepSnapshot) {
			room = { ...room, lastCheck: null };
			startPatch.lastCheck = null;
		}
		sync.update(startPatch);
		publish();
		const stdin = stdinText
			.split('\n')
			.map((line) => line.replace(/\r$/u, '').replace(/\u00a0/gu, ' '))
			.filter((line, index, lines) => line.length > 0 || index < lines.length - 1);
		const result = await host.run(sourceSnapshot, { stdin });
		const finishedRun = {
			output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
			error: result.error ? String(result.error) : '',
			step: stepSnapshot,
			at: now(),
			running: false
		};
		files = result.files ?? {};
		applySharedLastRun(finishedRun);
		sync.update({ lastRun: finishedRun });
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
		const sourceText = String(source ?? '');
		let stepSources = {
			...room.stepSources,
			[stepKey]: sourceText
		};
		// Keep the live collaborative CRDT. A fresh encodeSourceAsYjs snapshot merged
		// onto the open editor duplicates the program; store the live encode instead.
		let stepYjs = {
			...room.stepYjs,
			[stepKey]: room.yjsState || ''
		};
		if (!stepYjs[stepKey] && sourceText) {
			try {
				stepYjs[stepKey] = encodeSourceAsYjs(sourceText);
			} catch {
				stepYjs[stepKey] = '';
			}
		}

		// Unlocking copies the passed step's code into the newly unlocked step.
		if (result.passed && unlockedStep > previousUnlocked) {
			const nextKey = String(unlockedStep);
			stepSources = { ...stepSources, [nextKey]: sourceText };
			stepYjs = { ...stepYjs, [nextKey]: stepYjs[stepKey] };
		}

		room = {
			...room,
			unlockedStep,
			lastCheck,
			source: sourceText || room.source,
			stepSources,
			stepYjs
			// yjsState stays the live editor CRDT — do not replace with a foreign snapshot
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

	/** @param {string} targetMemberId */
	async function ejectMember(targetMemberId) {
		if (!targetMemberId || blocked === 'full') return null;
		const response = await fetchImpl(
			`/api/pbl/rooms/${options.code}/members/${encodeURIComponent(targetMemberId)}`,
			{
				method: 'DELETE',
				headers: { accept: 'application/json' }
			}
		);
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			roomError =
				typeof payload.error === 'string' ? payload.error : 'Could not remove that teammate.';
			publish();
			return null;
		}
		applyRemoteRoom(payload.room && typeof payload.room === 'object' ? payload.room : payload);
		return snapshot();
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
		ejectMember,
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
