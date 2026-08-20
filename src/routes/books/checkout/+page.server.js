import { loadRuntimeCartCatalogue } from '$lib/server/catalogue/runtime';
import { readRuntimeEnvironment } from '$lib/server/config/environment';

/** @param {{ loadCatalogue?: typeof loadRuntimeCartCatalogue, readEnvironment?: typeof readRuntimeEnvironment }} [dependencies] */
export function _createCheckoutPageLoad({
	loadCatalogue = loadRuntimeCartCatalogue,
	readEnvironment = readRuntimeEnvironment
} = {}) {
	/** @param {{ parent: () => Promise<unknown> }} event */
	return async function load({ parent }) {
		await parent();
		const catalogue = await loadCatalogue();
		return { catalogue, stripeCheckoutHost: readEnvironment().stripeCheckoutHost };
	};
}

export const load = _createCheckoutPageLoad();
