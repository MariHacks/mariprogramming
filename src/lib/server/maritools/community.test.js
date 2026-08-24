import { describe, expect, it } from 'vitest';
import { isCompleteStudentId, isStaffAccount, publicCommunityView } from './community.js';

describe('community identity', () => {
	it('treats the MariHacks team mailbox as staff', () => {
		expect(isStaffAccount('team@marihacks.com')).toBe(true);
		expect(isStaffAccount('someone@gmail.com')).toBe(false);
		expect(isStaffAccount('someone@gmail.com', 'staff')).toBe(true);
		expect(isStaffAccount('someone@gmail.com', 'moderator')).toBe(true);
		expect(isStaffAccount(null)).toBe(false);
	});

	it('omits student ID from the public view', () => {
		const view = publicCommunityView({
			userId: 'u1',
			email: 'a@gmail.com',
			studentId: '2530622',
			role: 'student'
		});
		expect(view).toEqual({ userId: 'u1', email: 'a@gmail.com', role: 'student' });
		expect(JSON.stringify(view)).not.toContain('2530622');
	});

	it('accepts a 5 to 8 digit student id', () => {
		expect(isCompleteStudentId('2530622')).toBe(true);
		expect(isCompleteStudentId('abc')).toBe(false);
	});
});
