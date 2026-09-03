import { describe, expect, it } from 'vitest';
import { isMaritoolsSession, isStaffSession, requireStaff } from './authorization.js';

const approved = Object.freeze({
	user: {
		id: 'better-auth-user-123',
		email: 'team@marihacks.com',
		emailVerified: true
	},
	session: {
		id: 'session-123',
		userId: 'better-auth-user-123',
		expiresAt: new Date('2030-01-01T00:00:00.000Z')
	},
	account: {
		providerId: 'google',
		accountId: 'google-subject-123',
		userId: 'better-auth-user-123'
	}
});

describe('staff authorization', () => {
	it('accepts the exact verified address and persisted Google subject', () => {
		expect(isStaffSession(approved, new Date('2029-12-31T23:59:59.000Z'))).toEqual({
			userId: 'better-auth-user-123',
			sessionId: 'session-123',
			email: 'team@marihacks.com',
			googleSubject: 'google-subject-123',
			expiresAt: new Date('2030-01-01T00:00:00.000Z')
		});
	});

	it('normalizes case and surrounding whitespace before the exact-address check', () => {
		expect(
			isStaffSession(
				{
					...approved,
					user: { ...approved.user, email: '  Team@MariHacks.Com  ' }
				},
				new Date('2029-12-31T23:59:59.000Z')
			)
		).toMatchObject({ email: 'team@marihacks.com' });
	});

	it('accepts the serialized expiry returned at a JSON boundary', () => {
		expect(
			isStaffSession(
				{ ...approved, session: { ...approved.session, expiresAt: '2030-01-01T00:00:00.000Z' } },
				new Date('2029-12-31T23:59:59.000Z')
			)
		).toMatchObject({ sessionId: 'session-123' });
	});

	it.each([
		['missing session', null],
		['unverified email', { ...approved, user: { ...approved.user, emailVerified: false } }],
		['forged address', { ...approved, user: { ...approved.user, email: 'other@marihacks.com' } }],
		['missing address', { ...approved, user: { ...approved.user, email: null } }],
		[
			'alias address',
			{ ...approved, user: { ...approved.user, email: 'team+staff@marihacks.com' } }
		],
		[
			'expired session',
			{ ...approved, session: { ...approved.session, expiresAt: new Date('2029-01-01') } }
		],
		[
			'malformed session expiry',
			{ ...approved, session: { ...approved.session, expiresAt: 'invalid' } }
		],
		['missing provider account', { ...approved, account: null }],
		[
			'non-Google provider',
			{ ...approved, account: { ...approved.account, providerId: 'github' } }
		],
		['missing stable subject', { ...approved, account: { ...approved.account, accountId: '' } }],
		[
			'untrimmed stable subject',
			{ ...approved, account: { ...approved.account, accountId: ' subject ' } }
		],
		[
			'oversized stable subject',
			{ ...approved, account: { ...approved.account, accountId: 's'.repeat(256) } }
		],
		[
			'mismatched session user',
			{ ...approved, session: { ...approved.session, userId: 'forged-user' } }
		],
		[
			'mismatched account user',
			{ ...approved, account: { ...approved.account, userId: 'forged-user' } }
		]
	])('rejects %s', (_case, candidate) => {
		expect(isStaffSession(candidate, new Date('2029-12-31T23:59:59.000Z'))).toBeNull();
	});

	it('accepts any verified Google mailbox for MariTools without promoting staff', () => {
		const student = {
			...approved,
			user: { ...approved.user, email: 'ada@gmail.com' }
		};
		expect(isMaritoolsSession(student, new Date('2029-12-31T23:59:59.000Z'))).toMatchObject({
			email: 'ada@gmail.com',
			userId: 'better-auth-user-123'
		});
		expect(isStaffSession(student, new Date('2029-12-31T23:59:59.000Z'))).toBeNull();
	});

	it('redirects missing or forged locals to the one sign-in route', () => {
		expect(() => requireStaff({ staff: null })).toThrowError(
			expect.objectContaining({ status: 303, location: '/staff/sign-in?state=reauthenticate' })
		);
		expect(() =>
			requireStaff({
				staff: null,
				maritools: { userId: 'executive-1', email: 'executive@example.com', role: 'moderator' }
			})
		).toThrowError(
			expect.objectContaining({ status: 303, location: '/staff/sign-in?state=reauthenticate' })
		);
	});

	it('returns only server-established staff locals', () => {
		const staff = isStaffSession(approved, new Date('2029-12-31T23:59:59.000Z'));
		expect(requireStaff({ staff })).toBe(staff);
	});
});
