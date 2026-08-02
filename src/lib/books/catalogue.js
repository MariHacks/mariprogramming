/**
 * @typedef {{ id: string, slug: string, name: string }} Teacher
 * @typedef {{ id: string, teacherId: string, code: string, title: string }} Course
 * @typedef {{ id: string, name: string, serviceFeeCents: number }} Bookstore
 * @typedef {{
 *   id: string,
 *   courseId: string,
 *   title: string,
 *   author: string,
 *   format: string,
 *   priceCents: number,
 *   bookstoreId: string,
 *   storefrontUrl: string | null,
 *   coverUrl: string | null,
 *   coverTheme: string
 * }} Book
 * @typedef {{
 *   taxRateBps: number,
 *   teachers: Teacher[],
 *   courses: Course[],
 *   bookstores: Bookstore[],
 *   books: Book[]
 * }} Catalogue
 */

/** @type {Catalogue} */
export const catalogue = {
	taxRateBps: 1498,
	teachers: [
		{ id: 'mme-tremblay', slug: 'mme-tremblay', name: 'Mme Tremblay' },
		{ id: 'mr-bennett', slug: 'mr-bennett', name: 'Mr Bennett' }
	],
	courses: [
		{
			id: 'french-101',
			teacherId: 'mme-tremblay',
			code: 'FRE-101',
			title: 'French 101'
		},
		{
			id: 'french-102',
			teacherId: 'mme-tremblay',
			code: 'FRE-102',
			title: 'French 102'
		},
		{
			id: 'english-101',
			teacherId: 'mr-bennett',
			code: 'ENG-101',
			title: 'English 101'
		}
	],
	bookstores: [
		{ id: 'renaud-bray', name: 'Renaud-Bray', serviceFeeCents: 500 },
		{ id: 'archambault', name: 'Archambault', serviceFeeCents: 700 }
	],
	books: [
		{
			id: 'le-petit-prince',
			courseId: 'french-101',
			title: 'Le Petit Prince',
			author: 'Antoine de Saint-Exupéry',
			format: 'Paperback',
			priceCents: 1895,
			bookstoreId: 'renaud-bray',
			storefrontUrl: null,
			coverUrl: null,
			coverTheme: 'coral'
		},
		{
			id: 'bescherelle',
			courseId: 'french-101',
			title: 'Bescherelle',
			author: 'Bescherelle',
			format: 'Hardcover',
			priceCents: 2995,
			bookstoreId: 'renaud-bray',
			storefrontUrl: null,
			coverUrl: null,
			coverTheme: 'sky'
		},
		{
			id: 'antigone',
			courseId: 'french-102',
			title: 'Antigone',
			author: 'Jean Anouilh',
			format: 'Paperback',
			priceCents: 1695,
			bookstoreId: 'archambault',
			storefrontUrl: null,
			coverUrl: null,
			coverTheme: 'midnight'
		},
		{
			id: 'the-great-gatsby',
			courseId: 'english-101',
			title: 'The Great Gatsby',
			author: 'F. Scott Fitzgerald',
			format: 'Paperback',
			priceCents: 1795,
			bookstoreId: 'archambault',
			storefrontUrl: null,
			coverUrl: null,
			coverTheme: 'paper'
		}
	]
};

/**
 * @param {string} slug
 * @returns {Teacher | undefined}
 */
export function getTeacherBySlug(slug) {
	return catalogue.teachers.find((teacher) => teacher.slug === slug);
}

/**
 * @param {string} teacherId
 * @returns {Book[]}
 */
export function getTeacherBooks(teacherId) {
	const courseIds = new Set(
		catalogue.courses.filter((course) => course.teacherId === teacherId).map((course) => course.id)
	);

	return catalogue.books.filter((book) => courseIds.has(book.courseId));
}
