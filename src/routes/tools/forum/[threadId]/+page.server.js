import { fail, redirect } from '@sveltejs/kit';
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

	/** @param {{ session: { userId: string } | null, staff: boolean }} identity */
	function viewerFrom(identity) {
		return {
			userId: identity.session?.userId ?? null,
			staff: identity.staff
		};
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
			const viewer = viewerFrom(identity);
			const thread = await store.getThread(threadId, viewer);
			if (!thread || thread.removedAt) {
				return {
					thread: null,
					replies: [],
					notFound: true,
					staff: identity.staff,
					signedIn: Boolean(identity.session)
				};
			}
			const [replies, courses] = await Promise.all([
				store.listReplies(threadId, viewer),
				store.listCatalogCourses()
			]);
			const courseCode = thread.courseId
				? (courses.find((course) => course.id === thread.courseId)?.code ?? null)
				: null;
			return {
				thread: { ...thread, courseCode },
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
	async function edit(event) {
		try {
			const store = createStore();
			const identity = await staffContext(event, store);
			if (!identity.session) return fail(401, { error: 'Sign in with Google first.' });
			const data = await event.request.formData();
			const targetKind = String(data.get('targetKind') ?? '').trim();
			const targetId = String(data.get('targetId') ?? '').trim();
			const body = String(data.get('body') ?? '').trim();
			if (!targetKind || !targetId || !body) {
				return fail(400, { error: 'Write an updated post first.' });
			}
			const viewer = viewerFrom(identity);
			if (targetKind === 'thread') {
				if (!(await store.canManageThread(targetId, viewer))) {
					return fail(403, { error: 'You cannot edit that.' });
				}
				await store.updateThread({ id: targetId, body });
			} else if (targetKind === 'reply') {
				if (!(await store.canManageReply(targetId, viewer))) {
					return fail(403, { error: 'You cannot edit that.' });
				}
				await store.updateReply({ id: targetId, body });
			} else {
				return fail(400, { error: 'Unknown edit target.' });
			}
			return { edited: true };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Could not save that edit.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Edits are unavailable. Try again.' });
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function deleteAction(event) {
		try {
			const store = createStore();
			const identity = await staffContext(event, store);
			if (!identity.session) return fail(401, { error: 'Sign in with Google first.' });
			const data = await event.request.formData();
			const targetKind = String(data.get('targetKind') ?? '').trim();
			const targetId = String(data.get('targetId') ?? '').trim();
			if (!targetKind || !targetId) {
				return fail(400, { error: 'Pick something to delete.' });
			}
			const viewer = viewerFrom(identity);
			if (targetKind === 'thread') {
				if (!(await store.canManageThread(targetId, viewer))) {
					return fail(403, { error: 'You cannot delete that.' });
				}
				await store.removeThread(targetId);
				throw redirect(303, '/tools/forum');
			}
			if (targetKind === 'reply') {
				if (!(await store.canManageReply(targetId, viewer))) {
					return fail(403, { error: 'You cannot delete that.' });
				}
				await store.removeReply(targetId);
				return { deleted: true };
			}
			return fail(400, { error: 'Unknown delete target.' });
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
				throw error;
			}
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Could not delete that.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Deletes are unavailable. Try again.' });
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

	return { load, actions: { reply, report, edit, delete: deleteAction, moderate } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
