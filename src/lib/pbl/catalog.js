export const SCIENCE_PBL_ID = 'science';
export const GAMEJAM_PBL_ID = 'gamejam';

export const PBL_CATALOG = Object.freeze([
	Object.freeze({
		id: SCIENCE_PBL_ID,
		title: 'Speedrun Programming in Science',
		series: 'PBL 1',
		href: '/pbl/science',
		summary:
			'Little or no Python needed — your team builds one scientific data analyzer that grows step by step from a first print to a short report.'
	}),
	Object.freeze({
		id: GAMEJAM_PBL_ID,
		title: 'Game Jam: Survive the Day',
		series: 'PBL 2',
		href: '/pbl/gamejam',
		summary:
			'Your team builds one text adventure that grows scene by scene, from a first print to a game with choices, dice rolls and a surprise quiz, then adds a scene of its own.'
	})
]);

/** @param {unknown} id */
export function getPblById(id) {
	if (typeof id !== 'string') return null;
	return PBL_CATALOG.find((pbl) => pbl.id === id) ?? null;
}

/**
 * The catalog entry for a /pbl/<id>[/...] path, or null on the hub and unknown paths.
 * @param {unknown} pathname
 */
export function getPblByPath(pathname) {
	if (typeof pathname !== 'string') return null;
	const parts = pathname.split('/').filter(Boolean);
	if (parts[0] !== 'pbl' || parts.length < 2) return null;
	return getPblById(parts[1]);
}

/**
 * Label for the compact PBL header context chip.
 * Hub stays "Workshops" (morph target); known series use the catalog title.
 * @param {unknown} pathname
 */
export function resolvePblHeaderLabel(pathname) {
	return getPblByPath(pathname)?.title ?? 'Workshops';
}
