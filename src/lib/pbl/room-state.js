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
 *   driverMemberId?: string | null
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
		joinable: canAcceptMember(row.memberCount),
		isDriver: Boolean(row.driverMemberId && viewerMemberId && row.driverMemberId === viewerMemberId)
	};
}
