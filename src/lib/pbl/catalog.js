export const SCIENCE_PBL_ID = 'science';

export const PBL_CATALOG = Object.freeze([
	Object.freeze({
		id: SCIENCE_PBL_ID,
		title: 'Speedrun Programming in Science',
		series: 'PBL 1',
		href: '/pbl/science',
		duration: 'one activity period',
		summary:
			'A student with little or no Python builds one scientific data-analyzer that keeps growing.'
	})
]);

/** @param {unknown} id */
export function getPblById(id) {
	if (typeof id !== 'string') return null;
	return PBL_CATALOG.find((pbl) => pbl.id === id) ?? null;
}
