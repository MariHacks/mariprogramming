import { fail } from '@sveltejs/kit';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openCommunityStore
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
		const threadId = event.params.threadId;
		const session = event.locals.maritools ?? null;
		let staff = false;
		try {
			const store = createStore();
			const identity = await staffContext(event, store);
			staff = identity.staff;
			const thread = await store.getThread(threadId);
			if (!thread || thread.removedAt) {
				return {
					thread: null,
					replies: [],
					notFound: true,
					staff: identity.staff,
					signedIn: Boolean(identity.session)
				};
			}
			const replies = await store.listReplies(threadId);
			return {
				thread,
				replies,
				staff: identity.staff,
				signedIn: Boolean(identity.session),
				canReply: Boolean(identity.session) && !thread.lockedAt
			};
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return {
					thread: null,
					replies: [],
					staff,
					signedIn: Boolean(session),
					unavailable: true
				};
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function reply(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		const body = String(data.get('body') ?? '').trim();
		if (!body) return fail(400, { error: 'Write a reply first.' });
		try {
			await createStore().createReply({
				threadId: event.params.threadId,
				authorUserId: session.userId,
				body
			});
			return { replied: true };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Could not post that reply.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Replies are unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function report(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		const targetKind = String(data.get('targetKind') ?? '').trim();
		const targetId = String(data.get('targetId') ?? '').trim();
		const reason = String(data.get('reason') ?? '').trim();
		if (!targetKind || !targetId || !reason) {
			return fail(400, { error: 'Say why you are reporting this.' });
		}
		try {
			await createStore().createReport({
				targetKind,
				targetId,
				reporterUserId: session.userId,
				reason
			});
			return { reported: true };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Could not file that report.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Reports are unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function moderate(event) {
		try {
			const store = createStore();
			const identity = await staffContext(event, store);
			if (!identity.staff) return fail(403, { error: 'Staff only.' });
			const data = await event.request.formData();
			const action = String(data.get('moderation') ?? '').trim();
			const threadId = event.params.threadId;
			if (action === 'lock') await store.lockThread(threadId);
			else if (action === 'remove-thread') await store.removeThread(threadId);
			else if (action === 'remove-reply') {
				const replyId = String(data.get('replyId') ?? '').trim();
				if (!replyId) return fail(400, { error: 'Pick a reply to remove.' });
				await store.removeReply(replyId);
			} else return fail(400, { error: 'Unknown moderation action.' });
			return { moderated: true };
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Moderation is unavailable. Try again.' });
			}
			throw error;
		}
	}

	return { load, actions: { reply, report, moderate } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
