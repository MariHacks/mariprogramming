const POLL_MS = 1000;
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
	const pollMs = options.pollMs ?? POLL_MS;
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

	async function request(path, init) {
		const response = await fetchImpl(path, init);
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

	async function applyRoom(payload) {
		version = Number(payload.version) || 0;
		local = payload;
		dirty = false;
		options.onState(payload);
	}

	async function pull() {
		if (stopped) return;
		const payload = await request(`/api/pbl/rooms/${options.code}`, {
			headers: { accept: 'application/json' }
		});
		if (payload && !dirty) applyRoom(payload);
	}

	async function flush() {
		if (pushTimer) {
			clearTimeout(pushTimer);
			pushTimer = null;
		}
		if (!dirty || stopped) return;
		const outgoing = {
			source: local.source,
			currentStep: local.currentStep,
			unlockedStep: local.unlockedStep,
			openedHints: local.openedHints,
			lastCheck: local.lastCheck
		};
		let result = await putOnce({ ...outgoing, version });
		if (result?.conflict) {
			version = Number(result.room.version) || version;
			result = await putOnce({ ...result.room, ...outgoing, version });
		}
		if (result?.room) applyRoom(result.room);
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
		if (!payload) return null;
		applyRoom(payload);
		return payload;
	}

	function start() {
		stopped = false;
		void pull();
		pollTimer = setInterval(() => {
			void pull();
		}, pollMs);
	}

	function stop() {
		stopped = true;
		if (pollTimer) clearInterval(pollTimer);
		if (pushTimer) clearTimeout(pushTimer);
		pollTimer = null;
		pushTimer = null;
	}

	return { start, stop, update, join, pull, flush };
}
