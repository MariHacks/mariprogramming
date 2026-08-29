/**
 * Staff-facing MariTools catalog conflict queue.
 * Peer contributions for one offering stay side by side until staff picks a winner.
 *
 * @typedef {{
 *   id: string,
 *   documentSha256: string,
 *   structured: unknown,
 *   contributorUserId: string | null,
 *   status: string,
 *   createdAt: string,
 *   updatedAt: string
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

/**
 * @param {Iterable<Record<string, any>>} rows
 * @returns {CatalogConflictGroup[]}
 */
export function buildCatalogConflictGroups(rows) {
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
		group.contributions.push(
			Object.freeze({
				id: String(row.id ?? ''),
				documentSha256: String(row.documentSha256 ?? ''),
				structured: row.structured,
				contributorUserId:
					typeof row.contributorUserId === 'string' ? row.contributorUserId : null,
				status: String(row.status ?? 'conflict'),
				createdAt: toIso(row.createdAt),
				updatedAt: toIso(row.updatedAt)
			})
		);
	}
	return [...byOffering.values()].map((group) =>
		Object.freeze({
			...group,
			contributions: Object.freeze([...group.contributions])
		})
	);
}
