import { fail, redirect } from '@sveltejs/kit';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openCommunityStore
} from '$lib/server/maritools/community-store.js';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const createStore = dependencies.createStore ?? openCommunityStore;

	/** @param {any} event */
	async function load(event) {
		const category = event.url.searchParams.get('category') ?? '';
		const courseIdRaw = event.url.searchParams.get('course') ?? '';
		const courseId = UUID.test(courseIdRaw) ? courseIdRaw : '';
		const query = event.url.searchParams.get('q') ?? '';
		const session = event.locals.maritools ?? null;
		try {
			const store = createStore();
			const filter = {
				...(category === 'courses' || category === 'student-life' ? { category } : {}),
				...(courseId ? { courseId } : {})
			};
			const [threads, courses] = await Promise.all([
				store.listThreads(filter),
				store.listCatalogCourses()
			]);
			const byId = new Map(courses.map((course) => [course.id, course]));
			const needle = query.trim().toLowerCase();
			const listed = threads
				.map((thread) => ({
					...thread,
					courseCode: thread.courseId ? (byId.get(thread.courseId)?.code ?? null) : null
				}))
				.filter((thread) => {
					if (!needle) return true;
					return `${thread.title ?? ''} ${thread.body ?? ''}`.toLowerCase().includes(needle);
				});
			return {
				threads: listed,
				courses,
				category,
				courseId,
				query,
				signedIn: Boolean(session)
			};
		} catch (error) {
			if (error instanceof MaritoolsUnavailableError) {
				return {
					threads: [],
					courses: [],
					category,
					courseId,
					query,
					signedIn: Boolean(session),
					unavailable: true
				};
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function create(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		const title = String(data.get('title') ?? '').trim();
		const body = String(data.get('body') ?? '').trim();
		const category = String(data.get('category') ?? '').trim();
		const courseId = String(data.get('courseId') ?? '').trim();
		if (!title || !body) return fail(400, { error: 'Add a title and a question before posting.' });
		if (category !== 'courses' && category !== 'student-life') {
			return fail(400, { error: 'Pick courses or student life.' });
		}
		if (courseId && !UUID.test(courseId)) {
			return fail(400, { error: 'Pick a course from the catalog.' });
		}
		let thread;
		try {
			thread = await createStore().createThread({
				authorUserId: session.userId,
				title,
				body,
				category,
				...(courseId && category === 'courses' ? { courseId } : {})
			});
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				return fail(400, { error: 'Check the thread and try again.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'The forum is unavailable right now. Try again.' });
			}
			throw error;
		}
		if (!thread?.id) return fail(503, { error: 'Could not create the thread.' });
		redirect(303, `/tools/forum/${thread.id}`);
	}

	return { load, actions: { create } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
