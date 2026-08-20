import { error } from '@sveltejs/kit';
import { createRuntimeCatalogueRepository } from '$lib/server/catalogue/runtime';

/** @param {{ createRepository?: () => { getActiveCourseDetail: (teacherSlug: string, courseId: string) => Promise<any> } }} [dependencies] */
export function _createCoursePageLoad({
	createRepository = createRuntimeCatalogueRepository
} = {}) {
	/** @param {{ parent: () => Promise<unknown>, params: { teacherSlug: string, courseId: string } }} event */
	return async function load({ parent, params }) {
		await parent();
		const course = await createRepository().getActiveCourseDetail(
			params.teacherSlug,
			params.courseId
		);
		if (!course) error(404, 'Course not found');
		return {
			teacher: course.teacher,
			course: {
				...course,
				books: course.books.map((/** @type {any} */ book) => ({
					...book,
					bookstoreName: book.bookstore.name
				}))
			}
		};
	};
}

export const load = _createCoursePageLoad();
