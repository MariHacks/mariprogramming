import { MariToolsUnavailableError, openFreeTimeStore } from '$lib/server/maritools/free-time-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createStore = dependencies.createStore ?? openFreeTimeStore;

	/** @param {any} event */
	async function load(event) {
		const slug = event.params.slug;
		try {
			const store = createStore();
			const board = await store.getBoardBySlug(slug);
			if (!board) {
				return { board: null, notFound: true };
			}
			return { board };
		} catch (error) {
			if (error instanceof MariToolsUnavailableError) {
				return { board: null, unavailable: true };
			}
			throw error;
		}
	}

	return { load };
}

const handlers = _createHandlers();
export const load = handlers.load;
