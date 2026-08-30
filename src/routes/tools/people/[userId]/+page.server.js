import { error } from '@sveltejs/kit';
import {
	MaritoolsUnavailableError,
	openCommunityStore
} from '$lib/server/maritools/community-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createPublicProfileHandlers(dependencies = {}) {
	const createStore = dependencies.createStore ?? openCommunityStore;

	return Object.freeze({
		/** @param {any} event */
		async load(event) {
			const userId = String(event.params.userId ?? '').trim();
			if (!userId) throw error(404, 'That profile is not available.');
			try {
				const store = createStore();
				const profile = await store.getPublicProfile(userId);
				if (!profile) throw error(404, 'That profile is not available.');
				const threads = await store.listThreadsByAuthor(userId);
				return {
					profile,
					threads,
					unavailable: false,
					viewerSignedIn: Boolean(event.locals.maritools)
				};
			} catch (err) {
				if (err && typeof err === 'object' && 'status' in err) throw err;
				if (err instanceof MaritoolsUnavailableError) {
					return {
						profile: null,
						threads: [],
						unavailable: true,
						viewerSignedIn: Boolean(event.locals.maritools)
					};
				}
				throw err;
			}
		}
	});
}

const handlers = _createPublicProfileHandlers();
export const load = handlers.load;
