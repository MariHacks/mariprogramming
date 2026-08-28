// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { ServerConfigurationError } from '$lib/server/config/environment.js';
import { NIM_DISCLOSURE } from '$lib/server/maritools/community.js';
import { MaritoolsInputError, MaritoolsUnavailableError } from '$lib/server/maritools/student-store.js';
import { prerender, _createHandlers } from './+page.server.js';

const ORIGIN = 'https://club.example.com';
const SESSION = {
	userId: 'user-1',
	sessionId: 'session-1',
	email: 'ada@gmail.com',
	googleSubject: 'sub-1',
	expiresAt: new Date('2030-01-01T00:00:00.000Z')
};

function handlers(overrides = {}) {
	const repository = {
		getProfile: vi.fn(async () => null),
		completeProfile: vi.fn(async () => ({
			userId: SESSION.userId,
			studentId: '2530622',
			displayName: 'Ada',
			role: 'student',
			nimDisclosureAcceptedAt: new Date()
		})),
		...overrides.repository
	};
	return {
		..._createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createRepository: vi.fn(() => repository),
			isGoogleSignInConfigured: vi.fn(() => true),
			...overrides
		}),
		repository
	};
}

function event({ locals = {}, form = {} } = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(form)) data.set(key, String(value));
	return {
		locals,
		url: new URL(`${ORIGIN}/tools/account`),
		request: { formData: async () => data }
	};
}

describe('account page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('returns a guest view and the Google callback', async () => {
		const current = handlers();
		await expect(current.load(event())).resolves.toEqual({
			view: { kind: 'guest' },
			callbackURL: `${ORIGIN}/tools/account`,
			recoveryMessage: null,
			nimDisclosure: NIM_DISCLOSURE,
			googleSignInConfigured: true
		});
	});

	it('marks Google sign-in unconfigured when credentials are placeholders', async () => {
		const current = handlers({
			isGoogleSignInConfigured: vi.fn(() => false)
		});
		const data = await current.load(event());
		expect(data.googleSignInConfigured).toBe(false);
		expect(data.view).toEqual({ kind: 'guest' });
	});

	it('explains a failed Google return', async () => {
		const current = handlers();
		const loadEvent = event();
		loadEvent.url = new URL(`${ORIGIN}/tools/account?state=unavailable`);
		const data = await current.load(loadEvent);
		expect(data.recoveryMessage).toBe('We could not finish sign-in. Try again.');
	});

	it('hides the failed-return message once Google sign-in already succeeded', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({
					userId: SESSION.userId,
					studentId: '2530622',
					displayName: 'Ada',
					role: 'student',
					nimDisclosureAcceptedAt: new Date('2026-08-20T00:00:00.000Z')
				}))
			}
		});
		const loadEvent = event({ locals: { maritools: SESSION } });
		loadEvent.url = new URL(`${ORIGIN}/tools/account?state=unavailable`);
		await expect(current.load(loadEvent)).rejects.toMatchObject({
			status: 303,
			location: '/tools/account'
		});
	});

	it('keeps unrelated account query params when clearing a stale sign-in failure', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({
					userId: SESSION.userId,
					studentId: '2530622',
					displayName: 'Ada',
					role: 'student',
					nimDisclosureAcceptedAt: new Date('2026-08-20T00:00:00.000Z')
				}))
			}
		});
		const loadEvent = event({ locals: { maritools: SESSION } });
		loadEvent.url = new URL(`${ORIGIN}/tools/account?state=unavailable&from=oauth`);
		await expect(current.load(loadEvent)).rejects.toMatchObject({
			status: 303,
			location: '/tools/account?from=oauth'
		});
	});

	it('asks a signed-in student to finish the account without showing a student number', async () => {
		const current = handlers();
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.view).toEqual({ kind: 'incomplete', email: SESSION.email });
		expect(JSON.stringify(data)).not.toContain('2530622');
	});

	it('shows a completed profile without the student number', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({
					userId: SESSION.userId,
					studentId: '2530622',
					displayName: 'Ada',
					role: 'student',
					nimDisclosureAcceptedAt: new Date('2026-08-20T00:00:00.000Z')
				}))
			}
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.view).toEqual({
			kind: 'complete',
			email: SESSION.email,
			displayName: 'Ada',
			nimAccepted: true
		});
		expect(JSON.stringify(data)).not.toContain('2530622');
	});

	it('still loads when the database is down', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.view).toEqual({ kind: 'incomplete', email: SESSION.email });
		expect(data.unavailable).toBe(true);
	});

	it('still loads when server configuration is missing', async () => {
		const current = handlers({
			readEnvironment: vi.fn(() => {
				throw new ServerConfigurationError();
			}),
			isGoogleSignInConfigured: vi.fn(() => false)
		});
		const loadEvent = event();
		loadEvent.url = new URL('http://localhost:5174/tools/account');
		const data = await current.load(loadEvent);
		expect(data.view).toEqual({ kind: 'guest' });
		expect(data.callbackURL).toBe('http://localhost:5174/tools/account');
		expect(data.unavailable).toBeUndefined();
		expect(data.googleSignInConfigured).toBe(false);
	});

	it('marks signed-in account load unavailable when server configuration is missing', async () => {
		const current = handlers({
			readEnvironment: vi.fn(() => {
				throw new ServerConfigurationError();
			}),
			isGoogleSignInConfigured: vi.fn(() => false)
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.view).toEqual({ kind: 'incomplete', email: SESSION.email });
		expect(data.unavailable).toBe(true);
		expect(data.googleSignInConfigured).toBe(false);
	});

	it('saves a completed account', async () => {
		const current = handlers();
		const result = await current.actions.complete(
			event({
				locals: { maritools: SESSION },
				form: { studentId: '2530622', displayName: 'Ada', nimAccepted: 'on' }
			})
		);
		expect(result).toMatchObject({ success: true });
		expect(JSON.stringify(result)).not.toContain('2530622');
		expect(current.repository.completeProfile).toHaveBeenCalledWith({
			userId: SESSION.userId,
			email: SESSION.email,
			studentId: '2530622',
			displayName: 'Ada',
			nimAccepted: true
		});
	});

	it('treats a missing student number as empty', async () => {
		const current = handlers({
			repository: {
				completeProfile: vi.fn(async () => {
					throw new MaritoolsInputError('invalid-student-id');
				})
			}
		});
		const result = await current.actions.complete(event({ locals: { maritools: SESSION } }));
		expect(result.status).toBe(400);
		expect(current.repository.completeProfile).toHaveBeenCalledWith(
			expect.objectContaining({ studentId: '', displayName: '' })
		);
	});

	it('rejects completion without a session', async () => {
		const result = await handlers().actions.complete(event({ form: { studentId: '2530622' } }));
		expect(result.status).toBe(401);
	});

	it('returns field errors for a bad student number', async () => {
		const current = handlers({
			repository: {
				completeProfile: vi.fn(async () => {
					throw new MaritoolsInputError('invalid-student-id');
				})
			}
		});
		const result = await current.actions.complete(
			event({
				locals: { maritools: SESSION },
				form: { studentId: 'abc', nimAccepted: 'on' }
			})
		);
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/student number/i);
	});

	it('requires the NVIDIA disclosure', async () => {
		const current = handlers({
			repository: {
				completeProfile: vi.fn(async () => {
					throw new MaritoolsInputError('nim-required');
				})
			}
		});
		const result = await current.actions.complete(
			event({
				locals: { maritools: SESSION },
				form: { studentId: '2530622' }
			})
		);
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/NVIDIA/i);
	});

	it('rethrows unexpected completion failures', async () => {
		const current = handlers({
			repository: {
				completeProfile: vi.fn(async () => {
					throw new Error('disk');
				})
			}
		});
		await expect(
			current.actions.complete(
				event({
					locals: { maritools: SESSION },
					form: { studentId: '2530622', nimAccepted: 'on' }
				})
			)
		).rejects.toThrow('disk');
	});

	it('returns a bounded unavailable message', async () => {
		const current = handlers({
			repository: {
				completeProfile: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		const result = await current.actions.complete(
			event({
				locals: { maritools: SESSION },
				form: { studentId: '2530622', nimAccepted: 'on' }
			})
		);
		expect(result.status).toBe(503);
	});
});
