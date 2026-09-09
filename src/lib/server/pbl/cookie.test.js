import { describe, expect, it } from 'vitest';
import { memberCookie, readMemberId } from './cookie.js';

const ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('PBL member cookie', () => {
	it('reads a member id without echoing other cookies', () => {
		expect(readMemberId(`theme=light; pbl_member=${ID}; extra=1`)).toBe(ID);
		expect(readMemberId('')).toBeNull();
		expect(readMemberId(null)).toBeNull();
		expect(readMemberId('pbl_member=not-hex')).toBeNull();
	});

	it('sets a host-only HttpOnly cookie', () => {
		expect(memberCookie(ID)).toBe(
			`pbl_member=${ID}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
		);
		expect(memberCookie(ID, { secure: true })).toContain('Secure');
	});
});
