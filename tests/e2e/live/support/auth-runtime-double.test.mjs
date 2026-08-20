import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withRequestAuth } from './auth-runtime-double.js';

describe('live E2E auth runtime double', () => {
	it('admits only the exact local test session token', async () => {
		const result = await withRequestAuth(async ({ auth, findGoogleAccount }) => {
			const denied = await auth.api.getSession({
				headers: new Headers({ cookie: 'mari-staff.session_token=wrong' })
			});
			const admitted = await auth.api.getSession({
				headers: new Headers({ cookie: 'mari-staff.session_token=live-e2e-authorized' })
			});
			return {
				denied,
				admitted,
				account: await findGoogleAccount(admitted.user.id)
			};
		});

		assert.equal(result.denied, null);
		assert.equal(result.admitted.user.email, 'team@marihacks.com');
		assert.equal(result.admitted.user.emailVerified, true);
		assert.equal(result.account.providerId, 'google');
		assert.equal(result.account.userId, result.admitted.user.id);
	});
});
