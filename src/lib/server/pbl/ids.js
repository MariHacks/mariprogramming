import { randomBytes } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '$lib/pbl/room-code.js';

/** @param {(size: number) => Uint8Array} [bytes] */
export function generateRoomCode(bytes = randomBytes) {
	const raw = bytes(ROOM_CODE_LENGTH);
	let code = '';
	for (const value of raw) {
		code += ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length];
	}
	return code;
}

/** @param {(size: number) => { toString: (encoding: string) => string }} [bytes] */
export function generateMemberId(bytes = randomBytes) {
	return bytes(16).toString('hex');
}
