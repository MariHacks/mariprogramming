import { fail, redirect } from '@sveltejs/kit';
import { buildClubSubmissionPayload } from '$lib/maritools/club-listing.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openCommunityStore,
	slugFromName
} from '$lib/server/maritools/community-store.js';

export const prerender = false;

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
		const submissionId = event.params.id;
		const session = event.locals.maritools ?? null;
		try {
			const store = createStore();
			const identity = await staffContext(event, store);
			const submission = await store.getClubSubmission(submissionId);
			if (!submission) {
				return { submission: null, notFound: true, canEdit: false, canPublish: false, staff: false };
			}
			const isOwner = Boolean(
				identity.session?.userId && identity.session.userId === submission.submitterUserId
			);
			if (!identity.staff && !isOwner) {
				return { submission: null, notFound: true, canEdit: false, canPublish: false, staff: false };
			}
			const pending = submission.status === 'pending';
			return {
				submission,
				canEdit: pending && (identity.staff || isOwner),
				canPublish: pending && identity.staff,
				staff: identity.staff,
				isOwner
			};
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return {
					submission: null,
					unavailable: true,
					canEdit: false,
					canPublish: false,
					staff: false,
					signedIn: Boolean(session)
				};
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function save(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const submissionId = event.params.id;
		try {
			const store = createStore();
			const identity = await staffContext(event, store);
			const existing = await store.getClubSubmission(submissionId);
			if (!existing) return fail(404, { error: 'That submission is not available.' });
			const isOwner = existing.submitterUserId === session.userId;
			if (!identity.staff && !isOwner) return fail(403, { error: 'You cannot edit this listing.' });
			if (existing.status !== 'pending') {
				return fail(400, { error: 'Only pending listings can be edited.' });
			}
			const data = await event.request.formData();
			const name = String(data.get('name') ?? '').trim();
			if (!name) return fail(400, { error: 'Enter the club name.' });
			const payload = buildClubSubmissionPayload(
				{
					name: existing.name,
					slug: existing.slug,
					category: existing.category,
					description: existing.description,
					links: existing.links,
					submitterRole: existing.submitterRole ?? undefined
				},
				{
					name,
					slug: slugFromName(name) || existing.slug,
					category: String(data.get('category') ?? '').trim(),
					description: String(data.get('description') ?? '').trim(),
					linkLabel: String(data.get('linkLabel') ?? '').trim(),
					linkUrl: String(data.get('linkUrl') ?? '').trim()
				}
			);
			await store.updateClubSubmissionPayload(submissionId, payload);
			return { saved: true };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Check the club details and try again.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Saving is unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function publish(event) {
		try {
			const store = createStore();
			const identity = await staffContext(event, store);
			if (!identity.staff) return fail(403, { error: 'Publishing requires team access.' });
			const submissionId = event.params.id;
			await store.publishPendingClub(submissionId);
			redirect(303, '/tools/clubs');
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, {
					error: 'That listing could not be published. Check the slug and try again.'
				});
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Publishing is unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function reject(event) {
		try {
			const store = createStore();
			const identity = await staffContext(event, store);
			if (!identity.staff) return fail(403, { error: 'Rejecting requires team access.' });
			const submissionId = event.params.id;
			await store.rejectPendingClub(submissionId);
			redirect(303, '/tools/clubs');
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'That listing could not be rejected.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Rejecting is unavailable. Try again.' });
			}
			throw error;
		}
	}

	return { load, actions: { save, publish, reject } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
