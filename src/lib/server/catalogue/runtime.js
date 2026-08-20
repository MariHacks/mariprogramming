// The generated SvelteKit declarations are outside this repository's JS include.
// @ts-ignore
import { env } from '$env/dynamic/private';
import { CatalogueUnavailableError, createCatalogueRepository } from './repository';

/** @returns {never} */
function unavailable() {
	throw new CatalogueUnavailableError();
}

/**
 * @param {unknown} [source]
 */
function runtimeConfiguration(source) {
	if (source === null || typeof source !== 'object' || Array.isArray(source)) unavailable();

	const configuration = /** @type {Record<string, unknown>} */ (source);
	const databaseUrl = configuration.DATABASE_URL;
	const hostList = configuration.BOOK_DELIVERY_APPROVED_HOSTNAMES;
	const taxValue = configuration.BOOK_DELIVERY_TAX_RATE_BPS;
	if (
		typeof databaseUrl !== 'string' ||
		!databaseUrl ||
		databaseUrl !== databaseUrl.trim() ||
		typeof hostList !== 'string' ||
		!hostList ||
		hostList !== hostList.trim() ||
		typeof taxValue !== 'string' ||
		!/^\d{1,5}$/u.test(taxValue)
	)
		unavailable();

	const approvedHostnames = hostList.split(',');
	if (approvedHostnames.some((host) => !host || host !== host.trim())) unavailable();
	const taxRateBps = Number(taxValue);
	if (!Number.isSafeInteger(taxRateBps) || taxRateBps > 10000) unavailable();

	return { databaseUrl, approvedHostnames, taxRateBps };
}

/** @param {unknown} [source] @param {(configuration: any) => any} [createRepository] */
export function createRuntimeCatalogueRepository(
	source = env,
	createRepository = createCatalogueRepository
) {
	return createRepository(runtimeConfiguration(source));
}

/**
 * Projects the complete active catalogue into the shape used for client-side cart display.
 * @param {Array<any>} courses
 * @param {number} taxRateBps
 */
export function projectCartCatalogue(courses, taxRateBps) {
	const bookstores = new Map();
	const clientBooks = [];
	for (const course of courses) {
		for (const book of course.books) {
			const existing = bookstores.get(book.bookstore.id);
			if (
				existing &&
				(existing.name !== book.bookstore.name ||
					existing.serviceFeeCents !== book.bookstore.serviceFeeCents)
			)
				unavailable();
			bookstores.set(book.bookstore.id, book.bookstore);
			clientBooks.push({
				id: book.id,
				courseId: course.id,
				teacherSlug: course.teacher.slug,
				title: book.title,
				author: book.author,
				isbn: book.isbn,
				priceCents: book.priceCents,
				bookstoreId: book.bookstore.id,
				storefrontUrl: book.storefrontUrl,
				coverUrl: book.coverUrl
			});
		}
	}
	return { taxRateBps, books: clientBooks, bookstores: [...bookstores.values()] };
}

/**
 * @param {unknown} [source]
 * @param {(configuration: any) => any} [createRepository]
 */
export async function loadRuntimeCartCatalogue(
	source = env,
	createRepository = createCatalogueRepository
) {
	const configuration = runtimeConfiguration(source);
	const courses = await createRepository(configuration).listActiveCourseSummaries();
	return projectCartCatalogue(courses, configuration.taxRateBps);
}
