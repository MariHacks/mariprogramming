import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isRoomCode, normalizeRoomCode } from './room-code.js';

describe('room codes', () => {
	it('accepts only the short typeable alphabet', () => {
		expect(ROOM_CODE_LENGTH).toBe(6);
		expect(ROOM_CODE_ALPHABET).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
		expect(isRoomCode('AB23JK')).toBe(true);
		expect(isRoomCode('ab23jk')).toBe(true);
		expect(isRoomCode('O0I1AB')).toBe(false);
		expect(isRoomCode('AB23J')).toBe(false);
		expect(isRoomCode('AB23JKL')).toBe(false);
		expect(isRoomCode('')).toBe(false);
		expect(isRoomCode(null)).toBe(false);
	});

	it('normalizes join input to the canonical code', () => {
		expect(normalizeRoomCode(' ab-23-jk ')).toBe('AB23JK');
		expect(normalizeRoomCode('not a code')).toBeNull();
	});
});
