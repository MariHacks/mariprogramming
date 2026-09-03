import { error, fail } from '@sveltejs/kit';
import { parseModerationDuration } from '$lib/maritools/moderation-duration.js';
import { requireStaff } from '$lib/server/auth/authorization.js';
import {
	ClubInputError,
	ClubUnavailableError,
	openClubStore
} from '$lib/server/maritools/club-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createStaffMemberDetailHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const createStore = dependencies.createStore ?? openClubStore;

	/** @param {any} event @param {'mute' | 'ban' | 'unmute' | 'unban' | 'promote' | 'demote'} control */
	async function applyControl(event, control) {
		authorize(event.locals);
		const userId = String(event.params.userId ?? '').trim();
		if (!userId) return fail(400, { error: 'Pick a member first.' });
		try {
			const store = createStore();
			if (control === 'mute') {
				const data = await event.request.formData();
				const duration = parseModerationDuration(data, 'mute');
				await store.muteMember(userId, duration.until);
			} else if (control === 'ban') {
				const data = await event.request.formData();
				const duration = parseModerationDuration(data, 'ban');
				await store.banMember(
					userId,
					duration.permanent ? { permanent: true } : { until: duration.until }
				);
			} else if (control === 'unmute') await store.unmuteMember(userId);
			else if (control === 'unban') await store.unbanMember(userId);
			else if (control === 'promote') await store.promoteMember(userId);
			else await store.demoteMember(userId);
			return { updated: true, control };
		} catch (failure) {
			if (failure instanceof ClubInputError) {
				return fail(400, { error: 'That member control could not be applied.' });
			}
			if (failure instanceof ClubUnavailableError) {
				return fail(503, { error: 'Member controls are unavailable. Try again.' });
			}
			throw failure;
		}
	}

	return Object.freeze({
		/** @param {any} event */
		async load(event) {
			authorize(event.locals);
			try {
				const member = await createStore().getStaffClubMember(event.params.userId);
				if (!member) error(404, 'Club member not found');
				return { member, unavailable: false };
			} catch (failure) {
				if (failure instanceof ClubUnavailableError) return { member: null, unavailable: true };
				throw failure;
			}
		},
		actions: Object.freeze({
			/** @param {any} event */
			mute: (event) => applyControl(event, 'mute'),
			/** @param {any} event */
			ban: (event) => applyControl(event, 'ban'),
			/** @param {any} event */
			unmute: (event) => applyControl(event, 'unmute'),
			/** @param {any} event */
			unban: (event) => applyControl(event, 'unban'),
			/** @param {any} event */
			promoteExecutive: (event) => applyControl(event, 'promote'),
			/** @param {any} event */
			demoteMember: (event) => applyControl(event, 'demote')
		})
	});
}

const handlers = _createStaffMemberDetailHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
