import { describe, expect, it } from 'vitest';
import { ROOM_CODE_LENGTH, isRoomCode } from '$lib/pbl/room-code.js';
import { generateMemberId, generateRoomCode } from './ids.js';

describe('PBL identifiers', () => {
	it('builds a typeable room code from random bytes', () => {
		const code = generateRoomCode(() => Uint8Array.from({ length: ROOM_CODE_LENGTH }, () => 1));
		expect(code).toHaveLength(ROOM_CODE_LENGTH);
		expect(isRoomCode(code)).toBe(true);
		expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
	});

	it('builds an opaque member id', () => {
		expect(generateMemberId(() => Buffer.alloc(16, 7))).toBe('07'.repeat(16));
		expect(generateMemberId()).toMatch(/^[0-9a-f]{32}$/u);
	});
});
