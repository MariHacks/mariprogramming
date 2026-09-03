// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { ServerConfigurationError } from '$lib/server/config/environment.js';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError
} from '$lib/server/maritools/student-store.js';
import { ClubInputError, ClubUnavailableError } from '$lib/server/maritools/club-store.js';
import { prerender, _createHandlers } from './+page.server.js';

const ORIGIN = 'https://club.example.com';
const SESSION = {
	userId: 'user-1',
	sessionId: 'session-1',
	email: 'ada@gmail.com',
	googleSubject: 'sub-1',
	expiresAt: new Date('2030-01-01T00:00:00.000Z')
};

/**
 * @param {any} [overrides]
 * @returns {any}
 */
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

/**
 * @param {any} [options]
 * @returns {any}
 */
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
	it.each(['join', 'finishOnboarding'])(
		'%s reports a bounded error when the saved avatar cannot be read',
		async (action) => {
			const joinProgrammingClub = vi.fn();
			const current = handlers({
				repository: {
					getProfile: vi.fn(async () => {
						throw new MaritoolsUnavailableError();
					})
				},
				createClubRepository: vi.fn(() => ({ joinProgrammingClub }))
			});
			const result = await current.actions[action](
				event({ locals: { maritools: SESSION }, form: { studentId: '2530622' } })
			);
			expect(result.status).toBe(503);
			expect(result.data.error).toBe(
				action === 'join'
					? 'Joining the club is unavailable. Try again.'
					: 'Finishing signup is unavailable. Try again.'
			);
			expect(joinProgrammingClub).not.toHaveBeenCalled();
		}
	);

	it.each(['join', 'finishOnboarding'])(
		'%s saves the Google avatar by default and preserves custom avatars',
		async (action) => {
			const googleImage = 'https://lh3.googleusercontent.com/a/avatar=s96-c';
			for (const [savedImage, upload, expected] of [
				[null, false, googleImage],
				['data:image/png;base64,YQ==', false, 'data:image/png;base64,YQ=='],
				['data:image/png;base64,YQ==', true, 'data:image/png;base64,YXZhdGFy']
			]) {
				const joinProgrammingClub = vi.fn(async () => ({}));
				const current = handlers({
					repository: { getProfile: vi.fn(async () => ({ profileImageDataUrl: savedImage })) },
					createClubRepository: vi.fn(() => ({
						joinProgrammingClub,
						completeRequiredForm: vi.fn()
					}))
				});
				const requestEvent = event({
					locals: { maritools: { ...SESSION, profileImageUrl: googleImage } },
					form: { studentId: '2530622' }
				});
				const data = await requestEvent.request.formData();
				if (upload)
					data.set('profileImage', new File(['avatar'], 'avatar.png', { type: 'image/png' }));
				await current.actions[action](requestEvent);
				expect(joinProgrammingClub).toHaveBeenCalledWith(
					expect.objectContaining({ profileImageDataUrl: expected })
				);
			}
		}
	);

	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('returns a guest view and the Google callback', async () => {
		const current = handlers();
		await expect(current.load(event())).resolves.toEqual({
			view: { kind: 'guest' },
			callbackURL: `${ORIGIN}/tools/account`,
			recoveryMessage: null,
			googleSignInConfigured: true,
			onboardingPending: true,
			club: { kind: 'signed_out' },
			requiredFormUrl:
				'https://forms.cloud.microsoft/pages/responsepage.aspx?id=gM4FyXMGa02pnxlDYrX7rr5-iZTtVRdEtoDBmsFVUSFUQlc3REk4VE1aRkg0RjJMMEU0RDZPWFZaUy4u&route=shorturl',
			clubInterests: ['algorithms', 'games', 'hardware', 'open-source', 'web', 'workshops'],
			yearLevels: ['first', 'second', 'third'],
			programs: expect.arrayContaining([
				'Arts and Sciences',
				'Science, Pure and Applied Science',
				'Double DEC, Music and Social Science'
			])
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
		const namedSession = { ...SESSION, displayName: 'Ada Lovelace' };
		const data = await current.load(event({ locals: { maritools: namedSession } }));
		expect(data.view).toEqual({
			kind: 'incomplete',
			email: SESSION.email,
			displayName: 'Ada Lovelace'
		});
		expect(JSON.stringify(data)).not.toContain('2530622');
	});

	it('loads club onboarding without exposing the saved student number', async () => {
		const getMyClubOnboarding = vi.fn(async () => null);
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({
					userId: SESSION.userId,
					studentId: '2530622',
					displayName: 'Ada',
					role: 'student',
					nimDisclosureAcceptedAt: new Date('2026-08-20T00:00:00.000Z')
				}))
			},
			createClubRepository: vi.fn(() => ({ getMyClubOnboarding }))
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.view).toEqual({
			kind: 'complete',
			email: SESSION.email,
			displayName: 'Ada',
			username: null,
			firstName: null,
			lastName: null,
			profileImageDataUrl: null
		});
		expect(data.club).toEqual({ kind: 'needs_club_details' });
		expect(getMyClubOnboarding).toHaveBeenCalledWith(SESSION.userId);
		expect(data.onboardingDraft.studentId).toBe('');
		expect(data.view).not.toHaveProperty('studentId');
		expect(JSON.stringify(data)).not.toContain('2530622');
	});

	it('prompts a joined member to import a schedule', async () => {
		const current = handlers({
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => ({
					requiredFormCompletedAt: new Date('2026-09-02T12:00:00.000Z'),
					scheduleSharedAt: null
				}))
			}))
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.club).toEqual({ kind: 'joined_without_schedule', scheduleSharedAt: null });
	});

	it('marks a member schedule as available after import', async () => {
		const sharedAt = new Date('2026-09-02T12:00:00.000Z');
		const current = handlers({
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => ({
					requiredFormCompletedAt: sharedAt,
					scheduleSharedAt: sharedAt
				}))
			}))
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.club).toEqual({
			kind: 'joined_with_shared_schedule',
			scheduleSharedAt: sharedAt
		});
	});

	it('loads completed profile activity without exposing private outline or student data', async () => {
		const joinedAt = new Date('2026-08-20T12:00:00.000Z');
		const listOutlines = vi.fn(async () => [
			{
				sha256: 'ab'.repeat(32),
				createdAt: joinedAt,
				extraction: { proposals: { courseCode: '203-SN3-RE', title: 'Modern Physics' } }
			}
		]);
		const listThreadsByAuthor = vi.fn(async () => [
			{ id: 'thread-1', title: 'Study group', body: 'Meet after class' }
		]);
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({
					userId: SESSION.userId,
					studentId: '2530622',
					username: 'ada_codes',
					firstName: 'Ada',
					lastName: 'Lovelace',
					role: 'staff',
					nimDisclosureAcceptedAt: joinedAt
				})),
				listOutlines
			},
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => ({
					createdAt: joinedAt,
					requiredFormCompletedAt: joinedAt,
					scheduleSharedAt: null
				}))
			})),
			createCommunityRepository: vi.fn(() => ({ listThreadsByAuthor }))
		});

		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.communityProfile).toEqual({ joinedAt, role: 'staff' });
		expect(data.recentPosts).toEqual([
			{ id: 'thread-1', title: 'Study group', body: 'Meet after class' }
		]);
		expect(data.courseOutlines[0].extraction.proposals).toMatchObject({
			courseCode: '203-SN3-RE',
			title: 'Modern Physics'
		});
		expect(JSON.stringify(data)).not.toContain('2530622');
		expect(JSON.stringify(data)).not.toContain('extractedText');
	});

	it('keeps completed identity usable when profile activity is unavailable', async () => {
		const joinedAt = new Date('2026-08-20T12:00:00.000Z');
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({
					username: 'ada_codes',
					firstName: 'Ada',
					lastName: 'Lovelace',
					role: 'student'
				})),
				listOutlines: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			},
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => ({
					createdAt: joinedAt,
					requiredFormCompletedAt: joinedAt,
					scheduleSharedAt: null
				}))
			})),
			createCommunityRepository: vi.fn(() => ({
				listThreadsByAuthor: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}))
		});

		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.view).toMatchObject({ kind: 'complete', username: 'ada_codes' });
		expect(data.communityProfile).toEqual({ joinedAt, role: 'student' });
		expect(data.recentPosts).toEqual([]);
		expect(data.courseOutlines).toEqual([]);
		expect(data.unavailable).toBeUndefined();
	});

	it('normalizes malformed profile activity results to empty lists', async () => {
		const joinedAt = new Date('2026-08-20T12:00:00.000Z');
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({ username: 'ada_codes', role: 'student' })),
				listOutlines: vi.fn(async () => null)
			},
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => ({
					createdAt: joinedAt,
					requiredFormCompletedAt: joinedAt
				}))
			})),
			createCommunityRepository: vi.fn(() => ({
				listThreadsByAuthor: vi.fn(async () => null)
			}))
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.courseOutlines).toEqual([]);
		expect(data.recentPosts).toEqual([]);
	});

	it('keeps a joined member on the required Microsoft form step', async () => {
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({
					studentId: '2530622',
					username: 'ada_member',
					firstName: 'Ada',
					lastName: 'Member'
				}))
			},
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => ({
					program: 'Science, Pure and Applied Science',
					yearLevel: 'second',
					experienceLevel: 'learning',
					interests: ['web'],
					clubGoals: 'Project nights',
					requiredFormCompletedAt: null,
					scheduleSharedAt: null
				}))
			}))
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(data.club).toEqual({ kind: 'needs_required_form' });
		expect(data.requiredFormUrl).toBe(
			'https://forms.cloud.microsoft/pages/responsepage.aspx?id=gM4FyXMGa02pnxlDYrX7rr5-iZTtVRdEtoDBmsFVUSFUQlc3REk4VE1aRkg0RjJMMEU0RDZPWFZaUy4u&route=shorturl'
		);
		expect(data).not.toHaveProperty('requiredFormPrefilled');
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
				form: { studentId: '2530622', displayName: 'Ada' }
			})
		);
		expect(result).toMatchObject({ success: true });
		expect(JSON.stringify(result)).not.toContain('2530622');
		expect(current.repository.completeProfile).toHaveBeenCalledWith({
			userId: SESSION.userId,
			email: SESSION.email,
			studentId: '2530622',
			displayName: 'Ada'
		});
	});

	it('updates member identity and optionally replaces the avatar', async () => {
		const updateMemberProfile = vi.fn(async () => ({}));
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createClubRepository: vi.fn(() => ({ updateMemberProfile })),
			isGoogleSignInConfigured: vi.fn(() => true)
		});
		const updateEvent = event({
			locals: { maritools: SESSION },
			form: { username: 'ada_codes', firstName: 'Ada', lastName: 'Lovelace' }
		});
		updateEvent.request.formData = async () => {
			const data = new FormData();
			data.set('username', 'ada_codes');
			data.set('firstName', 'Ada');
			data.set('lastName', 'Lovelace');
			data.set('profileImage', new File(['avatar'], 'ada.png', { type: 'image/png' }));
			return data;
		};

		await expect(current.actions.updateProfile(updateEvent)).resolves.toEqual({
			profileUpdated: true
		});
		expect(updateMemberProfile).toHaveBeenCalledWith({
			userId: SESSION.userId,
			username: 'ada_codes',
			firstName: 'Ada',
			lastName: 'Lovelace',
			profileImageDataUrl: 'data:image/png;base64,YXZhdGFy'
		});
	});

	it('preserves the avatar when a profile edit omits a replacement file', async () => {
		const updateMemberProfile = vi.fn(async () => ({}));
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createClubRepository: vi.fn(() => ({ updateMemberProfile })),
			isGoogleSignInConfigured: vi.fn(() => true)
		});
		await current.actions.updateProfile(
			event({
				locals: { maritools: SESSION },
				form: { username: 'ada_codes', firstName: 'Ada', lastName: 'Lovelace' }
			})
		);
		expect(updateMemberProfile).toHaveBeenCalledWith({
			userId: SESSION.userId,
			username: 'ada_codes',
			firstName: 'Ada',
			lastName: 'Lovelace'
		});
	});

	it('rejects an invalid profile image before updating the member', async () => {
		const updateMemberProfile = vi.fn(async () => ({}));
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createClubRepository: vi.fn(() => ({ updateMemberProfile })),
			isGoogleSignInConfigured: vi.fn(() => true)
		});
		const updateEvent = event({ locals: { maritools: SESSION } });
		updateEvent.request.formData = async () => {
			const data = new FormData();
			data.set('username', 'ada_codes');
			data.set('firstName', 'Ada');
			data.set('lastName', 'Lovelace');
			data.set('profileImage', new File(['text'], 'avatar.txt', { type: 'text/plain' }));
			return data;
		};
		const result = /** @type {any} */ (await current.actions.updateProfile(updateEvent));
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/JPG/);
		expect(updateMemberProfile).not.toHaveBeenCalled();
	});

	it.each([
		['without a session', null, null, 401],
		['with invalid profile details', new ClubInputError('invalid-username'), SESSION, 400],
		['when profile storage is unavailable', new ClubUnavailableError(), SESSION, 503]
	])('rejects profile updates %s', async (_label, failure, session, status) => {
		const updateMemberProfile = vi.fn(async () => {
			if (failure) throw failure;
		});
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createClubRepository: vi.fn(() => ({ updateMemberProfile })),
			isGoogleSignInConfigured: vi.fn(() => true)
		});
		const result = /** @type {any} */ (await current.actions.updateProfile(
			event({
				locals: session ? { maritools: session } : {},
				form: { username: 'ada_codes', firstName: 'Ada', lastName: 'Lovelace' }
			})
		));
		expect(result.status).toBe(status);
	});

	it('joins Programming Club with the profile and interest tabs', async () => {
		const joinProgrammingClub = vi.fn(async () => ({}));
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createRepository: vi.fn(() => ({ getProfile: vi.fn(async () => null) })),
			createClubRepository: vi.fn(() => ({ joinProgrammingClub })),
			isGoogleSignInConfigured: vi.fn(() => true)
		});
		await expect(
			current.actions.join(
				event({
					locals: { maritools: SESSION },
					form: {
						studentId: '2530622',
						username: 'ada_codes',
						firstName: 'Ada',
						lastName: 'Lovelace',
						program: 'Science, Pure and Applied Science',
						yearLevel: 'second',
						experienceLevel: 'learning',
						interests: 'web',
						clubGoals: 'More project nights'
					}
				})
			)
		).resolves.toEqual({ joined: true });
		expect(joinProgrammingClub).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: SESSION.userId,
				email: SESSION.email,
				username: 'ada_codes',
				firstName: 'Ada',
				lastName: 'Lovelace',
				yearLevel: 'second',
				clubGoals: 'More project nights',
				profileImageDataUrl: null
			})
		);
		expect(JSON.stringify(joinProgrammingClub.mock.calls)).not.toContain('nimAccepted');
	});

	it('saves an optional Omnivox schedule during onboarding', async () => {
		const saveSchedule = vi.fn(async () => ({}));
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createRepository: vi.fn(() => ({ getProfile: vi.fn(async () => null), saveSchedule })),
			isGoogleSignInConfigured: vi.fn(() => true)
		});
		const result = await current.actions.saveOnboardingSchedule(
			event({
				locals: { maritools: SESSION },
				form: { paste: CANONICAL_OMNIVOX_SCHEDULE }
			})
		);
		expect(result).toEqual({ scheduleSaved: true });
		expect(saveSchedule).toHaveBeenCalledWith({
			userId: SESSION.userId,
			paste: CANONICAL_OMNIVOX_SCHEDULE
		});
	});

	it('validates and saves every signup step from the final submission without a confirmation checkbox', async () => {
		const joinProgrammingClub = vi.fn(async () => ({}));
		const saveSchedule = vi.fn(async () => ({}));
		const completeRequiredForm = vi.fn(async () => ({ requiredFormCompletedAt: new Date() }));
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createRepository: vi.fn(() => ({ getProfile: vi.fn(async () => null), saveSchedule })),
			createClubRepository: vi.fn(() => ({ joinProgrammingClub, completeRequiredForm })),
			isGoogleSignInConfigured: vi.fn(() => true)
		});

		await expect(
			current.actions.finishOnboarding(
				event({
					locals: { maritools: SESSION },
					form: {
						studentId: '2530622',
						username: 'ada_codes',
						firstName: 'Ada',
						lastName: 'Lovelace',
						program: 'Science, Pure and Applied Science',
						yearLevel: 'second',
						experienceLevel: 'learning',
						interests: 'web',
						clubGoals: 'More project nights',
						paste: CANONICAL_OMNIVOX_SCHEDULE
					}
				})
			)
		).resolves.toEqual({ onboardingComplete: true });
		expect(joinProgrammingClub).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: SESSION.userId,
				email: SESSION.email,
				studentId: '2530622',
				username: 'ada_codes',
				firstName: 'Ada',
				lastName: 'Lovelace',
				program: 'Science, Pure and Applied Science',
				yearLevel: 'second',
				experienceLevel: 'learning',
				interests: ['web'],
				clubGoals: 'More project nights',
				profileImageDataUrl: null
			})
		);
		expect(saveSchedule).toHaveBeenCalledWith({
			userId: SESSION.userId,
			paste: CANONICAL_OMNIVOX_SCHEDULE
		});
		expect(completeRequiredForm).toHaveBeenCalledWith(SESSION.userId);
	});

	it('does not require a schedule in the final signup submission', async () => {
		const joinProgrammingClub = vi.fn(async () => ({}));
		const saveSchedule = vi.fn(async () => ({}));
		const completeRequiredForm = vi.fn(async () => ({}));
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createRepository: vi.fn(() => ({ getProfile: vi.fn(async () => null), saveSchedule })),
			createClubRepository: vi.fn(() => ({ joinProgrammingClub, completeRequiredForm })),
			isGoogleSignInConfigured: vi.fn(() => true)
		});

		await expect(
			current.actions.finishOnboarding(
				event({
					locals: { maritools: SESSION },
					form: {
						studentId: '2530622',
						username: 'ada_codes',
						firstName: 'Ada',
						lastName: 'Lovelace',
						program: 'Science, Pure and Applied Science',
						yearLevel: 'second',
						experienceLevel: 'learning',
						interests: 'web'
					}
				})
			)
		).resolves.toEqual({ onboardingComplete: true });
		expect(joinProgrammingClub).toHaveBeenCalledOnce();
		expect(saveSchedule).not.toHaveBeenCalled();
		expect(completeRequiredForm).toHaveBeenCalledWith(SESSION.userId);
	});

	it('finishes a returning partial signup without exposing or resubmitting the saved student number', async () => {
		const joinProgrammingClub = vi.fn(async () => ({}));
		const completeRequiredForm = vi.fn(async () => ({}));
		const getMyClubOnboarding = vi.fn(async () => ({ requiredFormCompletedAt: null }));
		const getProfile = vi.fn(async () => ({ username: 'ada_codes' }));
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createRepository: vi.fn(() => ({ getProfile, saveSchedule: vi.fn() })),
			createClubRepository: vi.fn(() => ({
				joinProgrammingClub,
				completeRequiredForm,
				getMyClubOnboarding
			})),
			isGoogleSignInConfigured: vi.fn(() => true)
		});

		await expect(
			current.actions.finishOnboarding(
				event({
					locals: { maritools: SESSION },
					form: {
						studentId: '',
						username: 'ada_codes',
						firstName: 'Ada',
						lastName: 'Lovelace',
						program: 'Science, Pure and Applied Science',
						yearLevel: 'second',
						experienceLevel: 'learning',
						interests: 'web'
					}
				})
			)
		).resolves.toEqual({ onboardingComplete: true });
		expect(getMyClubOnboarding).toHaveBeenCalledWith(SESSION.userId);
		expect(getProfile).not.toHaveBeenCalled();
		expect(joinProgrammingClub).not.toHaveBeenCalled();
		expect(completeRequiredForm).toHaveBeenCalledWith(SESSION.userId);
	});

	it('blocks only final signup submission when required details are invalid', async () => {
		const joinProgrammingClub = vi.fn(async () => {
			throw new ClubInputError('invalid-program');
		});
		const saveSchedule = vi.fn(async () => ({}));
		const completeRequiredForm = vi.fn(async () => ({}));
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN })),
			createRepository: vi.fn(() => ({ getProfile: vi.fn(async () => null), saveSchedule })),
			createClubRepository: vi.fn(() => ({ joinProgrammingClub, completeRequiredForm })),
			isGoogleSignInConfigured: vi.fn(() => true)
		});

		const result = /** @type {any} */ (await current.actions.finishOnboarding(
			event({
				locals: { maritools: SESSION },
				form: {
					studentId: '2530622',
					username: 'ada_codes',
					firstName: 'Ada',
					lastName: 'Lovelace',
					program: '',
					yearLevel: 'second',
					experienceLevel: 'learning',
					interests: 'web'
				}
			})
		));
		expect(result.status).toBe(400);
		expect(result.data.error).toBe('Check each required signup field.');
		expect(saveSchedule).not.toHaveBeenCalled();
		expect(completeRequiredForm).not.toHaveBeenCalled();
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

	it('uses the default Google configuration check', async () => {
		const current = _createHandlers({
			readEnvironment: vi.fn(() => ({ appOrigin: ORIGIN }))
		});

		const data = await current.load(event());
		expect(data.googleSignInConfigured).toBeTypeOf('boolean');
	});

	it('rethrows unexpected environment failures', async () => {
		const current = handlers({
			readEnvironment: vi.fn(() => {
				throw new TypeError('bad environment');
			})
		});

		await expect(current.load(event())).rejects.toThrow('bad environment');
	});

	it('loads saved schedule text and normalizes nullable community fields', async () => {
		const getSchedule = vi.fn(async () => CANONICAL_OMNIVOX_SCHEDULE);
		const current = handlers({
			repository: {
				getProfile: vi.fn(async () => ({ username: 'Ada' })),
				getSchedule,
				listOutlines: vi.fn(async () => [
					{ sha256: 'ab'.repeat(32), createdAt: null, extraction: null }
				])
			},
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => ({ requiredFormCompletedAt: new Date() }))
			})),
			createCommunityRepository: vi.fn(() => ({
				listThreadsByAuthor: vi.fn(async () => [])
			}))
		});

		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(getSchedule).toHaveBeenCalledWith(SESSION.userId);
		expect(data.onboardingDraft.paste).toBe(CANONICAL_OMNIVOX_SCHEDULE);
		expect(data.communityProfile).toEqual({ joinedAt: null, role: 'student' });
		expect(data.courseOutlines).toEqual([
			{ sha256: 'ab'.repeat(32), createdAt: null, extraction: null }
		]);
	});

	it('covers join authorization, defaults, and mapped failures', async () => {
		const noSession = await handlers().actions.join(event());
		expect(noSession.status).toBe(401);

		const joinProgrammingClub = vi.fn(async () => ({}));
		const current = handlers({
			createClubRepository: vi.fn(() => ({ joinProgrammingClub }))
		});
		await expect(current.actions.join(event({ locals: { maritools: SESSION } }))).resolves.toEqual({
			joined: true
		});
		expect(joinProgrammingClub).toHaveBeenCalledWith({
			userId: SESSION.userId,
			email: SESSION.email,
			studentId: '',
			username: '',
			firstName: '',
			lastName: '',
			profileImageDataUrl: null,
			program: '',
			yearLevel: '',
			experienceLevel: '',
			interests: [],
			clubGoals: ''
		});

		for (const [failure, status] of [
			[new ClubInputError('invalid-program'), 400],
			[new ClubUnavailableError(), 503]
		]) {
			const failed = handlers({
				createClubRepository: vi.fn(() => ({
					joinProgrammingClub: vi.fn(async () => {
						throw failure;
					})
				}))
			});
			expect((await failed.actions.join(event({ locals: { maritools: SESSION } }))).status).toBe(
				status
			);
		}
	});

	it('maps invalid join images and rethrows unexpected join failures', async () => {
		const invalidImage = handlers({
			createClubRepository: vi.fn(() => ({ joinProgrammingClub: vi.fn() }))
		});
		const imageEvent = event({ locals: { maritools: SESSION } });
		imageEvent.request.formData = async () => {
			const data = new FormData();
			data.set('profileImage', new File(['text'], 'avatar.txt', { type: 'text/plain' }));
			return data;
		};
		const invalidResult = await invalidImage.actions.join(imageEvent);
		expect(invalidResult.status).toBe(400);
		expect(invalidResult.data.error).toMatch(/JPG/);

		const unexpected = handlers({
			createClubRepository: vi.fn(() => ({
				joinProgrammingClub: vi.fn(async () => {
					throw new Error('join failed');
				})
			}))
		});
		await expect(
			unexpected.actions.join(event({ locals: { maritools: SESSION } }))
		).rejects.toThrow('join failed');
	});

	it('rethrows unexpected profile update failures with empty form defaults', async () => {
		const current = handlers({
			createClubRepository: vi.fn(() => ({
				updateMemberProfile: vi.fn(async (input) => {
					expect(input).toEqual({
						userId: SESSION.userId,
						username: '',
						firstName: '',
						lastName: ''
					});
					throw new Error('update failed');
				})
			}))
		});

		await expect(
			current.actions.updateProfile(event({ locals: { maritools: SESSION } }))
		).rejects.toThrow('update failed');
	});

	it('covers onboarding schedule authorization, validation, and failures', async () => {
		expect((await handlers().actions.saveOnboardingSchedule(event())).status).toBe(401);

		const invalid = await handlers().actions.saveOnboardingSchedule(
			event({ locals: { maritools: SESSION } })
		);
		expect(invalid.status).toBe(400);

		const unavailable = handlers({
			repository: {
				saveSchedule: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(
				await unavailable.actions.saveOnboardingSchedule(
					event({ locals: { maritools: SESSION }, form: { paste: CANONICAL_OMNIVOX_SCHEDULE } })
				)
			).status
		).toBe(503);

		const unexpected = handlers({
			repository: {
				saveSchedule: vi.fn(async () => {
					throw new Error('schedule failed');
				})
			}
		});
		await expect(
			unexpected.actions.saveOnboardingSchedule(
				event({ locals: { maritools: SESSION }, form: { paste: CANONICAL_OMNIVOX_SCHEDULE } })
			)
		).rejects.toThrow('schedule failed');
	});

	it('blocks unauthorized and invalid final onboarding submissions', async () => {
		expect((await handlers().actions.finishOnboarding(event())).status).toBe(401);
		const invalid = await handlers().actions.finishOnboarding(
			event({ locals: { maritools: SESSION }, form: { paste: 'not an Omnivox schedule' } })
		);
		expect(invalid.status).toBe(400);
		expect(invalid.data.invalidTab).toBe('schedule');
	});

	it('uses empty final onboarding defaults and accepts an empty profile image', async () => {
		const joinProgrammingClub = vi.fn(async () => ({}));
		const completeRequiredForm = vi.fn(async () => ({}));
		const current = handlers({
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => null),
				joinProgrammingClub,
				completeRequiredForm
			}))
		});
		const finishEvent = event({ locals: { maritools: SESSION } });
		finishEvent.request.formData = async () => {
			const data = new FormData();
			data.set('profileImage', new File([], 'avatar.png', { type: 'image/png' }));
			return data;
		};

		await expect(current.actions.finishOnboarding(finishEvent)).resolves.toEqual({
			onboardingComplete: true
		});
		expect(joinProgrammingClub).toHaveBeenCalledWith({
			userId: SESSION.userId,
			email: SESSION.email,
			studentId: '',
			username: '',
			firstName: '',
			lastName: '',
			profileImageDataUrl: null,
			program: '',
			yearLevel: '',
			experienceLevel: '',
			interests: [],
			clubGoals: ''
		});
	});

	it('rejoins when a blank student number has no saved membership', async () => {
		const joinProgrammingClub = vi.fn(async () => ({}));
		const completeRequiredForm = vi.fn(async () => ({}));
		const current = handlers({
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => null),
				joinProgrammingClub,
				completeRequiredForm
			}))
		});

		await expect(
			current.actions.finishOnboarding(
				event({ locals: { maritools: SESSION }, form: { studentId: '' } })
			)
		).resolves.toEqual({ onboardingComplete: true });
		expect(joinProgrammingClub).toHaveBeenCalledOnce();
	});

	it('maps final onboarding failures to their owning step', async () => {
		const invalidImage = handlers({
			createClubRepository: vi.fn(() => ({
				getMyClubOnboarding: vi.fn(async () => null),
				joinProgrammingClub: vi.fn()
			}))
		});
		const imageEvent = event({ locals: { maritools: SESSION } });
		imageEvent.request.formData = async () => {
			const data = new FormData();
			data.set('profileImage', new File(['text'], 'avatar.txt', { type: 'text/plain' }));
			return data;
		};
		const imageResult = await invalidImage.actions.finishOnboarding(imageEvent);
		expect(imageResult.status).toBe(400);
		expect(imageResult.data.invalidTab).toBe('information');

		const memberFormInput = handlers({
			createClubRepository: vi.fn(() => ({
				completeRequiredForm: vi.fn(async () => {
					throw new ClubInputError('missing-club-details');
				})
			}))
		});
		const memberFormResult = await memberFormInput.actions.finishOnboarding(
			event({ locals: { maritools: SESSION } })
		);
		expect(memberFormResult.status).toBe(400);
		expect(memberFormResult.data.invalidTab).toBe('member-form');

		const clubUnavailable = handlers({
			createClubRepository: vi.fn(() => ({
				completeRequiredForm: vi.fn(async () => {
					throw new ClubUnavailableError();
				})
			}))
		});
		expect(
			(await clubUnavailable.actions.finishOnboarding(event({ locals: { maritools: SESSION } })))
				.status
		).toBe(503);
	});

	it('distinguishes member-form and schedule storage failures', async () => {
		const memberFormUnavailable = handlers({
			createClubRepository: vi.fn(() => ({
				completeRequiredForm: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}))
		});
		expect(
			(
				await memberFormUnavailable.actions.finishOnboarding(
					event({ locals: { maritools: SESSION } })
				)
			).status
		).toBe(503);

		const scheduleUnavailable = handlers({
			repository: {
				saveSchedule: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			},
			createClubRepository: vi.fn(() => ({ completeRequiredForm: vi.fn() }))
		});
		const result = await scheduleUnavailable.actions.finishOnboarding(
			event({ locals: { maritools: SESSION }, form: { paste: CANONICAL_OMNIVOX_SCHEDULE } })
		);
		expect(result.status).toBe(503);
		expect(result.data.invalidTab).toBe('schedule');
	});

	it('rethrows unexpected final onboarding failures', async () => {
		const current = handlers({
			createClubRepository: vi.fn(() => ({
				completeRequiredForm: vi.fn(async () => {
					throw new Error('finish failed');
				})
			}))
		});

		await expect(
			current.actions.finishOnboarding(event({ locals: { maritools: SESSION } }))
		).rejects.toThrow('finish failed');
	});
});
