/**
 * Staff-facing MariTools catalog conflict queue.
 * Peer contributions for one offering stay side by side until staff picks a winner.
 *
 * @typedef {{
 *   id: string,
 *   status: string,
 *   createdAt: string,
 *   updatedAt: string,
 *   contributorDisplayName: string,
 *   assessments: Array<{ title: string, weight: string, date: string }>,
 *   books: Array<{ title: string, author: string, isbn: string, required: boolean }>
 * }} CatalogConflictContribution
 *
 * @typedef {{
 *   offeringId: string,
 *   courseCode: string,
 *   title: string,
 *   section: string,
 *   teacherName: string,
 *   termId: string,
 *   contributions: CatalogConflictContribution[]
 * }} CatalogConflictGroup
 */

/** @param {unknown} value */
function toIso(value) {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'string' && value) return new Date(value).toISOString();
	return String(value ?? '');
}

/** @param {unknown} value */
function text(value) {
	return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

/**
 * @param {unknown} structured
 * @returns {{
 *   assessments: Array<{ title: string, weight: string, date: string }>,
 *   books: Array<{ title: string, author: string, isbn: string, required: boolean }>
 * }}
 */
export function structuredFactsView(structured) {
	const source =
		structured && typeof structured === 'object' && !Array.isArray(structured)
			? /** @type {Record<string, unknown>} */ (structured)
			: {};
	const assessments = Array.isArray(source.assessments)
		? source.assessments.map((row) => {
				const item = row && typeof row === 'object' ? /** @type {Record<string, unknown>} */ (row) : {};
				return {
					title: text(item.title),
					weight: text(item.weight),
					date: text(item.date)
				};
			})
		: [];
	const books = Array.isArray(source.books)
		? source.books.map((row) => {
				const item = row && typeof row === 'object' ? /** @type {Record<string, unknown>} */ (row) : {};
				return {
					title: text(item.title),
					author: text(item.author),
					isbn: text(item.isbn),
					required: Boolean(item.required)
				};
			})
		: [];
	return { assessments, books };
}

/**
 * @param {Iterable<Record<string, any>>} rows
 * @param {Map<string, string | null> | Record<string, string | null>} [displayNames]
 * @returns {CatalogConflictGroup[]}
 */
export function buildCatalogConflictGroups(rows, displayNames = {}) {
	const names =
		displayNames instanceof Map
			? displayNames
			: new Map(Object.entries(displayNames ?? {}));

	/** @type {Map<string, CatalogConflictGroup>} */
	const byOffering = new Map();
	for (const row of rows) {
		const offeringId = String(row.offeringId ?? '');
		if (!offeringId) continue;
		let group = byOffering.get(offeringId);
		if (!group) {
			group = {
				offeringId,
				courseCode: String(row.courseCode ?? ''),
				title: String(row.title ?? ''),
				section: String(row.section ?? ''),
				teacherName: String(row.teacherName ?? ''),
				termId: String(row.termId ?? ''),
				contributions: []
			};
			byOffering.set(offeringId, group);
		}
		const contributorUserId =
			typeof row.contributorUserId === 'string' ? row.contributorUserId : null;
		const named = contributorUserId ? names.get(contributorUserId) : null;
		const facts = structuredFactsView(row.structured);
		group.contributions.push(
			Object.freeze({
				id: String(row.id ?? ''),
				status: String(row.status ?? 'conflict'),
				createdAt: toIso(row.createdAt),
				updatedAt: toIso(row.updatedAt),
				contributorDisplayName: text(named) || 'Student',
				assessments: facts.assessments,
				books: facts.books
			})
		);
	}
	return [...byOffering.values()]
		.filter((group) => group.contributions.some((row) => row.status === 'conflict'))
		.map((group) =>
			Object.freeze({
				...group,
				contributions: Object.freeze([...group.contributions])
			})
		);
}
