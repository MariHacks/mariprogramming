import {
	MaritoolsUnavailableError,
	openStudentStore
} from '$lib/server/maritools/student-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createRepository = dependencies.createRepository ?? openStudentStore;

	/** @param {any} event */
	async function load(event) {
		const termId = event.url.searchParams.get('term') ?? '';
		const query = event.url.searchParams.get('q') ?? '';
		try {
			const entries = await createRepository().listPublishedCatalog({ termId, query });
			return { entries, termId, query };
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return { entries: [], termId, query, unavailable: true };
			}
			throw error;
		}
	}

	return { load };
}

const handlers = _createHandlers();
export const load = handlers.load;
