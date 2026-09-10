export const SCIENCE_PBL_ID = 'science';

export const PBL_CATALOG = Object.freeze([
	Object.freeze({
		id: SCIENCE_PBL_ID,
		title: 'Speedrun Programming in Science',
		series: 'PBL 1',
		href: '/pbl/science',
		summary:
			'Little or no Python needed. Your team builds one scientific data analyzer that grows step by step.'
	})
]);

/** @param {unknown} id */
export function getPblById(id) {
	if (typeof id !== 'string') return null;
	return PBL_CATALOG.find((pbl) => pbl.id === id) ?? null;
}
