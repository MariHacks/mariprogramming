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


/**
 * @param {{ at?: string } | null | undefined} candidate
 * @param {{ at?: string } | null | undefined} baseline
 */
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
	if (!isNewerLastCheck(/** @type {any} */ (localCheck), /** @type {any} */ (serverCheck))) {
		return serverRoom;
	}
	const merged = { ...serverRoom, lastCheck: localCheck };
	const localUnlocked = Number(localRoom?.unlockedStep);
	const serverUnlocked = Number(serverRoom.unlockedStep);
	if (
		Number.isFinite(localUnlocked) &&
		(!Number.isFinite(serverUnlocked) || localUnlocked > serverUnlocked)
	) {
		merged.unlockedStep = localUnlocked;
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
 *   awarenessState?: string
 * }} row
 * @param {string} [viewerMemberId]
 */
export function publicRoomView(row, viewerMemberId) {
	return {
		code: row.code,
		pblId: row.pblId,
		teamName: row.teamName,
		source: row.source,
		currentStep: row.currentStep,
		unlockedStep: row.unlockedStep,
		lastCheck: row.lastCheck,
		openedHints: row.openedHints,
		stepEnteredAt: row.stepEnteredAt,
		memberCount: row.memberCount,
		version: row.version,
		yjsState: typeof row.yjsState === 'string' ? row.yjsState : '',
		awarenessState: typeof row.awarenessState === 'string' ? row.awarenessState : '',
		joinable: canAcceptMember(row.memberCount),
		isDriver: Boolean(viewerMemberId)
	};
}
