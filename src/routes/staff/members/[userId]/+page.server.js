import { error } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';
import { ClubUnavailableError, openClubStore } from '$lib/server/maritools/club-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createStaffMemberDetailHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const createStore = dependencies.createStore ?? openClubStore;
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
		}
	});
}

export const load = _createStaffMemberDetailHandlers().load;
