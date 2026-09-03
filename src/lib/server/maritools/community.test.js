import { describe, expect, it } from 'vitest';
import {
	accountPageView,
	isCompleteStudentId,
	isStaffAccount,
	publicCommunityView,
	semesterPageView
} from './community.js';

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
		expect(isCompleteStudentId(undefined)).toBe(false);
	});

	it('keeps the saved profile name and falls back to Google only when it is absent', () => {
		const session = { email: 'ada@gmail.com', displayName: 'Ada Lovelace' };
		expect(accountPageView(session, { displayName: 'AdaCodes' }).displayName).toBe('AdaCodes');
		expect(accountPageView(session, { displayName: null }).displayName).toBe('Ada Lovelace');
	});

	it('builds account and semester views without a student number', () => {
		expect(accountPageView(null, null)).toEqual({ kind: 'guest' });
		expect(accountPageView({ email: 'a@gmail.com', displayName: 'Ada Lovelace' }, null)).toEqual({
			kind: 'incomplete',
			email: 'a@gmail.com',
			displayName: 'Ada Lovelace'
		});
		const complete = accountPageView(
			{ email: 'a@gmail.com' },
			{ displayName: 'Ada', nimDisclosureAcceptedAt: new Date() }
		);
		expect(complete.kind).toBe('complete');
		expect(complete).not.toHaveProperty('nimAccepted');
		const unnamed = accountPageView({ email: 'a@gmail.com' }, { nimDisclosureAcceptedAt: null });
		expect(unnamed.kind).toBe('complete');
		expect(unnamed.displayName).toBe(null);
		expect(unnamed).not.toHaveProperty('nimAccepted');
		expect(semesterPageView(null, null).kind).toBe('need-sign-in');
		expect(semesterPageView({ email: 'a@gmail.com' }, null).kind).toBe('need-profile');
		expect(semesterPageView({ email: 'a@gmail.com' }, { nimDisclosureAcceptedAt: null }).kind).toBe(
			'need-analysis-confirmation'
		);
		expect(
			semesterPageView({ email: 'a@gmail.com' }, { nimDisclosureAcceptedAt: new Date() }).kind
		).toBe('ready');
	});
});
