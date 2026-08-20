// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
	CatalogueInputError,
	CatalogueUnavailableError,
	createCatalogueRepository,
	normalizeApprovedHttpsUrl
} from './repository';

const IDS = Object.freeze({
	teacher: '10000000-0000-4000-8000-000000000001',
	course: '20000000-0000-4000-8000-000000000001',
	storeA: '30000000-0000-4000-8000-000000000001',
	storeB: '30000000-0000-4000-8000-000000000002',
	bookA: '40000000-0000-4000-8000-000000000001',
	bookB: '40000000-0000-4000-8000-000000000002'
});

function row(overrides = {}) {
	return {
		teacherId: IDS.teacher,
		teacherSlug: 'prof-example',
		teacherName: 'Prof. Example',
		courseId: IDS.course,
		courseCode: 'ENG-101',
		courseTitle: 'English 101',
		courseBookPosition: 0,
		bookId: IDS.bookA,
		bookTitle: 'First Book',
		bookAuthor: 'A. Writer',
		bookIsbn: '9780000000001',
		bookPriceCents: 1000,
		bookRetailerUrl: 'https://shop.example.com/books/first?edition=1',
		bookCoverUrl: 'https://images.example.com/covers/first.webp',
		bookstoreId: IDS.storeA,
		bookstoreName: 'Campus Books',
		bookstoreServiceFeeCents: 500,
		...overrides
	};
}

/** @param {...any[]} results */
function transactionReturning(...results) {
	/** @type {Array<{ joins: any[], locked: boolean, ordered: boolean }>} */
	const operations = [];
	let call = 0;
	const transaction = {
		select: vi.fn(() => {
			const operation = /** @type {{ joins: any[], locked: boolean, ordered: boolean }} */ ({
				joins: [],
				locked: false,
				ordered: false
			});
			operations.push(operation);
			const builder = {
				from: vi.fn(() => builder),
				innerJoin: vi.fn((table) => {
					operation.joins.push(table);
					return builder;
				}),
				where: vi.fn(() => builder),
				orderBy: vi.fn(() => {
					operation.ordered = true;
					return builder;
				}),
				for: vi.fn(() => {
					operation.locked = true;
					return builder;
				}),
				/** @param {(value: any) => any} resolveResult @param {(error: any) => any} rejectResult */
				then(resolveResult, rejectResult) {
					return Promise.resolve(results[call++]).then(resolveResult, rejectResult);
				}
			};
			return builder;
		})
	};
	return { transaction, operations };
}

/** @param {any[]} results @param {Record<string, any>} [overrides] */
function repositoryWithRows(results, overrides = {}) {
	const { transaction, operations } = transactionReturning(...results);
	const runTransaction = vi.fn((operation) => operation(transaction));
	return {
		repository: createCatalogueRepository({
			databaseUrl: 'postgresql://runtime:secret@db.example/club',
			approvedHostnames: ['shop.example.com', 'images.example.com'],
			taxRateBps: 1498,
			runTransaction,
			...overrides
		}),
		runTransaction,
		operations
	};
}

describe('normalizeApprovedHttpsUrl', () => {
	it('normalizes an exact approved HTTPS destination without fetching it', () => {
		expect(
			normalizeApprovedHttpsUrl(
				'https://shop.example.com/books/Le Petit Prince?q=paper back',
				new Set(['shop.example.com'])
			)
		).toBe('https://shop.example.com/books/Le%20Petit%20Prince?q=paper%20back');
	});

	it.each([
		'http://shop.example.com/book',
		'https://user:password@shop.example.com/book',
		'https://shop.example.com:444/book',
		'https://shop.example.com/book#details',
		'https://cdn.shop.example.com/book',
		'https://shop.example.com.evil.test/book',
		'https://localhost/book',
		'https://127.0.0.1/book',
		'https://2130706433/book',
		'https://[::1]/book',
		'https://catalogue.local/book',
		'https://xn--bcher-kva.example/book',
		'not a URL',
		`https://shop.example.com/${'x'.repeat(2049)}`
	])('rejects an unsafe or unapproved URL %#', (value) => {
		expect(() => normalizeApprovedHttpsUrl(value, new Set(['shop.example.com']))).toThrow(
			CatalogueUnavailableError
		);
	});

	it('allows a missing optional cover and rejects a missing retailer URL', () => {
		expect(
			normalizeApprovedHttpsUrl(null, new Set(['images.example.com']), { optional: true })
		).toBe(null);
		expect(() => normalizeApprovedHttpsUrl(null, new Set(['shop.example.com']))).toThrow(
			CatalogueUnavailableError
		);
	});
});

describe('catalogue repository reads', () => {
	it('returns one deterministic teacher-course entry with ordered, safe book DTOs', async () => {
		const second = row({
			courseBookPosition: 2,
			bookId: IDS.bookB,
			bookTitle: 'Second Book',
			bookAuthor: null,
			bookIsbn: null,
			bookPriceCents: 2500,
			bookRetailerUrl: 'https://shop.example.com/books/second',
			bookCoverUrl: null,
			bookstoreId: IDS.storeB,
			bookstoreName: 'Other Books',
			bookstoreServiceFeeCents: 700
		});
		const { repository, runTransaction, operations } = repositoryWithRows([[second, row()]]);

		await expect(repository.listActiveCourseSummaries()).resolves.toEqual([
			{
				id: IDS.course,
				code: 'ENG-101',
				title: 'English 101',
				teacher: { slug: 'prof-example', name: 'Prof. Example' },
				books: [
					{
						id: IDS.bookA,
						title: 'First Book',
						author: 'A. Writer',
						isbn: '9780000000001',
						priceCents: 1000,
						storefrontUrl: 'https://shop.example.com/books/first?edition=1',
						coverUrl: 'https://images.example.com/covers/first.webp',
						bookstore: {
							id: IDS.storeA,
							name: 'Campus Books',
							serviceFeeCents: 500
						}
					},
					{
						id: IDS.bookB,
						title: 'Second Book',
						author: null,
						isbn: null,
						priceCents: 2500,
						storefrontUrl: 'https://shop.example.com/books/second',
						coverUrl: null,
						bookstore: { id: IDS.storeB, name: 'Other Books', serviceFeeCents: 700 }
					}
				]
			}
		]);
		expect(runTransaction).toHaveBeenCalledOnce();
		expect(operations).toEqual([{ joins: expect.any(Array), locked: false, ordered: true }]);
		expect(operations[0].joins).toHaveLength(4);
	});

	it('returns empty state without a sample fallback', async () => {
		const { repository } = repositoryWithRows([[]]);
		await expect(repository.listActiveCourseSummaries()).resolves.toEqual([]);
	});

	it('returns the matching detail and null for a missing or mismatched teacher-course pair', async () => {
		const { repository, runTransaction } = repositoryWithRows([[row()], []]);
		await expect(
			repository.getActiveCourseDetail('prof-example', IDS.course)
		).resolves.toMatchObject({
			id: IDS.course,
			teacher: { slug: 'prof-example' }
		});
		await expect(repository.getActiveCourseDetail('other-teacher', IDS.course)).resolves.toBeNull();
		expect(runTransaction).toHaveBeenCalledTimes(2);
	});

	it.each([
		['an invalid teacher slug', '../staff', IDS.course],
		['an invalid course ID', 'prof-example', 'course-1']
	])('rejects %s before opening a transaction', async (_label, teacherSlug, courseId) => {
		const { repository, runTransaction } = repositoryWithRows([]);
		await expect(repository.getActiveCourseDetail(teacherSlug, courseId)).rejects.toBeInstanceOf(
			CatalogueInputError
		);
		expect(runTransaction).not.toHaveBeenCalled();
	});

	it('redacts database and malformed stored-record failures', async () => {
		const databaseFailure = new Error('password=database-secret');
		const failedRepository = createCatalogueRepository({
			databaseUrl: 'postgresql://runtime:secret@db.example/club',
			approvedHostnames: ['shop.example.com'],
			taxRateBps: 1498,
			runTransaction: vi.fn().mockRejectedValue(databaseFailure)
		});
		const malformed = repositoryWithRows([[row({ bookPriceCents: -1 })]]).repository;

		for (const repository of [failedRepository, malformed]) {
			const failure = await repository.listActiveCourseSummaries().catch((error) => error);
			expect(failure).toBeInstanceOf(CatalogueUnavailableError);
			expect(failure.message).toBe('Book catalogue is unavailable');
			expect(failure.message).not.toContain('secret');
			expect(failure.cause).toBeUndefined();
		}
	});

	it.each([row({ teacherName: ' ' }), row({ teacherId: 'not-a-uuid' }), { courseId: null }])(
		'rejects a malformed stored row %# without exposing it',
		async (storedRow) => {
			const { repository } = repositoryWithRows([[storedRow]]);
			await expect(repository.listActiveCourseSummaries()).rejects.toBeInstanceOf(
				CatalogueUnavailableError
			);
		}
	);

	it('rejects internally inconsistent duplicate course records', async () => {
		const { repository } = repositoryWithRows([[row(), row({ teacherName: 'Changed Name' })]]);
		await expect(repository.listActiveCourseSummaries()).rejects.toBeInstanceOf(
			CatalogueUnavailableError
		);
	});

	it('orders courses deterministically through every documented tie breaker', async () => {
		const entries = [
			row({
				teacherId: '10000000-0000-4000-8000-000000000005',
				teacherName: 'Zed',
				teacherSlug: 'zed',
				courseId: '20000000-0000-4000-8000-000000000005',
				courseCode: 'A',
				bookId: '40000000-0000-4000-8000-000000000005'
			}),
			row({
				teacherId: '10000000-0000-4000-8000-000000000004',
				teacherName: 'Alpha',
				teacherSlug: 'zed',
				courseId: '20000000-0000-4000-8000-000000000004',
				courseCode: 'A',
				bookId: '40000000-0000-4000-8000-000000000004'
			}),
			row({
				teacherId: '10000000-0000-4000-8000-000000000003',
				teacherName: 'Alpha',
				teacherSlug: 'alpha',
				courseId: '20000000-0000-4000-8000-000000000003',
				courseCode: 'Z',
				bookId: '40000000-0000-4000-8000-000000000003'
			}),
			row({
				teacherId: '10000000-0000-4000-8000-000000000002',
				teacherName: 'Alpha',
				teacherSlug: 'alpha',
				courseId: '20000000-0000-4000-8000-000000000002',
				courseCode: 'A',
				bookId: '40000000-0000-4000-8000-000000000002'
			}),
			row({ teacherName: 'Alpha', teacherSlug: 'alpha', courseCode: 'A' })
		];
		const { repository } = repositoryWithRows([entries]);
		const courses = await repository.listActiveCourseSummaries();
		expect(courses.map(({ id }) => id)).toEqual([
			IDS.course,
			'20000000-0000-4000-8000-000000000002',
			'20000000-0000-4000-8000-000000000003',
			'20000000-0000-4000-8000-000000000004',
			'20000000-0000-4000-8000-000000000005'
		]);
	});
});

describe('canonical catalogue quote', () => {
	const second = row({
		courseBookPosition: 1,
		bookId: IDS.bookB,
		bookTitle: 'Second Book',
		bookPriceCents: 2500,
		bookRetailerUrl: 'https://shop.example.com/books/second',
		bookCoverUrl: null,
		bookstoreId: IDS.storeB,
		bookstoreName: 'Other Books',
		bookstoreServiceFeeCents: 700
	});

	it('locks active records and computes quantity, one fee per bookstore, tax, and exact total', async () => {
		const { repository, operations } = repositoryWithRows([[row(), second]]);
		const quote = await repository.quoteSelectedBooks({
			teacherSlug: 'prof-example',
			courseId: IDS.course,
			selections: [
				{ bookId: IDS.bookA, quantity: 2 },
				{ bookId: IDS.bookB, quantity: 1 }
			]
		});

		expect(quote).toMatchObject({
			currency: 'cad',
			subtotalCents: 4500,
			serviceFeeCents: 1200,
			taxCents: 854,
			totalCents: 6554,
			taxRateBps: 1498
		});
		expect(quote.lines).toEqual([
			expect.objectContaining({
				kind: 'book',
				bookId: IDS.bookA,
				teacherId: IDS.teacher,
				courseId: IDS.course,
				quantity: 2,
				unitAmountCents: 1000,
				lineAmountCents: 2000
			}),
			expect.objectContaining({ kind: 'book', bookId: IDS.bookB, lineAmountCents: 2500 }),
			expect.objectContaining({
				kind: 'service_fee',
				bookstoreId: IDS.storeA,
				quantity: 1,
				unitAmountCents: 500,
				lineAmountCents: 500
			}),
			expect.objectContaining({
				kind: 'service_fee',
				bookstoreId: IDS.storeB,
				unitAmountCents: 700
			})
		]);
		expect(Object.isFrozen(quote)).toBe(true);
		expect(Object.isFrozen(quote.lines)).toBe(true);
		expect(operations[0].locked).toBe(true);
	});

	it('quotes inside an existing transaction without opening or committing another transaction', async () => {
		const { repository, runTransaction } = repositoryWithRows([]);
		const { transaction, operations } = transactionReturning([row()]);

		await expect(
			repository.quoteSelectedBooksInTransaction(transaction, {
				teacherSlug: 'prof-example',
				courseId: IDS.course,
				selections: [{ bookId: IDS.bookA, quantity: 1 }]
			})
		).resolves.toMatchObject({
			subtotalCents: 1000,
			serviceFeeCents: 500,
			totalCents: 1725
		});
		expect(runTransaction).not.toHaveBeenCalled();
		expect(operations).toEqual([{ joins: expect.any(Array), locked: true, ordered: true }]);
	});

	it('uses an explicitly injected zero tax rate without changing the fee policy', async () => {
		const { repository } = repositoryWithRows([[row()]], { taxRateBps: 0 });
		await expect(
			repository.quoteSelectedBooks({
				teacherSlug: 'prof-example',
				courseId: IDS.course,
				selections: [{ bookId: IDS.bookA, quantity: 1 }]
			})
		).resolves.toMatchObject({
			subtotalCents: 1000,
			serviceFeeCents: 500,
			taxCents: 0,
			totalCents: 1500,
			taxRateBps: 0
		});
	});

	it.each([
		['empty selections', []],
		[
			'duplicate books',
			[
				{ bookId: IDS.bookA, quantity: 1 },
				{ bookId: IDS.bookA, quantity: 1 }
			]
		],
		['unknown book ID', [{ bookId: 'not-a-uuid', quantity: 1 }]],
		['zero quantity', [{ bookId: IDS.bookA, quantity: 0 }]],
		['excess quantity', [{ bookId: IDS.bookA, quantity: 11 }]],
		[
			'excess selections',
			Array.from({ length: 26 }, (_, index) => ({
				bookId: `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
				quantity: 1
			}))
		]
	])('rejects %s before reading the database', async (_label, selections) => {
		const { repository, runTransaction } = repositoryWithRows([]);
		await expect(
			repository.quoteSelectedBooks({
				teacherSlug: 'prof-example',
				courseId: IDS.course,
				selections
			})
		).rejects.toBeInstanceOf(CatalogueInputError);
		expect(runTransaction).not.toHaveBeenCalled();
	});

	it.each([
		[
			'a stale or inactive book',
			[row()],
			[
				{ bookId: IDS.bookA, quantity: 1 },
				{ bookId: IDS.bookB, quantity: 1 }
			]
		],
		['a teacher-course mismatch', [], [{ bookId: IDS.bookA, quantity: 1 }]],
		['a duplicated database assignment', [row(), row()], [{ bookId: IDS.bookA, quantity: 1 }]]
	])('rejects %s without producing a partial quote', async (_label, rows, selections) => {
		const { repository } = repositoryWithRows([rows]);
		await expect(
			repository.quoteSelectedBooks({
				teacherSlug: 'prof-example',
				courseId: IDS.course,
				selections
			})
		).rejects.toBeInstanceOf(CatalogueInputError);
	});

	it('rejects a same-sized but different database selection', async () => {
		const { repository } = repositoryWithRows([[second]]);
		await expect(
			repository.quoteSelectedBooks({
				teacherSlug: 'prof-example',
				courseId: IDS.course,
				selections: [{ bookId: IDS.bookA, quantity: 1 }]
			})
		).rejects.toBeInstanceOf(CatalogueInputError);
	});

	it('rejects contradictory records for the same bookstore', async () => {
		const contradictory = second;
		const first = row({
			bookstoreId: IDS.storeB,
			bookstoreName: 'Other Books',
			bookstoreServiceFeeCents: 500
		});
		const { repository } = repositoryWithRows([[first, contradictory]]);
		await expect(
			repository.quoteSelectedBooks({
				teacherSlug: 'prof-example',
				courseId: IDS.course,
				selections: [
					{ bookId: IDS.bookA, quantity: 1 },
					{ bookId: IDS.bookB, quantity: 1 }
				]
			})
		).rejects.toBeInstanceOf(CatalogueUnavailableError);
	});

	it('rejects unsafe-integer price arithmetic', async () => {
		const { repository } = repositoryWithRows([[row({ bookPriceCents: Number.MAX_SAFE_INTEGER })]]);
		await expect(
			repository.quoteSelectedBooks({
				teacherSlug: 'prof-example',
				courseId: IDS.course,
				selections: [{ bookId: IDS.bookA, quantity: 2 }]
			})
		).rejects.toBeInstanceOf(CatalogueUnavailableError);
	});

	it.each([-1, 10001, 1.5, Number.NaN])(
		'rejects invalid injected tax configuration %#',
		(taxRateBps) => {
			expect(() =>
				createCatalogueRepository({
					databaseUrl: 'postgresql://runtime:secret@db.example/club',
					approvedHostnames: ['shop.example.com'],
					taxRateBps,
					runTransaction: vi.fn()
				})
			).toThrow(CatalogueUnavailableError);
		}
	);

	it.each([
		undefined,
		[],
		Array.from({ length: 33 }, (_, index) => `store-${index}.example.com`),
		['shop.example.com', 'shop.example.com'],
		['localhost']
	])('rejects invalid hostname allowlist configuration %#', (approvedHostnames) => {
		expect(() =>
			createCatalogueRepository({
				approvedHostnames: /** @type {any} */ (approvedHostnames),
				taxRateBps: 0,
				databaseUrl: 'postgresql://runtime:secret@db.example/club',
				runTransaction: vi.fn()
			})
		).toThrow(CatalogueUnavailableError);
	});

	it.each([undefined, ''])(
		'fails closed without an explicit usable database URL %#',
		(databaseUrl) => {
			expect(() =>
				createCatalogueRepository({
					approvedHostnames: ['shop.example.com'],
					taxRateBps: 0,
					databaseUrl,
					runTransaction: vi.fn()
				})
			).toThrow(CatalogueUnavailableError);
		}
	);
});

describe('production boundaries', () => {
	it('does not import the browser fixture catalogue or client cart storage', async () => {
		const source = await readFile(resolve('src/lib/server/catalogue/repository.js'), 'utf8');
		expect(source).not.toMatch(/lib\/books\/catalogue|books\/catalogue|cart-store|localStorage/u);
		expect(source).toMatch(/withDatabaseTransaction/u);
		expect(source).toMatch(/readRuntimeEnvironment/u);
	});
});
