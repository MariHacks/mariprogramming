import { fail, redirect } from '@sveltejs/kit';
import {
	buildClubSubmissionPayload,
	normalizeSubmitterRole
} from '$lib/maritools/club-listing.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openCommunityStore,
	slugFromName
} from '$lib/server/maritools/community-store.js';

export const prerender = false;

/** @param {any[]} clubs @param {string} query @param {string} category */
function filterClubs(clubs, query, category) {
	const needle = query.trim().toLowerCase();
	const wanted = category.trim().toLowerCase();
	return clubs.filter((club) => {
		if (wanted && String(club.category ?? '').toLowerCase() !== wanted) return false;
		if (!needle) return true;
		const haystack = `${club.name} ${club.slug ?? ''} ${club.category ?? ''} ${club.description ?? ''}`.toLowerCase();
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
				...new Set(
					listed
						.map((club) => String(club.category ?? '').trim())
						.filter(Boolean)
				)
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
	async function submit(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		const name = String(data.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Enter the club name.' });
		const submitterRole = normalizeSubmitterRole(data.get('submitterRole'));
		if (!submitterRole) return fail(400, { error: 'Pick your role in this club.' });
		const category = String(data.get('category') ?? '').trim();
		const slug = slugFromName(name);
		if (!slug) return fail(400, { error: 'Enter a club name we can turn into a page slug.' });
		try {
			const submission = await createStore().submitClub({
				submitterUserId: session.userId,
				payload: buildClubSubmissionPayload(null, {
					name,
					slug,
					category,
					submitterRole
				})
			});
			if (!submission?.id) return fail(503, { error: 'Sending a club is unavailable. Try again.' });
			redirect(303, `/tools/clubs/submissions/${submission.id}`);
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Check the club details and try again.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Sending a club is unavailable. Try again.' });
			}
			throw error;
		}
	}

	return { load, actions: { submit } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
