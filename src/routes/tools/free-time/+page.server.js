import { fail, redirect } from '@sveltejs/kit';
import { slugFromBoardTitle } from '$lib/maritools/schedule/freeTimeBoard.js';
import { readRuntimeEnvironment } from '$lib/server/config/environment.js';
import {
	MariToolsConflictError,
	MariToolsUnavailableError,
	MariToolsValidationError
} from '$lib/server/maritools/repository.js';
import { openFreeTimeStore } from '$lib/server/maritools/free-time-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const readEnvironment = dependencies.readEnvironment ?? readRuntimeEnvironment;
	const createStore = dependencies.createStore ?? openFreeTimeStore;

	/** @param {any} event */
	async function load(event) {
		try {
			const store = createStore();
			const boards = await store.listBoards();
			return { boards };
		} catch (error) {
			if (error instanceof MariToolsUnavailableError) {
				return { boards: [], unavailable: true };
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function createBoard(event) {
		const data = await event.request.formData();
		const title = String(data.get('title') ?? '');
		const termId = String(data.get('termId') ?? '');
		const slugInput = String(data.get('slug') ?? '').trim();
		const slug = slugInput || slugFromBoardTitle(title);
		try {
			const store = createStore();
			const session = event.locals.maritools;
			const board = await store.createBoard({
				slug,
				title,
				termId,
				ownerUserId: session && session.userId ? session.userId : null
			});
			throw redirect(303, `/tools/free-time/${board.slug}`);
		} catch (error) {
			if (error instanceof MariToolsValidationError) {
				return fail(400, { createError: 'Enter a board title and term.' });
			}
			if (error instanceof MariToolsConflictError) {
				return fail(409, { createError: 'That board link is already taken. Pick another title.' });
			}
			if (error instanceof MariToolsUnavailableError) {
				return fail(503, { createError: 'Boards are unavailable right now.' });
			}
			throw error;
		}
	}

	return { load, actions: { createBoard } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
