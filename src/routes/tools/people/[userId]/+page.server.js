import { error, fail } from '@sveltejs/kit';
import { parseModerationDuration } from '$lib/maritools/moderation-duration.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openCommunityStore
} from '$lib/server/maritools/community-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createPublicProfileHandlers(dependencies = {}) {
	const createStore = dependencies.createStore ?? openCommunityStore;

	/**
	 * @param {any} event
	 * @param {ReturnType<typeof createStore>} store
	 */
	async function staffContext(event, store) {
		const session = event.locals.maritools ?? null;
		if (!session) return { session: null, staff: false };
		let profile = null;
		try {
			profile = await store.getProfile(session.userId);
		} catch (err) {
			if (!(err instanceof MaritoolsUnavailableError)) throw err;
		}
		return { session, staff: store.isStaff(session.email, profile?.role ?? null) };
	}

	/** @param {Record<string, any>} profile */
	function publicProfile(profile) {
		return {
			userId: profile.userId,
			displayName: profile.displayName,
			username: profile.username,
			profileImageDataUrl: profile.profileImageDataUrl,
			role: profile.role,
			joinedAt: profile.joinedAt
		};
	}

	/** @param {Record<string, any>} profile @param {boolean} viewerIsStaff */
	function profileForViewer(profile, viewerIsStaff) {
		const view = publicProfile(profile);
		if (!viewerIsStaff) return view;
		return {
			...view,
			isRestricted: profile.isRestricted,
			isMuted: profile.isMuted,
			isBanned: profile.isBanned,
			mutedUntil: profile.mutedUntil,
			bannedUntil: profile.bannedUntil,
			bannedPermanent: profile.bannedPermanent
		};
	}

	return Object.freeze({
		/** @param {any} event */
		async load(event) {
			const userId = String(event.params.userId ?? '').trim();
			if (!userId) throw error(404, 'That profile is not available.');
			try {
				const store = createStore();
				const identity = await staffContext(event, store);
				const profile = await store.getPublicProfile(userId);
				if (!profile) throw error(404, 'That profile is not available.');
				const [threads, courseOutlines] = await Promise.all([
					store.listThreadsByAuthor(userId),
					store.listOutlinesByAuthor(userId)
				]);
				return {
					profile: profileForViewer(profile, identity.staff),
					threads,
					courseOutlines,
					unavailable: false,
					viewerSignedIn: Boolean(identity.session),
					viewerIsStaff: identity.staff
				};
			} catch (err) {
				if (err && typeof err === 'object' && 'status' in err) throw err;
				if (err instanceof MaritoolsUnavailableError) {
					return {
						profile: null,
						threads: [],
						courseOutlines: [],
						unavailable: true,
						viewerSignedIn: Boolean(event.locals.maritools),
						viewerIsStaff: false
					};
				}
				throw err;
			}
		},
		actions: Object.freeze({
			/** @param {any} event */
			async mute(event) {
				const store = createStore();
				const identity = await staffContext(event, store);
				if (!identity.staff) return fail(403, { error: 'This action requires team access.' });
				const userId = String(event.params.userId ?? '').trim();
				const data = await event.request.formData();
				try {
					const duration = parseModerationDuration(data, 'mute');
					await store.muteUser(userId, { until: duration.until });
					return { moderated: 'mute' };
				} catch (err) {
					if (err instanceof MaritoolsInputError) {
						return fail(400, { error: 'Could not mute that account.' });
					}
					if (err instanceof MaritoolsUnavailableError) {
						return fail(503, { error: 'Moderation is unavailable. Try again.' });
					}
					throw err;
				}
			},
			/** @param {any} event */
			async ban(event) {
				const store = createStore();
				const identity = await staffContext(event, store);
				if (!identity.staff) return fail(403, { error: 'This action requires team access.' });
				const userId = String(event.params.userId ?? '').trim();
				const data = await event.request.formData();
				try {
					const duration = parseModerationDuration(data, 'ban');
					await store.banUser(
						userId,
						duration.permanent ? { permanent: true } : { until: duration.until }
					);
					return { moderated: 'ban' };
				} catch (err) {
					if (err instanceof MaritoolsInputError) {
						return fail(400, { error: 'Could not ban that account.' });
					}
					if (err instanceof MaritoolsUnavailableError) {
						return fail(503, { error: 'Moderation is unavailable. Try again.' });
					}
					throw err;
				}
			},
			/** @param {any} event */
			async unmute(event) {
				const store = createStore();
				const identity = await staffContext(event, store);
				if (!identity.staff) return fail(403, { error: 'This action requires team access.' });
				const userId = String(event.params.userId ?? '').trim();
				try {
					await store.unmuteUser(userId);
					return { moderated: 'unmute' };
				} catch (err) {
					if (err instanceof MaritoolsInputError) {
						return fail(400, { error: 'Could not unmute that account.' });
					}
					if (err instanceof MaritoolsUnavailableError) {
						return fail(503, { error: 'Moderation is unavailable. Try again.' });
					}
					throw err;
				}
			},
			/** @param {any} event */
			async unban(event) {
				const store = createStore();
				const identity = await staffContext(event, store);
				if (!identity.staff) return fail(403, { error: 'This action requires team access.' });
				const userId = String(event.params.userId ?? '').trim();
				try {
					await store.unbanUser(userId);
					return { moderated: 'unban' };
				} catch (err) {
					if (err instanceof MaritoolsInputError) {
						return fail(400, { error: 'Could not unban that account.' });
					}
					if (err instanceof MaritoolsUnavailableError) {
						return fail(503, { error: 'Moderation is unavailable. Try again.' });
					}
					throw err;
				}
			}
		})
	});
}

const handlers = _createPublicProfileHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
