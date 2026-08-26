import { fail } from '@sveltejs/kit';
import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
import { readRuntimeEnvironment } from '$lib/server/config/environment.js';
import { pushScheduleToGoogleCalendar } from '$lib/server/maritools/google-calendar-push.js';
import { openGoogleCalendarStore } from '$lib/server/maritools/google-calendar-store.js';
import { MariToolsUnavailableError } from '$lib/server/maritools/repository.js';

export const prerender = false;

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const readEnvironment = dependencies.readEnvironment ?? readRuntimeEnvironment;
	const openStore = dependencies.openStore ?? openGoogleCalendarStore;
	const pushSchedule = dependencies.pushSchedule ?? pushScheduleToGoogleCalendar;

	/** @param {any} event */
	async function load(event) {
		const session = event.locals.maritools ?? null;
		let googleCalendarConnected = false;
		if (session?.userId) {
			try {
				googleCalendarConnected = await openStore().hasGrant(session.userId);
			} catch (error) {
				if (!(error instanceof MariToolsUnavailableError)) throw error;
			}
		}
		return {
			signedIn: Boolean(session?.userId),
			googleCalendarConnected,
			gcalStatus: event.url.searchParams.get('gcal') ?? null
		};
	}

	const actions = {
		default: async ({ request }) => {
			const data = await request.formData();
			const paste = String(data.get('paste') ?? '');
			return { result: parseOmnivox(paste) };
		},

		pushGoogleCalendar: async ({ request, locals }) => {
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
			try {
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
					pushError:
						error instanceof Error ? error.message : 'Could not push to Google Calendar.'
				});
			}
		}
	};

	return { load, actions, prerender: false };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
