export const MAX_TEAM_SIZE = 10;
export const MAX_TEAM_NAME_CHARS = 80;
export const MAX_SOURCE_CHARS = 100000;
export const MAX_HINT_LEVEL = 3;

/** @param {unknown} memberCount */
export function canAcceptMember(memberCount) {
	return Number.isInteger(memberCount) && memberCount >= 0 && memberCount < MAX_TEAM_SIZE;
}

/** @param {unknown} value */
export function normalizeTeamName(value) {
	if (typeof value !== 'string') return null;
	const name = value.replace(/\s+/gu, ' ').trim();
	if (!name || name.length > MAX_TEAM_NAME_CHARS || /\p{Cc}/u.test(name)) return null;
	return name;
}

/** @param {unknown} value */
export function normalizeOpenedHints(value) {
	/** @type {Record<string, number>} */
	const opened = {};
	if (value === null || value === undefined) return opened;
	if (typeof value !== 'object' || Array.isArray(value)) return opened;
	for (const [step, level] of Object.entries(value)) {
		if (!/^[0-9]{1,2}$/u.test(step)) continue;
		if (!Number.isInteger(level) || level < 1 || level > MAX_HINT_LEVEL) continue;
		opened[step] = level;
	}
	return opened;
}

export const MAX_STEP_YJS_CHARS = 200000;

/** @param {unknown} value */
export function normalizeStepSources(value) {
	/** @type {Record<string, string>} */
	const sources = {};
	if (value === null || value === undefined) return sources;
	if (typeof value !== 'object' || Array.isArray(value)) return sources;
	for (const [step, source] of Object.entries(value)) {
		if (!/^[0-9]{1,2}$/u.test(step)) continue;
		if (typeof source !== 'string' || source.length > MAX_SOURCE_CHARS) continue;
		sources[step] = source;
	}
	return sources;
}

export function normalizeStepYjs(value) {
	/** @type {Record<string, string>} */
	const encoded = {};
	if (value === null || value === undefined) return encoded;
	if (typeof value !== 'object' || Array.isArray(value)) return encoded;
	for (const [step, state] of Object.entries(value)) {
		if (!/^[0-9]{1,2}$/u.test(step)) continue;
		if (typeof state !== 'string') continue;
		if (state.length > MAX_STEP_YJS_CHARS) continue;
		if (state !== '' && !/^[A-Za-z0-9+/]*={0,2}$/u.test(state)) continue;
		encoded[step] = state;
	}
	return encoded;
}




/**
 * @param {{ at?: string } | null | undefined} candidate
 * @param {{ at?: string } | null | undefined} baseline
 */
export const MAX_RUN_OUTPUT_CHARS = 100000;
export const MAX_RUN_ERROR_CHARS = 4000;

/**
 * Shared terminal snapshot for the team: output, error, step, at, running.
 * @param {unknown} value
 * @returns {{ output: string, error: string, step: number, at: string, running: boolean } | null}
 */
export function normalizeLastRun(value) {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'object' || Array.isArray(value)) return null;
	const record = /** @type {Record<string, unknown>} */ (value);
	const step = Number(record.step);
	if (!Number.isInteger(step) || step < 0 || step > 99) return null;
	const at = typeof record.at === 'string' ? record.at : '';
	if (!at || !Number.isFinite(Date.parse(at))) return null;
	const output =
		typeof record.output === 'string' ? record.output.slice(0, MAX_RUN_OUTPUT_CHARS) : '';
	const error =
		typeof record.error === 'string' ? record.error.slice(0, MAX_RUN_ERROR_CHARS) : '';
	return {
		output,
		error,
		step,
		at,
		running: Boolean(record.running)
	};
}

export function isNewerLastCheck(candidate, baseline) {
	if (!candidate || typeof candidate !== 'object') return false;
	if (!baseline || typeof baseline !== 'object') return true;
	const nextAt = Date.parse(/** @type {{ at?: string }} */ (candidate).at ?? '');
	const prevAt = Date.parse(/** @type {{ at?: string }} */ (baseline).at ?? '');
	if (Number.isFinite(nextAt) && Number.isFinite(prevAt)) return nextAt > prevAt;
	if (Number.isFinite(nextAt) && !Number.isFinite(prevAt)) return true;
	return false;
}

/**
 * Keep a fresher local lastCheck (and unlock progress) when server state is older.
 * @param {Record<string, unknown>} serverRoom
 * @param {Record<string, unknown> | null | undefined} localRoom
 */
export function mergeRoomPreferringNewerLastCheck(serverRoom, localRoom) {
	if (!serverRoom || typeof serverRoom !== 'object') return serverRoom;
	const localCheck = localRoom && typeof localRoom === 'object' ? localRoom.lastCheck : null;
	const serverCheck = serverRoom.lastCheck;
	const localRun = localRoom && typeof localRoom === 'object' ? localRoom.lastRun : null;
	const serverRun = serverRoom.lastRun;
	const keepLocalCheck = isNewerLastCheck(
		/** @type {any} */ (localCheck),
		/** @type {any} */ (serverCheck)
	);
	const keepLocalRun = isNewerLastCheck(
		/** @type {any} */ (localRun),
		/** @type {any} */ (serverRun)
	);
	if (!keepLocalCheck && !keepLocalRun) {
		return serverRoom;
	}
	const merged = { ...serverRoom };
	if (keepLocalCheck) {
		merged.lastCheck = localCheck;
		const localUnlocked = Number(localRoom?.unlockedStep);
		const serverUnlocked = Number(serverRoom.unlockedStep);
		if (
			Number.isFinite(localUnlocked) &&
			(!Number.isFinite(serverUnlocked) || localUnlocked > serverUnlocked)
		) {
			merged.unlockedStep = localUnlocked;
		}
	}
	if (keepLocalRun) {
		merged.lastRun = localRun;
	}
	return merged;
}

/**
 * @param {{
 *   code: string,
 *   pblId: string,
 *   teamName: string,
 *   source: string,
 *   currentStep: number,
 *   unlockedStep: number,
 *   lastCheck: { step: number, passed: boolean, message: string, at: string } | null,
 *   openedHints: Record<string, number>,
 *   stepEnteredAt: string,
 *   memberCount: number,
 *   version: number,
 *   driverMemberId?: string | null,
 *   yjsState?: string,
 *   awarenessState?: string,
 *   stepSources?: Record<string, string>,
 *   stepYjs?: Record<string, string>,
 *   lastRun?: { output: string, error: string, step: number, at: string, running: boolean } | null,
 *   members?: Array<{ memberId: string, userId?: string | null, email?: string | null, name?: string | null }>,
 * }} row
 * @param {string} [viewerMemberId]
 */
export function publicRoomView(row, viewerMemberId) {
	const unlockedStep = Number.isInteger(row.unlockedStep) ? row.unlockedStep : 0;
	const stepSources = normalizeStepSources(row.stepSources);
	const stepYjs = normalizeStepYjs(row.stepYjs);
	return {
		code: row.code,
		pblId: row.pblId,
		teamName: row.teamName,
		source: row.source,
		// Compat only — clients must treat view step as local; progress is unlockedStep.
		currentStep: unlockedStep,
		unlockedStep,
		lastCheck: row.lastCheck,
		lastRun: normalizeLastRun(row.lastRun),
		openedHints: row.openedHints,
		stepEnteredAt: row.stepEnteredAt,
		memberCount: row.memberCount,
		version: row.version,
		yjsState: typeof row.yjsState === 'string' ? row.yjsState : '',
		awarenessState: typeof row.awarenessState === 'string' ? row.awarenessState : '',
		stepSources,
		stepYjs,
		driverMemberId: row.driverMemberId ?? null,
		members: Array.isArray(row.members) ? row.members : undefined,
		joinable: canAcceptMember(row.memberCount),
		isDriver: Boolean(
			viewerMemberId && row.driverMemberId && viewerMemberId === row.driverMemberId
		)
	};
}
