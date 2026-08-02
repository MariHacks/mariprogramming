import { error } from '@sveltejs/kit';
import { catalogue, getTeacherBySlug } from '$lib/books/catalogue';

/** @param {{ params: { teacherSlug: string } }} event */
export function load({ params }) {
	const teacher = getTeacherBySlug(params.teacherSlug);

	if (!teacher) {
		error(404, 'Teacher not found');
	}

	const courses = catalogue.courses
		.filter((course) => course.teacherId === teacher.id)
		.map((course) => ({
			...course,
			books: catalogue.books
				.filter((book) => book.courseId === course.id)
				.map((book) => {
					const bookstore = catalogue.bookstores.find(
						(candidate) => candidate.id === book.bookstoreId
					);

					if (!bookstore) {
						throw new Error(`Unknown bookstore: ${book.bookstoreId}`);
					}

					return { ...book, bookstoreName: bookstore.name };
				})
		}));

	return { teacher, courses };
}
