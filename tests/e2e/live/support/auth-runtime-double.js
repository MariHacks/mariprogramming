import { Client } from 'pg';

const STAFF_USER_ID = '70000000-0000-4000-8000-000000000001';
const STAFF_EMAIL = 'team@marihacks.com';
const SESSION_TOKEN = 'live-e2e-authorized';
const AVATAR_USER_ID = '70000000-0000-4000-8000-000000000099';

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
					const avatarSession =
						process.env.LIVE_E2E_MODE === 'isolated-local' &&
						(headers.get('cookie') ?? '')
							.split(';')
							.map((part) => part.trim())
							.includes('mari-staff.session_token=live-e2e-avatar');
					if (!avatarSession && !hasAuthorizedSession(headers)) return null;
					let user = {
						id: STAFF_USER_ID,
						name: 'Programming Club Staff',
						email: STAFF_EMAIL,
						emailVerified: true
					};
					if (avatarSession) {
						const client = new Client({ connectionString: process.env.DATABASE_URL });
						await client.connect();
						try {
							const result = await client.query(
								'SELECT id, name, email, image, email_verified AS "emailVerified" FROM "user" WHERE id = $1',
								[AVATAR_USER_ID]
							);
							user = result.rows[0] ?? user;
						} finally {
							await client.end();
						}
					}
					return {
						user,
						session: {
							id: 'live-e2e-session',
							userId: user.id,
							expiresAt: new Date('2099-01-01T00:00:00.000Z')
						}
					};
				}
			}
		},
		async findGoogleAccount(userId) {
			if (
				userId !== STAFF_USER_ID &&
				!(process.env.LIVE_E2E_MODE === 'isolated-local' && userId === AVATAR_USER_ID)
			)
				return null;
			return { providerId: 'google', accountId: 'live-e2e-google-subject', userId };
		}
	});
}
