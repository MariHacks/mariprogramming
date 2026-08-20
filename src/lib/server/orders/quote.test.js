// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { CatalogueInputError, CatalogueUnavailableError } from '../catalogue/repository.js';
import { quoteCheckoutCoursesInTransaction } from './quote.js';

const COURSE_A = '10000000-0000-4000-8000-000000000001';
const COURSE_B = '10000000-0000-4000-8000-000000000002';
const BOOK_A = '20000000-0000-4000-8000-000000000001';
const BOOK_B = '20000000-0000-4000-8000-000000000002';
const STORE = '30000000-0000-4000-8000-000000000001';
const TEACHER_A = '40000000-0000-4000-8000-000000000001';
const TEACHER_B = '40000000-0000-4000-8000-000000000002';

/** @type {Parameters<typeof quoteCheckoutCoursesInTransaction>[1]} */
const canonical = {
	version: 1,
	clientRequestId: '50000000-0000-4000-8000-000000000001',
	customerName: 'Ada Lovelace',
	customerEmail: 'ada@example.com',
	courses: [
		{
			teacherSlug: 'prof-a',
			courseId: COURSE_A,
			selections: [{ bookId: BOOK_A, quantity: 1 }]
		},
		{
			teacherSlug: 'prof-b',
			courseId: COURSE_B,
			selections: [{ bookId: BOOK_B, quantity: 2 }]
		}
	]
};

/**
 * @param {{
 *   courseId: string,
 *   teacherId: string,
 *   teacherName: string,
 *   courseCode: string,
 *   bookId: string,
 *   label: string,
 *   quantity: number,
 *   unitAmountCents: number
 * }} options
 * @returns {any}
 */
function courseQuote({
	courseId,
	teacherId,
	teacherName,
	courseCode,
	bookId,
	label,
	quantity,
	unitAmountCents
}) {
	return {
		currency: 'cad',
		subtotalCents: quantity * unitAmountCents,
		serviceFeeCents: 500,
		taxCents: 0,
		totalCents: quantity * unitAmountCents + 500,
		taxRateBps: 1498,
		lines: [
			{
				kind: 'book',
				label,
				isbn: null,
				bookId,
				teacherId,
				teacherName,
				courseId,
				courseCode,
				courseTitle: `${courseCode} title`,
				bookstoreId: STORE,
				bookstoreName: 'Store',
				quantity,
				unitAmountCents,
				lineAmountCents: quantity * unitAmountCents
			},
			{
				kind: 'service_fee',
				label: 'Store pickup service',
				isbn: null,
				bookId: null,
				teacherId: null,
				teacherName: null,
				courseId: null,
				courseCode: null,
				courseTitle: null,
				bookstoreId: STORE,
				bookstoreName: 'Store',
				quantity: 1,
				unitAmountCents: 500,
				lineAmountCents: 500
			}
		]
	};
}

describe('multi-course canonical checkout quote', () => {
	it('locks each course, keeps every course snapshot, deduplicates bookstore fees, and taxes once', async () => {
		const quoteSelectedBooksInTransaction = vi
			.fn()
			.mockResolvedValueOnce(
				courseQuote({
					courseId: COURSE_A,
					teacherId: TEACHER_A,
					teacherName: 'Prof A',
					courseCode: 'FRE-101',
					bookId: BOOK_A,
					label: 'Book A',
					quantity: 1,
					unitAmountCents: 1000
				})
			)
			.mockResolvedValueOnce(
				courseQuote({
					courseId: COURSE_B,
					teacherId: TEACHER_B,
					teacherName: 'Prof B',
					courseCode: 'ENG-201',
					bookId: BOOK_B,
					label: 'Book B',
					quantity: 2,
					unitAmountCents: 2000
				})
			);
		const repository = { quoteSelectedBooksInTransaction };
		const transaction = { connection: 'one-transaction' };

		const quote = await quoteCheckoutCoursesInTransaction(transaction, canonical, repository);

		expect(quoteSelectedBooksInTransaction).toHaveBeenNthCalledWith(1, transaction, {
			teacherSlug: 'prof-a',
			courseId: COURSE_A,
			selections: [{ bookId: BOOK_A, quantity: 1 }]
		});
		expect(quoteSelectedBooksInTransaction).toHaveBeenNthCalledWith(2, transaction, {
			teacherSlug: 'prof-b',
			courseId: COURSE_B,
			selections: [{ bookId: BOOK_B, quantity: 2 }]
		});
		expect(quote).toEqual({
			currency: 'cad',
			subtotalCents: 5000,
			serviceFeeCents: 500,
			taxCents: 824,
			totalCents: 6324,
			taxRateBps: 1498,
			lines: [
				expect.objectContaining({ kind: 'book', label: 'Book A', courseId: COURSE_A }),
				expect.objectContaining({ kind: 'book', label: 'Book B', courseId: COURSE_B }),
				expect.objectContaining({ kind: 'service_fee', bookstoreId: STORE })
			]
		});
		expect(
			quote.lines.filter((/** @type {any} */ { kind }) => kind === 'service_fee')
		).toHaveLength(1);
		expect(Object.isFrozen(quote)).toBe(true);
	});

	it.each([
		['a malformed repository', null],
		['a repository without the quote function', {}],
		['a malformed transaction', null]
	])('fails closed for %s', async (_label, value) => {
		await expect(
			quoteCheckoutCoursesInTransaction(
				value === null && _label.includes('transaction') ? value : {},
				canonical,
				_label.includes('repository') ? value : { quoteSelectedBooksInTransaction: vi.fn() }
			)
		).rejects.toBeInstanceOf(CatalogueUnavailableError);
	});

	it('preserves a stale catalogue selection error', async () => {
		await expect(
			quoteCheckoutCoursesInTransaction({}, canonical, {
				quoteSelectedBooksInTransaction: vi.fn().mockRejectedValue(new CatalogueInputError())
			})
		).rejects.toBeInstanceOf(CatalogueInputError);
	});

	it.each([
		['missing first quote', undefined],
		['mixed currencies', { currency: 'usd' }],
		['mixed tax rates', { taxRateBps: 0 }],
		['an excessive tax rate', { taxRateBps: 10001 }],
		['a fractional tax rate', { taxRateBps: 1.5 }],
		['a malformed line', { lines: [null] }],
		[
			'conflicting bookstore facts',
			{
				lines: [
					{
						kind: 'service_fee',
						bookstoreId: STORE,
						bookstoreName: 'Other',
						quantity: 1,
						unitAmountCents: 500,
						lineAmountCents: 500
					}
				]
			}
		]
	])('fails closed for %s', async (_label, quoteOverride) => {
		const first = courseQuote({
			courseId: COURSE_A,
			teacherId: TEACHER_A,
			teacherName: 'Prof A',
			courseCode: 'FRE-101',
			bookId: BOOK_A,
			label: 'Book A',
			quantity: 1,
			unitAmountCents: 1000
		});
		const second =
			quoteOverride === undefined
				? undefined
				: {
						...courseQuote({
							courseId: COURSE_B,
							teacherId: TEACHER_B,
							teacherName: 'Prof B',
							courseCode: 'ENG-201',
							bookId: BOOK_B,
							label: 'Book B',
							quantity: 2,
							unitAmountCents: 2000
						}),
						...quoteOverride
					};
		await expect(
			quoteCheckoutCoursesInTransaction({}, canonical, {
				quoteSelectedBooksInTransaction:
					quoteOverride === undefined
						? vi.fn().mockResolvedValue(undefined)
						: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
			})
		).rejects.toBeInstanceOf(CatalogueUnavailableError);
	});

	it('sorts same-course books and multiple bookstore fees by their stable identifiers', async () => {
		const first = courseQuote({
			courseId: COURSE_A,
			teacherId: TEACHER_A,
			teacherName: 'Prof A',
			courseCode: 'FRE-101',
			bookId: BOOK_B,
			label: 'Book B',
			quantity: 1,
			unitAmountCents: 1000
		});
		const bookA = {
			...first.lines[0],
			bookId: BOOK_A,
			label: 'Book A',
			unitAmountCents: 800,
			lineAmountCents: 800
		};
		const otherFee = {
			...first.lines[1],
			bookstoreId: '20000000-0000-4000-8000-000000000009',
			bookstoreName: 'Earlier Store',
			label: 'Earlier Store pickup service'
		};
		first.lines = [first.lines[0], bookA, first.lines[1], otherFee];

		const result = await quoteCheckoutCoursesInTransaction(
			{},
			{ ...canonical, courses: [canonical.courses[0]] },
			{ quoteSelectedBooksInTransaction: vi.fn().mockResolvedValue(first) }
		);

		expect(result.lines.map((/** @type {any} */ line) => line.label)).toEqual([
			'Book A',
			'Book B',
			'Earlier Store pickup service',
			'Store pickup service'
		]);
	});

	it('redacts an unexpected repository failure', async () => {
		await expect(
			quoteCheckoutCoursesInTransaction({}, canonical, {
				quoteSelectedBooksInTransaction: vi.fn().mockRejectedValue(new Error('secret'))
			})
		).rejects.toEqual(expect.objectContaining({ name: 'CatalogueUnavailableError' }));
	});

	it.each([-1, 10001])('rejects a first quote tax rate of %s', async (taxRateBps) => {
		const first = {
			...courseQuote({
				courseId: COURSE_A,
				teacherId: TEACHER_A,
				teacherName: 'Prof A',
				courseCode: 'FRE-101',
				bookId: BOOK_A,
				label: 'Book A',
				quantity: 1,
				unitAmountCents: 1000
			}),
			taxRateBps
		};
		await expect(
			quoteCheckoutCoursesInTransaction(
				{},
				{ ...canonical, courses: [canonical.courses[0]] },
				{ quoteSelectedBooksInTransaction: vi.fn().mockResolvedValue(first) }
			)
		).rejects.toBeInstanceOf(CatalogueUnavailableError);
	});
});
