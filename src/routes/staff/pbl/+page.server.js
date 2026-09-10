import { requireStaff } from '$lib/server/auth/authorization.js';
import { createPblRuntime, pblErrorResponse } from '$lib/server/pbl/http.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createStaffPblHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const runtime = createPblRuntime(dependencies);
	return Object.freeze({
		/** @param {any} event */
		async load(event) {
			authorize(event.locals);
			try {
				const rooms = await runtime.withStore((store) => store.listStaffRooms());
				return { rooms, unavailable: false };
			} catch (error) {
				const response = pblErrorResponse(error);
				if (response.status === 503) {
					return { rooms: [], unavailable: true };
				}
				throw error;
			}
		}
	});
}

export const load = _createStaffPblHandlers().load;
