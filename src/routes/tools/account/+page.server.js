import { fail, redirect } from '@sveltejs/kit';
import { Buffer } from 'node:buffer';
import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
import {
	ServerConfigurationError,
	isGoogleOAuthConfigured,
	readStaffSignInEnvironment
} from '$lib/server/config/environment.js';
import { accountPageView } from '$lib/server/maritools/community.js';
import { openCommunityStore } from '$lib/server/maritools/community-store.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openStudentStore
} from '$lib/server/maritools/student-store.js';
import {
	CLUB_INTERESTS,
	MARIANOPOLIS_PROGRAMS,
	YEAR_LEVELS,
	ClubInputError,
	ClubUnavailableError,
	openClubStore
} from '$lib/server/maritools/club-store.js';

export const prerender = false;

const REQUIRED_MEMBERSHIP_FORM_URL =
	'https://forms.cloud.microsoft/pages/responsepage.aspx?id=gM4FyXMGa02pnxlDYrX7rr5-iZTtVRdEtoDBmsFVUSFUQlc3REk4VE1aRkg0RjJMMEU0RDZPWFZaUy4u&route=shorturl';
const PROFILE_IMAGE_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const PROFILE_IMAGE_MAX_BYTES = 512 * 1024;

/** @param {FormDataEntryValue | null} value */
async function readProfileImage(value) {
	if (!value || typeof value === 'string' || value.size === 0) return null;
	if (!PROFILE_IMAGE_TYPES.has(value.type) || value.size > PROFILE_IMAGE_MAX_BYTES) {
		throw new ClubInputError('invalid-profile-image');
	}
	return `data:${value.type};base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
}

/** @param {string | null} state */
function recoveryMessageFor(state) {
	if (state === 'unavailable') return 'We could not finish sign-in. Try again.';
	return null;
}

/**
 * Stale OAuth error callbacks can land on ?state=unavailable after a later
 * attempt already created a session. Drop the query so signed-in users never
 * see a contradictory failure banner.
 * @param {URL} url
 * @param {unknown} session
 */
function clearStaleSignInFailure(url, session) {
	if (!session || url.searchParams.get('state') !== 'unavailable') return;
	const clean = new URL(url);
	clean.searchParams.delete('state');
	throw redirect(303, `${clean.pathname}${clean.search}`);
}

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const readEnvironment = dependencies.readEnvironment ?? readStaffSignInEnvironment;
	const createRepository = dependencies.createRepository ?? openStudentStore;
	const createClubRepository = dependencies.createClubRepository ?? openClubStore;
	const createCommunityRepository = dependencies.createCommunityRepository ?? openCommunityStore;
	const googleSignInConfigured =
		dependencies.isGoogleSignInConfigured ?? (() => isGoogleOAuthConfigured());

	/** @param {any} event */
	async function load(event) {
		const signInConfigured = googleSignInConfigured();
		const session = event.locals.maritools ?? null;
		clearStaleSignInFailure(event.url, session);
		let appOrigin;
		try {
			({ appOrigin } = readEnvironment());
		} catch (error) {
			if (error instanceof ServerConfigurationError) {
				return {
					view: accountPageView(session, null),
					callbackURL: `${event.url.origin}/tools/account`,
					recoveryMessage: recoveryMessageFor(event.url.searchParams.get('state')),
					googleSignInConfigured: signInConfigured,
					onboardingPending: true,
					requiredFormUrl: REQUIRED_MEMBERSHIP_FORM_URL,
					programs: MARIANOPOLIS_PROGRAMS,
					yearLevels: YEAR_LEVELS,
					clubInterests: CLUB_INTERESTS,
					...(session ? { unavailable: true } : {})
				};
			}
			throw error;
		}
		let profile = null;
		let membership = null;
		let schedulePaste = '';
		let recentPosts = [];
		let courseOutlines = [];
		/** @type {{ kind: string, scheduleSharedAt?: Date | string | null }} */
		let club = session ? { kind: 'needs_club_details' } : { kind: 'signed_out' };
		let unavailable = false;
		if (session) {
			try {
				const repository = createRepository();
				profile = await repository.getProfile(session.userId);
				if (typeof repository.getSchedule === 'function') {
					schedulePaste = await repository.getSchedule(session.userId);
				}
			} catch {
				unavailable = true;
			}
			try {
				membership = await createClubRepository().getMyClubOnboarding(session.userId);
				if (membership) {
					club = membership.requiredFormCompletedAt
						? {
								kind: membership.scheduleSharedAt
									? 'joined_with_shared_schedule'
									: 'joined_without_schedule',
								scheduleSharedAt: membership.scheduleSharedAt ?? null
							}
						: { kind: 'needs_required_form' };
				}
			} catch {
				unavailable = true;
			}
		}
		const communityProfile =
			profile && membership?.requiredFormCompletedAt
				? { joinedAt: membership.createdAt ?? null, role: profile.role ?? 'student' }
				: null;
		if (communityProfile) {
			try {
				const outlines = await createRepository().listOutlines(session.userId);
				courseOutlines = Array.isArray(outlines)
					? outlines.map((outline) => ({
							sha256: outline.sha256,
							createdAt: outline.createdAt ?? null,
							extraction: outline.extraction ?? null
						}))
					: [];
			} catch {
				courseOutlines = [];
			}
			try {
				recentPosts = await createCommunityRepository().listThreadsByAuthor(session.userId);
				if (!Array.isArray(recentPosts)) recentPosts = [];
			} catch {
				recentPosts = [];
			}
		}
		const onboardingDraft =
			session && (profile || membership)
				? {
						// Keep the student number server-side. A returning member can still
						// retry because finishOnboarding reuses the saved value when needed.
						studentId: '',
						username: profile?.username ?? '',
						firstName: profile?.firstName ?? '',
						lastName: profile?.lastName ?? '',
						program: membership?.program ?? '',
						yearLevel: membership?.yearLevel ?? '',
						experienceLevel: membership?.experienceLevel ?? '',
						interests: Array.isArray(membership?.interests) ? membership.interests : [],
						clubGoals: membership?.clubGoals ?? '',
						paste: schedulePaste
					}
				: null;
		return {
			view: accountPageView(session, profile),
			callbackURL: `${appOrigin}/tools/account`,
			recoveryMessage: recoveryMessageFor(event.url.searchParams.get('state')),
			googleSignInConfigured: signInConfigured,
			onboardingPending:
				!session || club.kind === 'needs_club_details' || club.kind === 'needs_required_form',
			requiredFormUrl: REQUIRED_MEMBERSHIP_FORM_URL,
			...(onboardingDraft ? { onboardingDraft } : {}),
			club,
			...(communityProfile ? { communityProfile, recentPosts, courseOutlines } : {}),
			clubInterests: CLUB_INTERESTS,
			programs: MARIANOPOLIS_PROGRAMS,
			yearLevels: YEAR_LEVELS,
			...(unavailable ? { unavailable: true } : {})
		};
	}

	/** @param {any} event */
	async function complete(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		try {
			await createRepository().completeProfile({
				userId: session.userId,
				email: session.email,
				studentId: String(data.get('studentId') ?? ''),
				displayName: String(data.get('displayName') ?? '')
			});
			return { success: true };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Enter your student number as 5 to 8 digits.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Saving your account is unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function join(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		try {
			await createClubRepository().joinProgrammingClub({
				userId: session.userId,
				email: session.email,
				studentId: String(data.get('studentId') ?? ''),
				username: String(data.get('username') ?? ''),
				firstName: String(data.get('firstName') ?? ''),
				lastName: String(data.get('lastName') ?? ''),
				profileImageDataUrl: await readProfileImage(data.get('profileImage')),
				program: String(data.get('program') ?? ''),
				yearLevel: String(data.get('yearLevel') ?? ''),
				experienceLevel: String(data.get('experienceLevel') ?? ''),
				interests: data.getAll('interests').map(String),
				clubGoals: String(data.get('clubGoals') ?? '')
			});
			return { joined: true };
		} catch (error) {
			if (error instanceof ClubInputError) {
				if (error.code === 'invalid-profile-image') {
					return fail(400, { error: 'Choose a JPG, PNG, WebP, or GIF under 512 KB.' });
				}
				return fail(400, { error: 'Check each required signup field.' });
			}
			if (error instanceof ClubUnavailableError)
				return fail(503, { error: 'Joining the club is unavailable. Try again.' });
			throw error;
		}
	}

	/** @param {any} event */
	async function updateProfile(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		try {
			const profileImageDataUrl = await readProfileImage(data.get('profileImage'));
			await createClubRepository().updateMemberProfile({
				userId: session.userId,
				username: String(data.get('username') ?? ''),
				firstName: String(data.get('firstName') ?? ''),
				lastName: String(data.get('lastName') ?? ''),
				...(profileImageDataUrl ? { profileImageDataUrl } : {})
			});
			return { profileUpdated: true };
		} catch (error) {
			if (error instanceof ClubInputError) {
				if (error.code === 'invalid-profile-image') {
					return fail(400, { error: 'Choose a JPG, PNG, WebP, or GIF under 512 KB.' });
				}
				return fail(400, { error: 'Check your username and name.' });
			}
			if (error instanceof ClubUnavailableError) {
				return fail(503, { error: 'Updating your profile is unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function saveOnboardingSchedule(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { saveError: 'Sign in with Google first.' });
		const data = await event.request.formData();
		const paste = String(data.get('paste') ?? '');
		if (!parseOmnivox(paste).ok) {
			return fail(400, { saveError: 'Paste the numbered course list from Omnivox.' });
		}
		try {
			await createRepository().saveSchedule({ userId: session.userId, paste });
			return { scheduleSaved: true };
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { saveError: 'We could not save your schedule. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function finishOnboarding(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		const paste = String(data.get('paste') ?? '');
		const hasSchedule = paste.trim().length > 0;
		const hasClubDetails = [
			'studentId',
			'username',
			'firstName',
			'lastName',
			'program',
			'yearLevel',
			'experienceLevel',
			'interests',
			'clubGoals',
			'profileImage'
		].some((name) => data.has(name));

		// The schedule is optional, but an attempted import must be valid before
		// any profile or membership data is written.
		if (hasSchedule && !parseOmnivox(paste).ok) {
			return fail(400, {
				error: 'Paste the numbered course list from Omnivox.',
				invalidTab: 'schedule'
			});
		}

		let stage = hasClubDetails ? 'club-details' : 'member-form';
		try {
			if (hasClubDetails) {
				const studentId = String(data.get('studentId') ?? '');
				const existingMembership = studentId.trim()
					? null
					: await createClubRepository().getMyClubOnboarding(session.userId);
				if (!existingMembership)
					await createClubRepository().joinProgrammingClub({
						userId: session.userId,
						email: session.email,
						studentId,
						username: String(data.get('username') ?? ''),
						firstName: String(data.get('firstName') ?? ''),
						lastName: String(data.get('lastName') ?? ''),
						profileImageDataUrl: await readProfileImage(data.get('profileImage')),
						program: String(data.get('program') ?? ''),
						yearLevel: String(data.get('yearLevel') ?? ''),
						experienceLevel: String(data.get('experienceLevel') ?? ''),
						interests: data.getAll('interests').map(String),
						clubGoals: String(data.get('clubGoals') ?? '')
					});
			}
			if (hasSchedule) {
				stage = 'schedule';
				await createRepository().saveSchedule({ userId: session.userId, paste });
			}
			stage = 'member-form';
			await createClubRepository().completeRequiredForm(session.userId);
			return { onboardingComplete: true };
		} catch (error) {
			if (error instanceof ClubInputError) {
				if (error.code === 'invalid-profile-image') {
					return fail(400, {
						error: 'Choose a JPG, PNG, WebP, or GIF under 512 KB.',
						invalidTab: 'information'
					});
				}
				return fail(400, {
					error:
						stage === 'club-details'
							? 'Check each required signup field.'
							: 'Complete your club details before finishing signup.',
					invalidTab: stage === 'club-details' ? 'information' : 'member-form'
				});
			}
			if (error instanceof ClubUnavailableError) {
				return fail(503, { error: 'Finishing signup is unavailable. Try again.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				if (stage !== 'schedule') {
					return fail(503, { error: 'Finishing signup is unavailable. Try again.' });
				}
				return fail(503, {
					error: 'We could not save your schedule. Try again.',
					invalidTab: 'schedule'
				});
			}
			throw error;
		}
	}

	return {
		load,
		actions: { complete, join, updateProfile, saveOnboardingSchedule, finishOnboarding }
	};
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
