import { fail, redirect } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';
import {
	MaritoolsInputError,
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
				const store = createStore();
				const rows = await store.listConflictCatalog();
				/** @type {Map<string, string | null>} */
				const names = new Map();
				const ids = [
					...new Set(
						rows
							.map((row) =>
								typeof row.contributorUserId === 'string' ? row.contributorUserId : null
							)
							.filter(Boolean)
					)
				];
				await Promise.all(
					ids.map(async (id) => {
						try {
							const profile = await store.getProfile(id);
							names.set(id, profile?.displayName ?? null);
						} catch {
							names.set(id, null);
						}
					})
				);
				return {
					groups: buildCatalogConflictGroups(rows, names),
					unavailable: false
				};
			} catch (error) {
				if (error instanceof MaritoolsUnavailableError) {
					return { groups: [], unavailable: true };
				}
				throw error;
			}
		},
		actions: Object.freeze({
			/** @param {any} event */
			async resolve(event) {
				authorize(event.locals);
				const data = await event.request.formData();
				const contributionId = String(data.get('contributionId') ?? '').trim();
				if (!contributionId) return fail(400, { error: 'Pick a conflict peer first.' });
				try {
					await createStore().resolveCatalogConflict(contributionId);
				} catch (error) {
					if (error instanceof MaritoolsInputError) {
						return fail(400, { error: 'Could not resolve that conflict.' });
					}
					if (error instanceof MaritoolsUnavailableError) {
						return fail(503, { error: 'Conflict updates are unavailable. Try again.' });
					}
					throw error;
				}
				throw redirect(303, '/staff/catalog-conflicts');
			}
		})
	});
}

const handlers = _createStaffCatalogConflictsHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
