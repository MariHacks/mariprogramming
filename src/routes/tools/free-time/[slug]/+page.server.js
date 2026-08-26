import { fail } from '@sveltejs/kit';
import { availabilityFromFreeCells } from '$lib/maritools/schedule/freeTimeBoard.js';
import { readRuntimeEnvironment } from '$lib/server/config/environment.js';
import {
	MariToolsNotFoundError,
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
		const slug = event.params.slug;
		try {
			const { appOrigin } = readEnvironment();
			const store = createStore();
			const board = await store.getBoardBySlug(slug);
			if (!board) {
				return { board: null, notFound: true };
			}
			return {
				board,
				shareUrl: `${appOrigin}/tools/free-time/${board.slug}`
			};
		} catch (error) {
			if (error instanceof MariToolsUnavailableError) {
				return { board: null, unavailable: true };
			}
			throw error;
		}
	}

	/** @param {any} event */
	async function saveMember(event) {
		const slug = event.params.slug;
		const data = await event.request.formData();
		const displayName = String(data.get('displayName') ?? '');
		const shareToken = String(data.get('shareToken') ?? '');
		const freeJson = String(data.get('freeJson') ?? '[]');
		/** @type {string[]} */
		let free = [];
		try {
			const parsed = JSON.parse(freeJson);
			if (!Array.isArray(parsed)) throw new Error('invalid');
			free = parsed.filter((cell) => typeof cell === 'string');
		} catch {
			return fail(400, { saveError: 'Could not read your availability grid.' });
		}
		try {
			const store = createStore();
			const board = await store.getBoardBySlug(slug);
			if (!board) return fail(404, { saveError: 'Board not found.' });
			const member = await store.upsertMemberAvailability({
				boardId: board.id,
				displayName,
				availability: availabilityFromFreeCells(new Set(free)),
				shareToken: shareToken || null
			});
			return { member, saveSuccess: true };
		} catch (error) {
			if (error instanceof MariToolsValidationError) {
				return fail(400, { saveError: 'Enter a display name before saving.' });
			}
			if (error instanceof MariToolsNotFoundError) {
				return fail(404, { saveError: 'That edit link is no longer valid.' });
			}
			if (error instanceof MariToolsUnavailableError) {
				return fail(503, { saveError: 'Saving is unavailable right now.' });
			}
			throw error;
		}
	}

	return { load, actions: { saveMember } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
