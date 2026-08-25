import { fail } from '@sveltejs/kit';
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
		const store = createStore();
		const identity = await staffContext(event, store);
		try {
			const clubs = filterClubs(await store.listClubs(), query, category);
			const pending = identity.staff ? await store.listPendingClubSubmissions() : [];
			return {
				clubs,
				pending,
				query,
				category,
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
					signedIn: Boolean(identity.session),
					staff: identity.staff,
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
		const category = String(data.get('category') ?? '').trim();
		const description = String(data.get('description') ?? '').trim();
		const linkUrl = String(data.get('linkUrl') ?? '').trim();
		const linkLabel = String(data.get('linkLabel') ?? '').trim();
		const slug = slugFromName(name);
		if (!slug) return fail(400, { error: 'Enter a club name we can turn into a page slug.' });
		try {
			await createStore().submitClub({
				submitterUserId: session.userId,
				payload: {
					name,
					slug,
					...(category ? { category } : {}),
					...(description ? { description } : {}),
					...(linkUrl ? { links: [{ label: linkLabel || 'Website', url: linkUrl }] } : {})
				}
			});
			return { submitted: true };
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

	/** @param {any} event */
	async function publish(event) {
		const store = createStore();
		const identity = await staffContext(event, store);
		if (!identity.staff) return fail(403, { error: 'Publishing is limited to staff.' });
		const data = await event.request.formData();
		const submissionId = String(data.get('submissionId') ?? '').trim();
		if (!submissionId) return fail(400, { error: 'Pick a submission to publish.' });
		try {
			await store.publishPendingClub(submissionId);
			return { published: true };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'That listing could not be published. Check the slug and try again.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Publishing is unavailable. Try again.' });
			}
			throw error;
		}
	}

	return { load, actions: { submit, publish } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
