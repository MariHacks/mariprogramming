import { createRuntimeCatalogueRepository } from '$lib/server/catalogue/runtime';

/** @param {{ createRepository?: () => { listActiveCourseSummaries: () => Promise<any[]> } }} [dependencies] */
export function _createBooksPageLoad({ createRepository = createRuntimeCatalogueRepository } = {}) {
	/** @param {{ parent: () => Promise<{ launchState: string }> }} event */
	return async function load({ parent }) {
		const { launchState } = await parent();
		if (launchState !== 'live') return { launchState: 'coming-soon', courseSummaries: [] };
		const courseSummaries = await createRepository().listActiveCourseSummaries();
		return { launchState: 'live', courseSummaries };
	};
}

export const load = _createBooksPageLoad();
