import { fail } from '@sveltejs/kit';
import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
import { readRuntimeEnvironment } from '$lib/server/config/environment.js';
import { pushScheduleToGoogleCalendar } from '$lib/server/maritools/google-calendar-push.js';
import { openGoogleCalendarStore } from '$lib/server/maritools/google-calendar-store.js';
import { MariToolsUnavailableError } from '$lib/server/maritools/repository.js';
import {
	MaritoolsUnavailableError,
	openStudentStore as createStudentStore
} from '$lib/server/maritools/student-store.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const readEnvironment = dependencies.readEnvironment ?? readRuntimeEnvironment;
	const openStore = dependencies.openStore ?? openGoogleCalendarStore;
	const openStudentStore = dependencies.openStudentStore ?? createStudentStore;
	const pushSchedule = dependencies.pushSchedule ?? pushScheduleToGoogleCalendar;

	/** @param {any} event */
	async function load(event) {
		const session = event.locals.maritools ?? null;
		let googleCalendarConnected = false;
		let savedPaste = '';
		if (session?.userId) {
			try {
				googleCalendarConnected = await openStore().hasGrant(session.userId);
			} catch (error) {
				if (!(error instanceof MariToolsUnavailableError)) throw error;
			}
			try {
				savedPaste = await openStudentStore().getSchedule(session.userId);
			} catch (error) {
				if (!(error instanceof MaritoolsUnavailableError)) throw error;
			}
		}
		return {
			signedIn: Boolean(session?.userId),
			savedPaste,
			googleCalendarConnected,
			gcalStatus: event.url.searchParams.get('gcal') ?? null
		};
	}

	const actions = {
		saveSchedule: async (/** @type {any} */ { request, locals }) => {
			const session = locals.maritools;
			if (!session?.userId) {
				return fail(401, { saveError: 'Sign in to save this schedule to your account.' });
			}
			const data = await request.formData();
			const paste = String(data.get('paste') ?? '');
			if (!parseOmnivox(paste).ok) {
				return fail(400, { saveError: 'Paste a valid Omnivox schedule first.' });
			}
			try {
				await openStudentStore().saveSchedule({ userId: session.userId, paste });
				return { saved: true };
			} catch (error) {
				if (error instanceof MaritoolsUnavailableError) {
					return fail(503, { saveError: 'Saving your schedule is unavailable right now.' });
				}
				throw error;
			}
		},
		pushGoogleCalendar: async (/** @type {any} */ { request, locals }) => {
			try {
				const session = locals.maritools;
				if (!session?.userId) {
					return fail(401, { pushError: 'Sign in to push events to Google Calendar.' });
				}

				const data = await request.formData();
				const paste = String(data.get('paste') ?? '');
				const termId = String(data.get('termId') ?? '');
				const parsed = parseOmnivox(paste);
				if (!parsed.ok) {
					return fail(400, { pushError: 'Paste a valid Omnivox schedule first.' });
				}

				const environment = readEnvironment();
				const { ACADEMIC_TERMS } = await import('$lib/maritools/term/calendar.js');
				const term = ACADEMIC_TERMS.find((entry) => entry.id === termId) ?? null;
				if (!term) {
					return fail(400, { pushError: 'Choose a term before pushing to Google Calendar.' });
				}

				const pushResult = await pushSchedule({
					store: openStore(),
					userId: session.userId,
					term,
					courses: parsed.courses,
					environment
				});
				return { pushSuccess: `${pushResult.inserted} events added to Google Calendar.` };
			} catch (error) {
				if (error instanceof MariToolsUnavailableError) {
					return fail(503, { pushError: 'Calendar export is unavailable right now.' });
				}
				return fail(400, {
					pushError: error instanceof Error ? error.message : 'Could not push to Google Calendar.'
				});
			}
		}
	};

	return { load, actions, prerender: false };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
