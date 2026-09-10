import {
	isNewerLastCheck,
	mergeRoomPreferringNewerLastCheck
} from './room-state.js';

/**
 * Focused tab: version probes are cheap (304), so poll often for collab feel.
 * Hidden tab: do not poll — catch up with one pull on focus.
 */
const POLL_MS = 250;
const PUSH_MS = 400;

/**
 * @param {{
 *   code: string,
 *   fetch?: typeof fetch,
 *   pollMs?: number,
 *   pushMs?: number,
 *   onState: (state: any) => void,
 *   onError?: (message: string) => void
 * }} options
 */
export function createRoomSync(options) {
	const fetchImpl = options.fetch ?? fetch;
	const activePollMs = options.pollMs ?? POLL_MS;
	const pushMs = options.pushMs ?? PUSH_MS;
	let version = 0;
	let dirty = false;
	/** @type {ReturnType<typeof setInterval> | null} */
	let pollTimer = null;
	/** @type {ReturnType<typeof setTimeout> | null} */
	let pushTimer = null;
	/** @type {Record<string, unknown>} */
	let local = {};
	let stopped = false;
	/** @type {(() => void) | null} */
	let onVisibility = null;

	function tabIsHidden() {
		return typeof document !== 'undefined' && document.hidden;
	}

	async function request(path, init) {
		const response = await fetchImpl(path, init);
		if (response.status === 304) return { unchanged: true };
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			const message =
				typeof payload.error === 'string' ? payload.error : 'The team room is unavailable.';
			options.onError?.(message);
			return null;
		}
		return payload;
	}

	async function putOnce(body) {
		const response = await fetchImpl(`/api/pbl/rooms/${options.code}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify(body)
		});
		const payload = await response.json().catch(() => ({}));
		if (response.status === 409 && payload.room && typeof payload.room === 'object') {
			return { conflict: true, room: payload.room };
		}
		if (!response.ok) {
			const message =
				typeof payload.error === 'string' ? payload.error : 'The team room is unavailable.';
			options.onError?.(message);
			return null;
		}
		return { conflict: false, room: payload.room || payload };
	}

	/**
	 * Apply server room without forcing a shared "current step" onto the client.
	 * Local view step lives in the workshop controller; we only merge shared maps.
	 * @param {Record<string, unknown>} payload
	 * @param {{ keepDirtyIfNewerCheck?: boolean }} [opts]
	 */
	async function applyRoom(payload, opts = {}) {
		version = Number(payload.version) || 0;
		const prior = local;
		const merged = mergeRoomPreferringNewerLastCheck(payload, prior);
		const keptNewerCheck = isNewerLastCheck(
			/** @type {any} */ (merged.lastCheck),
			/** @type {any} */ (payload.lastCheck)
		);
		// Never treat server currentStep as an instruction to change local navigation.
		if ('currentStep' in merged) {
			delete merged.currentStep;
		}
		local = { ...prior, ...merged };
		if (opts.keepDirtyIfNewerCheck && keptNewerCheck) {
			dirty = true;
			options.onState(local);
			schedulePush();
			return;
		}
		dirty = false;
		options.onState(local);
	}

	async function pull() {
		if (stopped) return;
		/** @type {Record<string, string>} */
		const headers = { accept: 'application/json' };
		if (version > 0) {
			headers['x-pbl-version'] = String(version);
			headers['if-none-match'] = `"${version}"`;
		}
		const payload = await request(`/api/pbl/rooms/${options.code}`, { headers });
		if (!payload || payload.unchanged) return;
		if (!dirty) applyRoom(payload);
	}

	/** @param {Record<string, unknown>} base @param {Record<string, unknown>} server */
	function outgoingWithServerProgress(base, server) {
		const next = { ...base };
		const serverUnlocked = Number(server.unlockedStep);
		const localUnlocked = Number(base.unlockedStep);
		if (Number.isFinite(serverUnlocked) && Number.isFinite(localUnlocked)) {
			next.unlockedStep = Math.max(localUnlocked, serverUnlocked);
		} else if (Number.isFinite(serverUnlocked)) {
			next.unlockedStep = serverUnlocked;
		}
		if (isNewerLastCheck(/** @type {any} */ (server.lastCheck), /** @type {any} */ (base.lastCheck))) {
			next.lastCheck = server.lastCheck;
		} else if (
			isNewerLastCheck(/** @type {any} */ (base.lastCheck), /** @type {any} */ (server.lastCheck))
		) {
			next.lastCheck = base.lastCheck;
		}
		if (isNewerLastCheck(/** @type {any} */ (server.lastRun), /** @type {any} */ (base.lastRun))) {
			next.lastRun = server.lastRun;
		} else if (
			isNewerLastCheck(/** @type {any} */ (base.lastRun), /** @type {any} */ (server.lastRun))
		) {
			next.lastRun = base.lastRun;
		}
		return next;
	}

	async function flush() {
		if (pushTimer) {
			clearTimeout(pushTimer);
			pushTimer = null;
		}
		if (!dirty || stopped) return;
		const outgoing = {
			unlockedStep: local.unlockedStep,
			openedHints: local.openedHints,
			lastCheck: local.lastCheck,
			lastRun: local.lastRun,
			source: local.source,
			yjsState: local.yjsState,
			awarenessState: local.awarenessState,
			stepSources: local.stepSources,
			stepYjs: local.stepYjs,
			editingStep: local.editingStep,
			replaceEditor: local.replaceEditor === true
		};
		let result = await putOnce({ ...outgoing, version });
		if (result?.conflict && result.room) {
			const retryBody = outgoingWithServerProgress(outgoing, result.room);
			result = await putOnce({
				...retryBody,
				version: Number(result.room.version) || version
			});
			if (result?.conflict && result.room) {
				await applyRoom(result.room, { keepDirtyIfNewerCheck: true });
			} else if (result?.room) {
				await applyRoom(result.room, { keepDirtyIfNewerCheck: true });
			}
			return;
		}
		if (result?.room) await applyRoom(result.room);
	}

	function schedulePush() {
		if (pushTimer) clearTimeout(pushTimer);
		pushTimer = setTimeout(() => {
			pushTimer = null;
			void flush();
		}, pushMs);
	}

	/** @param {Record<string, unknown>} patch */
	function update(patch) {
		dirty = true;
		local = { ...local, ...patch };
		options.onState(local);
		schedulePush();
	}

	async function join() {
		const payload = await request(`/api/pbl/rooms/${options.code}/join`, {
			method: 'POST',
			headers: { accept: 'application/json' }
		});
		if (!payload || payload.unchanged) return null;
		await applyRoom(payload);
		return payload;
	}

	function disarmPoll() {
		if (pollTimer) clearInterval(pollTimer);
		pollTimer = null;
	}

	function armPoll() {
		disarmPoll();
		// Background tabs do not need live collab — save Neon until focus returns.
		if (tabIsHidden()) return;
		pollTimer = setInterval(() => {
			void pull();
		}, activePollMs);
	}

	function start() {
		stopped = false;
		void pull();
		armPoll();
		if (typeof document !== 'undefined' && !onVisibility) {
			onVisibility = () => {
				if (stopped) return;
				if (document.hidden) {
					disarmPoll();
					return;
				}
				void pull();
				armPoll();
			};
			document.addEventListener('visibilitychange', onVisibility);
		}
	}

	function stop() {
		stopped = true;
		disarmPoll();
		if (pushTimer) clearTimeout(pushTimer);
		pushTimer = null;
		if (onVisibility && typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', onVisibility);
			onVisibility = null;
		}
	}

	return { start, stop, update, join, pull, flush };
}
