import {
	MaritoolsUnavailableError,
	openStudentStore
} from '$lib/server/maritools/student-store.js';
import { disciplineFromCourseCode } from './discipline.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createRepository = dependencies.createRepository ?? openStudentStore;

	/** @param {any} event */
	async function load(event) {
		const termId = event.url.searchParams.get('term') ?? '';
		const query = event.url.searchParams.get('q') ?? '';
		const discipline = event.url.searchParams.get('discipline') ?? '';
		try {
			const rows = await createRepository().listPublishedCatalog({ termId, query });
			const disciplines = [
				...new Set(rows.map((row) => disciplineFromCourseCode(row.courseCode)))
			].sort();
			const entries = discipline
				? rows.filter((row) => disciplineFromCourseCode(row.courseCode) === discipline)
				: rows;
			return { entries, termId, query, discipline, disciplines };
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return { entries: [], termId, query, discipline, disciplines: [], unavailable: true };
			}
			throw error;
		}
	}

	return { load };
}

const handlers = _createHandlers();
export const load = handlers.load;
