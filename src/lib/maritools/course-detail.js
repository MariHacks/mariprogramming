import { structuredFactsView } from '$lib/server/maritools/staff-catalog-conflicts.js';

/**
 * Build a public course detail model: published offerings, inline conflict peers, forum threads.
 *
 * @param {{
 *   courseId: string,
 *   published: Array<Record<string, any>>,
 *   conflicts: Array<Record<string, any>>,
 *   threads: Array<Record<string, any>>
 * }} input
 */
export function buildCourseDetailPage(input) {
	const courseId = String(input.courseId ?? '');
	const published = (input.published ?? []).filter((row) => String(row.courseId) === courseId);
	const conflicts = (input.conflicts ?? []).filter((row) => String(row.courseId) === courseId);
	const primary = published[0] ?? conflicts.find((row) => row.status === 'published') ?? null;
	if (!primary) return null;

	/** @type {Map<string, { offeringId: string, section: string, teacherName: string, termId: string, published: any, peers: any[] }>} */
	const offerings = new Map();
	for (const row of [...published, ...conflicts]) {
		const offeringId = String(row.offeringId ?? row.id ?? '');
		if (!offeringId && !row.section) continue;
		const key = String(row.offeringId ?? `${row.termId}|${row.section}|${row.teacherName}`);
		let entry = offerings.get(key);
		if (!entry) {
			entry = {
				offeringId: String(row.offeringId ?? key),
				section: String(row.section ?? ''),
				teacherName: String(row.teacherName ?? ''),
				termId: String(row.termId ?? ''),
				published: null,
				peers: []
			};
			offerings.set(key, entry);
		}
		const facts = structuredFactsView(row.structured);
		const view = {
			id: String(row.id ?? ''),
			status: String(row.status ?? 'published'),
			assessments: facts.assessments,
			books: facts.books
		};
		if (view.status === 'published' && !entry.published) entry.published = view;
		else entry.peers.push(view);
	}

	const offeringViews = [...offerings.values()].map((entry) => {
		const publishedFacts = entry.published ?? entry.peers.find((p) => p.status === 'published') ?? null;
		const conflictPeers = entry.peers.filter((p) => p.status === 'conflict');
		const assessments = (publishedFacts?.assessments ?? []).map((row, index) => ({
			...row,
			conflicts: conflictPeers.flatMap((peer) => {
				const alt = peer.assessments[index];
				if (!alt) return [];
				const differs =
					alt.title !== row.title || alt.weight !== row.weight || alt.date !== row.date;
				return differs ? [{ ...alt, fromStatus: peer.status }] : [];
			})
		}));
		const books = (publishedFacts?.books ?? []).map((row, index) => ({
			...row,
			conflicts: conflictPeers.flatMap((peer) => {
				const alt = peer.books[index];
				if (!alt) return [];
				const differs =
					alt.title !== row.title ||
					alt.author !== row.author ||
					alt.isbn !== row.isbn ||
					Boolean(alt.required) !== Boolean(row.required);
				return differs ? [{ ...alt, fromStatus: peer.status }] : [];
			})
		}));
		return {
			offeringId: entry.offeringId,
			section: entry.section,
			teacherName: entry.teacherName,
			termId: entry.termId,
			hasConflicts: conflictPeers.length > 0,
			assessments,
			books
		};
	});

	return {
		courseId,
		courseCode: String(primary.courseCode ?? ''),
		title: String(primary.title ?? ''),
		offerings: offeringViews,
		threads: (input.threads ?? []).map((thread) => ({
			id: String(thread.id ?? ''),
			title: String(thread.title ?? ''),
			createdAt: thread.createdAt ?? null,
			authorDisplayName: thread.authorDisplayName ?? null
		}))
	};
}
