import { MaritoolsUnavailableError, openCommunityStore } from '$lib/server/maritools/community-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createStore = dependencies.createStore ?? openCommunityStore;

	/** @param {any} event */
	async function load(event) {
		const slug = event.params.slug;
		try {
			const store = createStore();
			const club = await store.getPublishedClubBySlug(slug);
			if (!club) {
				return { club: null, notFound: true };
			}
			return { club };
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return { club: null, unavailable: true };
			}
			throw error;
		}
	}

	return { load };
}

const handlers = _createHandlers();
export const load = handlers.load;
