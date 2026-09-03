import { error } from '@sveltejs/kit';
import { buildCourseDetailPage } from '$lib/maritools/course-detail.js';
import {
	MaritoolsUnavailableError,
	openCommunityStore
} from '$lib/server/maritools/community-store.js';
import {
	MaritoolsUnavailableError as StudentUnavailableError,
	openStudentStore
} from '$lib/server/maritools/student-store.js';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createStudentStore = dependencies.createStudentStore ?? openStudentStore;
	const createCommunityStore = dependencies.createCommunityStore ?? openCommunityStore;

	/** @param {any} event */
	async function load(event) {
		const courseId = String(event.params.courseId ?? '');
		if (!UUID.test(courseId)) error(404, 'Course not found');

		try {
			const [rows, threads] = await Promise.all([
				createStudentStore().listCatalogForCourse(courseId),
				createCommunityStore().listThreads({ courseId })
			]);
			const published = rows.filter((row) => row.status === 'published');
			const conflicts = rows.filter((row) => row.status === 'conflict');
			const page = buildCourseDetailPage({
				courseId,
				published,
				conflicts,
				threads
			});
			if (!page) error(404, 'Course not found');
			return { page };
		} catch (err) {
			if (
				err instanceof MaritoolsUnavailableError ||
				err instanceof StudentUnavailableError
			) {
				error(503, 'Catalog is unavailable right now');
			}
			throw err;
		}
	}

	return { load };
}

const handlers = _createHandlers();
export const load = handlers.load;
