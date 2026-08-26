import { headerAccountView } from '$lib/maritools/header-account.js';
import { openStudentStore } from '$lib/server/maritools/student-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createRootLayoutLoad({
	headerView = headerAccountView,
	createRepository = openStudentStore
} = {}) {
	/** @param {import('@sveltejs/kit').ServerLoadEvent} event */
	return async function load(event) {
		const session = event.locals.maritools ?? null;
		let profile = null;
		if (session) {
			try {
				profile = await createRepository().getProfile(session.userId);
			} catch {
				profile = null;
			}
		}
		return { headerAccount: headerView(session, profile) };
	};
}

export const load = _createRootLayoutLoad();
