export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`, 'u');

/** @param {unknown} value */
export function normalizeRoomCode(value) {
	if (typeof value !== 'string') return null;
	const normalized = value.toUpperCase().replace(/[^A-Z0-9]/gu, '');
	return ROOM_CODE_PATTERN.test(normalized) ? normalized : null;
}

/** @param {unknown} value */
export function isRoomCode(value) {
	return normalizeRoomCode(value) !== null;
}
