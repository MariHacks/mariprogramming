import { requireStaff } from '$lib/server/auth/authorization.js';
import { ClubUnavailableError, openClubStore } from '$lib/server/maritools/club-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createStaffMembersHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const createStore = dependencies.createStore ?? openClubStore;
	return Object.freeze({
		/** @param {any} event */
		async load(event) {
			authorize(event.locals);
			try {
				const store = createStore();
				const [listing, availability] = await Promise.all([
					store.listStaffClubMembers({
						query: event.url.searchParams.get('q') ?? '',
						page: event.url.searchParams.get('page') ?? '1'
					}),
					store.getStaffMeetingAvailability()
				]);
				return { listing, availability, unavailable: false };
			} catch (error) {
				if (error instanceof ClubUnavailableError) {
					return {
						listing: { rows: [], totalCount: 0, page: 1, pageSize: 25 },
						availability: { denominator: 0, invalidScheduleCount: 0, cells: [] },
						unavailable: true
					};
				}
				throw error;
			}
		}
	});
}

export const load = _createStaffMembersHandlers().load;
