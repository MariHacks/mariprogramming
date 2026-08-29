import { requireStaff } from '$lib/server/auth/authorization.js';
import {
	MaritoolsUnavailableError,
	openCommunityStore
} from '$lib/server/maritools/community-store.js';
import { buildCatalogConflictGroups } from '$lib/server/maritools/staff-catalog-conflicts.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createStaffCatalogConflictsHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const createStore = dependencies.createStore ?? openCommunityStore;

	return Object.freeze({
		/** @param {any} event */
		async load(event) {
			authorize(event.locals);
			try {
				const rows = await createStore().listConflictCatalog();
				return {
					groups: buildCatalogConflictGroups(rows),
					unavailable: false
				};
			} catch (error) {
				if (error instanceof MaritoolsUnavailableError) {
					return { groups: [], unavailable: true };
				}
				throw error;
			}
		}
	});
}

const handlers = _createStaffCatalogConflictsHandlers();
export const load = handlers.load;
