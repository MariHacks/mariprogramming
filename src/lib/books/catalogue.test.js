import { describe, expect, it } from 'vitest';
import { catalogue, getTeacherBooks, getTeacherBySlug } from './catalogue';

describe('book catalogue', () => {
	it('represents Mme Tremblay as the teacher for both required French course lists', () => {
		const teacher = getTeacherBySlug('mme-tremblay');

		expect(teacher).toMatchObject({ id: 'mme-tremblay', name: 'Mme Tremblay' });
		expect(
			catalogue.courses
				.filter((course) => course.teacherId === teacher?.id)
				.map((course) => course.title)
		).toEqual(['French 101', 'French 102']);
		expect(getTeacherBooks('mme-tremblay').map((book) => book.title)).toEqual([
			'Le Petit Prince',
			'Bescherelle',
			'Antigone'
		]);
	});

	it('includes an English course and assigned English book', () => {
		const teacher = getTeacherBySlug('mr-bennett');
		const courses = catalogue.courses.filter((course) => course.teacherId === teacher?.id);
		const books = getTeacherBooks(teacher?.id ?? '');

		expect(teacher?.name).toBe('Mr Bennett');
		expect(courses.map((course) => course.title)).toEqual(['English 101']);
		expect(books).toEqual([
			expect.objectContaining({
				title: 'The Great Gatsby',
				author: 'F. Scott Fitzgerald',
				courseId: 'english-101'
			})
		]);
	});

	it('uses the approved two service-fee levels and leaves unverified retailer links absent', () => {
		expect(catalogue.bookstores.map((bookstore) => bookstore.serviceFeeCents)).toEqual([500, 700]);

		for (const book of catalogue.books) {
			expect(book).toMatchObject({
				courseId: expect.any(String),
				author: expect.any(String),
				format: expect.any(String),
				priceCents: expect.any(Number),
				bookstoreId: expect.any(String),
				storefrontUrl: null,
				coverUrl: null,
				coverTheme: expect.any(String)
			});
			expect(Number.isInteger(book.priceCents)).toBe(true);
		}
	});

	it('stays serializable and lookup helpers leave the fixture unchanged', () => {
		const before = JSON.stringify(catalogue);

		expect(JSON.parse(before)).toEqual(catalogue);
		expect(getTeacherBySlug('not-a-teacher')).toBeUndefined();
		expect(getTeacherBooks('not-a-teacher')).toEqual([]);
		expect(JSON.stringify(catalogue)).toBe(before);
	});
});
