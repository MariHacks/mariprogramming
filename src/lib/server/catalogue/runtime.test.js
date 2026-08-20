// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { CatalogueUnavailableError } from './repository';
import {
	createRuntimeCatalogueRepository,
	loadRuntimeCartCatalogue,
	projectCartCatalogue
} from './runtime';

const VALID_SOURCE = {
	DATABASE_URL: 'postgresql://app:secret@db.example/club',
	BOOK_DELIVERY_APPROVED_HOSTNAMES: 'shop.example.com,images.example.com',
	BOOK_DELIVERY_TAX_RATE_BPS: '1498'
};

describe('runtime catalogue repository configuration', () => {
	it('passes explicit database, exact hosts, and tax configuration to the repository', () => {
		const repository = { listActiveCourseSummaries: vi.fn() };
		const createRepository = vi.fn(() => repository);

		expect(createRuntimeCatalogueRepository(VALID_SOURCE, createRepository)).toBe(repository);
		expect(createRepository).toHaveBeenCalledWith({
			databaseUrl: VALID_SOURCE.DATABASE_URL,
			approvedHostnames: ['shop.example.com', 'images.example.com'],
			taxRateBps: 1498
		});
	});

	it.each([
		{},
		[],
		{ ...VALID_SOURCE, DATABASE_URL: '' },
		{ ...VALID_SOURCE, BOOK_DELIVERY_APPROVED_HOSTNAMES: '' },
		{ ...VALID_SOURCE, BOOK_DELIVERY_APPROVED_HOSTNAMES: 'shop.example.com, shop.example.com' },
		{ ...VALID_SOURCE, BOOK_DELIVERY_TAX_RATE_BPS: '' },
		{ ...VALID_SOURCE, BOOK_DELIVERY_TAX_RATE_BPS: '14.98' },
		{ ...VALID_SOURCE, BOOK_DELIVERY_TAX_RATE_BPS: '10001' }
	])('fails closed for absent or invalid public catalogue configuration %#', (source) => {
		expect(() => createRuntimeCatalogueRepository(source, vi.fn())).toThrow(
			CatalogueUnavailableError
		);
	});
});

describe('client cart catalogue projection', () => {
	const course = {
		id: 'course-id',
		teacher: { slug: 'prof-a', name: 'Prof A' },
		books: [
			{
				id: 'book-a',
				title: 'Book A',
				author: 'Writer',
				isbn: null,
				priceCents: 1200,
				storefrontUrl: 'https://shop.example.com/a',
				coverUrl: null,
				bookstore: { id: 'store-a', name: 'Store A', serviceFeeCents: 500 }
			},
			{
				id: 'book-b',
				title: 'Book B',
				author: null,
				isbn: '123',
				priceCents: 900,
				storefrontUrl: 'https://shop.example.com/b',
				coverUrl: 'https://images.example.com/b.webp',
				bookstore: { id: 'store-a', name: 'Store A', serviceFeeCents: 500 }
			}
		]
	};

	it('projects active course books and deduplicates their bookstores', () => {
		expect(projectCartCatalogue([course], 1498)).toEqual({
			taxRateBps: 1498,
			books: [
				{
					id: 'book-a',
					courseId: 'course-id',
					teacherSlug: 'prof-a',
					title: 'Book A',
					author: 'Writer',
					isbn: null,
					priceCents: 1200,
					bookstoreId: 'store-a',
					storefrontUrl: 'https://shop.example.com/a',
					coverUrl: null
				},
				{
					id: 'book-b',
					courseId: 'course-id',
					teacherSlug: 'prof-a',
					title: 'Book B',
					author: null,
					isbn: '123',
					priceCents: 900,
					bookstoreId: 'store-a',
					storefrontUrl: 'https://shop.example.com/b',
					coverUrl: 'https://images.example.com/b.webp'
				}
			],
			bookstores: [{ id: 'store-a', name: 'Store A', serviceFeeCents: 500 }]
		});
	});

	it('rejects inconsistent bookstore facts across active books', () => {
		const inconsistent = structuredClone(course);
		inconsistent.books[1].bookstore.name = 'Changed Store';
		expect(() => projectCartCatalogue([inconsistent], 1498)).toThrow(CatalogueUnavailableError);
	});

	it('loads repository summaries and applies the configured tax rate', async () => {
		const listActiveCourseSummaries = vi.fn().mockResolvedValue([course]);
		const createRepository = vi.fn(() => ({ listActiveCourseSummaries }));
		await expect(loadRuntimeCartCatalogue(VALID_SOURCE, createRepository)).resolves.toEqual(
			projectCartCatalogue([course], 1498)
		);
		expect(listActiveCourseSummaries).toHaveBeenCalledOnce();
	});
});
