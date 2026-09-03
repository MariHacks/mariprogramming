import { fail } from '@sveltejs/kit';
import { mondayOfWeek } from '$lib/maritools/schedule/academicWeekView.js';
import { availabilityWithWeek } from '$lib/maritools/schedule/freeTimeBoard.js';
import { readRuntimeEnvironment, ServerConfigurationError } from '$lib/server/config/environment.js';
import {
	MariToolsNotFoundError,
	MariToolsUnavailableError,
	MariToolsValidationError
} from '$lib/server/maritools/repository.js';
import { openFreeTimeStore } from '$lib/server/maritools/free-time-store.js';
import { openStudentStore } from '$lib/server/maritools/student-store.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function requiredMonday(value) {
	const text = typeof value === 'string' ? value.trim() : '';
	if (!ISO_DATE.test(text)) return null;
	if (mondayOfWeek(text) !== text) return null;
	return text;
}

export const prerender = false;

/**
 * @param {{ email?: string } | null | undefined} session
 * @param {{ displayName?: string | null } | null | undefined} profile
 */
function signedInDisplayNameFrom(session, profile) {
	const fromProfile =
		typeof profile?.displayName === 'string' ? profile.displayName.trim() : '';
	if (fromProfile) return fromProfile;
	const email = typeof session?.email === 'string' ? session.email.trim() : '';
	if (!email || !email.includes('@')) return null;
	return email.split('@')[0] || null;
}

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const readEnvironment = dependencies.readEnvironment ?? readRuntimeEnvironment;
	const createStore = dependencies.createStore ?? openFreeTimeStore;
	const createStudentStore = dependencies.createStudentStore ?? openStudentStore;

	/** @param {any} event */
	async function load(event) {
		const slug = event.params.slug;
		const session = event.locals?.maritools ?? null;
		try {
			const { appOrigin } = readEnvironment();
			const store = createStore();
			const board = await store.getBoardBySlug(slug);
			if (!board) {
				return { board: null, notFound: true, signedInDisplayName: null, savedSchedulePaste: '' };
			}
			let profile = null;
			let savedSchedulePaste = '';
			if (session?.userId) {
				try {
					const students = createStudentStore();
					const [profileResult, scheduleResult] = await Promise.allSettled([
						students.getProfile(session.userId),
						typeof students.getSchedule === 'function'
							? students.getSchedule(session.userId)
							: Promise.resolve('')
					]);
					profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
					savedSchedulePaste =
						scheduleResult.status === 'fulfilled' ? String(scheduleResult.value ?? '') : '';
				} catch {
					profile = null;
				}
			}
			return {
				board,
				shareUrl: `${appOrigin}/tools/free-time/${board.slug}`,
				signedInDisplayName: signedInDisplayNameFrom(session, profile),
				savedSchedulePaste
			};
		} catch (error) {
			if (error instanceof MariToolsUnavailableError || error instanceof ServerConfigurationError) {
				return { board: null, unavailable: true, signedInDisplayName: null, savedSchedulePaste: '' };
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
		const weekStart = requiredMonday(data.get('weekStart'));
		if (!weekStart) {
			return fail(400, { saveError: 'Pick a valid week before saving.' });
		}
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
			const existing =
				shareToken && Array.isArray(board.members)
					? board.members.find((member) => member.shareToken === shareToken)?.availability
					: null;
			const member = await store.upsertMemberAvailability({
				boardId: board.id,
				displayName,
				availability: availabilityWithWeek(existing, weekStart, new Set(free)),
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
