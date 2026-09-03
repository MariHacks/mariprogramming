import {
	MaritoolsUnavailableError,
	openCommunityStore
} from '$lib/server/maritools/community-store.js';

export const prerender = false;

/** @param {any[]} clubs @param {string} query @param {string} category */
function filterClubs(clubs, query, category) {
	const needle = query.trim().toLowerCase();
	const wanted = category.trim().toLowerCase();
	return clubs.filter((club) => {
		if (wanted && String(club.category ?? '').toLowerCase() !== wanted) return false;
		if (!needle) return true;
		const haystack =
			`${club.name} ${club.slug ?? ''} ${club.category ?? ''} ${club.description ?? ''}`.toLowerCase();
		return haystack.includes(needle);
	});
}

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createStore = dependencies.createStore ?? openCommunityStore;

	/** @param {any} event @param {ReturnType<typeof createStore>} store */
	async function staffContext(event, store) {
		const session = event.locals.maritools ?? null;
		if (!session) return { session: null, staff: false };
		let profile = null;
		try {
			profile = await store.getProfile(session.userId);
		} catch (error) {
			if (!(error instanceof MaritoolsUnavailableError)) throw error;
		}
		return { session, staff: store.isStaff(session.email, profile?.role ?? null) };
	}

	/** @param {any} event */
	async function load(event) {
		const query = event.url.searchParams.get('q') ?? '';
		const category = event.url.searchParams.get('category') ?? '';
		const session = event.locals.maritools ?? null;
		let staff = false;
		try {
			const store = createStore();
			const identity = await staffContext(event, store);
			staff = identity.staff;
			const listed = await store.listClubs();
			const categories = [
				...new Set(listed.map((club) => String(club.category ?? '').trim()).filter(Boolean))
			].sort();
			const clubs = filterClubs(listed, query, category);
			const pending = identity.staff ? await store.listPendingClubSubmissions() : [];
			return {
				clubs,
				pending,
				query,
				category,
				categories,
				signedIn: Boolean(identity.session),
				staff: identity.staff
			};
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return {
					clubs: [],
					pending: [],
					query,
					category,
					categories: [],
					signedIn: Boolean(session),
					staff,
					unavailable: true
				};
			}
			throw error;
		}
	}

	/** @param {any} event */
	return { load };
}

const handlers = _createHandlers();
export const load = handlers.load;
