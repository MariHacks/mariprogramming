export const SCIENCE_PBL_ID = 'science';

export const PBL_CATALOG = Object.freeze([
	Object.freeze({
		id: SCIENCE_PBL_ID,
		title: 'Speedrun Programming in Science',
		series: 'PBL 1',
		href: '/pbl/science',
		summary:
			'Little or no Python needed — your team builds one scientific data analyzer that grows step by step from a first print to a short report.'
	})
]);

/** @param {unknown} id */
export function getPblById(id) {
	if (typeof id !== 'string') return null;
	return PBL_CATALOG.find((pbl) => pbl.id === id) ?? null;
}

/**
 * Label for the compact PBL header context chip.
 * Hub stays "Workshops" (morph target); known series use the catalog title.
 * @param {unknown} pathname
 */
export function resolvePblHeaderLabel(pathname) {
	if (typeof pathname !== 'string') return 'Workshops';
	const parts = pathname.split('/').filter(Boolean);
	if (parts[0] !== 'pbl') return 'Workshops';
	if (parts.length < 2) return 'Workshops';
	const pbl = getPblById(parts[1]);
	return pbl?.title ?? 'Workshops';
}
