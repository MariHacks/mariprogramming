import { loadRuntimeCartCatalogue } from '$lib/server/catalogue/runtime';

/** @param {{ loadCatalogue?: typeof loadRuntimeCartCatalogue }} [dependencies] */
export function _createCartPageLoad({ loadCatalogue = loadRuntimeCartCatalogue } = {}) {
	/** @param {{ parent: () => Promise<unknown> }} event */
	return async function load({ parent }) {
		await parent();
		return { catalogue: await loadCatalogue() };
	};
}

export const load = _createCartPageLoad();
