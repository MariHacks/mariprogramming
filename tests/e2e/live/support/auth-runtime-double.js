const STAFF_USER_ID = '70000000-0000-4000-8000-000000000001';
const STAFF_EMAIL = 'team@marihacks.com';
const SESSION_TOKEN = 'live-e2e-authorized';

/** @param {Headers} headers */
function hasAuthorizedSession(headers) {
	const cookie = headers.get('cookie') ?? '';
	return cookie
		.split(';')
		.map((part) => part.trim())
		.includes(`mari-staff.session_token=${SESSION_TOKEN}`);
}

/** @param {(runtime: { auth: any, findGoogleAccount: (userId: string) => Promise<unknown> }) => Promise<any>} operation */
export async function withRequestAuth(operation) {
	return operation({
		auth: {
			api: {
				async getSession({ headers }) {
					if (!hasAuthorizedSession(headers)) return null;
					return {
						user: {
							id: STAFF_USER_ID,
							name: 'Programming Club Staff',
							email: STAFF_EMAIL,
							emailVerified: true
						},
						session: {
							id: 'live-e2e-session',
							userId: STAFF_USER_ID,
							expiresAt: new Date('2099-01-01T00:00:00.000Z')
						}
					};
				}
			}
		},
		async findGoogleAccount(userId) {
			if (userId !== STAFF_USER_ID) return null;
			return { providerId: 'google', accountId: 'live-e2e-google-subject', userId };
		}
	});
}
