import { error } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';
import { createPblRuntime, pblErrorResponse } from '$lib/server/pbl/http.js';
import { PblNotFoundError } from '$lib/server/pbl/store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createStaffPblDetailHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const runtime = createPblRuntime(dependencies);
	return Object.freeze({
		/** @param {any} event */
		async load(event) {
			authorize(event.locals);
			try {
				const room = await runtime.withStore((store) => store.getStaffRoom(event.params.code));
				return { room, unavailable: false };
			} catch (failure) {
				if (failure instanceof PblNotFoundError) error(404, 'Room not found');
				const response = pblErrorResponse(failure);
				if (response.status === 503) {
					return { room: null, unavailable: true };
				}
				if (response.status === 400 || response.status === 404) {
					error(response.status, 'Room not found');
				}
				throw failure;
			}
		}
	});
}

export const load = _createStaffPblDetailHandlers().load;
