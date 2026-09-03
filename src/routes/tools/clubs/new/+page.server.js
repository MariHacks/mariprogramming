import { fail, redirect } from '@sveltejs/kit';
import { clubListingDraft, clubListingInput } from '$lib/server/maritools/club-listing-input.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openCommunityStore
} from '$lib/server/maritools/community-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createStore = dependencies.createStore ?? openCommunityStore;

	/** @param {any} event */
	function load(event) {
		if (!event.locals.maritools) redirect(303, '/tools/account');
		return {};
	}

	/** @param {any} event */
	async function submit(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		const parsed = clubListingInput(data);
		const values = clubListingDraft(data);
		if (!parsed.payload) return fail(400, { error: parsed.error, values });
		try {
			const submission = await createStore().submitClub({
				submitterUserId: session.userId,
				payload: parsed.payload
			});
			if (!submission?.id)
				return fail(503, { error: 'Sending the listing is unavailable. Try again.' });
			redirect(303, `/tools/clubs/submissions/${submission.id}`);
		} catch (error) {
			if (error instanceof MaritoolsInputError)
				return fail(400, { error: 'Check the club details and try again.', values });
			if (error instanceof MaritoolsUnavailableError)
				return fail(503, { error: 'Sending the listing is unavailable. Try again.', values });
			throw error;
		}
	}

	return { load, actions: { submit } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
