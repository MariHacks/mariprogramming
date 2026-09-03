export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const GOOGLE_CALENDAR_TIMEZONE = 'America/Toronto';

/**
 * @param {string} hhmm
 * @returns {string}
 */
export function formatClock(hhmm) {
	const [h, m] = String(hhmm).split(':');
	const hour = Number(h);
	const minute = String(m ?? '00').padStart(2, '0');
	if (!Number.isFinite(hour)) return String(hhmm);
	const suffix = hour >= 12 ? 'PM' : 'AM';
	const twelve = hour % 12 === 0 ? 12 : hour % 12;
	return `${twelve}:${minute} ${suffix}`;
}

/**
 * @param {string} isoDate
 * @returns {string}
 */
function nextCivilDate(isoDate) {
	const [year, month, day] = isoDate.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day + 1));
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, '0');
	const d = String(date.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * @param {string} clientId
 * @param {string} redirectUri
 * @param {string} state
 * @returns {string}
 */
export function buildGoogleCalendarAuthorizeUrl(clientId, redirectUri, state) {
	const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	url.searchParams.set('client_id', clientId);
	url.searchParams.set('redirect_uri', redirectUri);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', GOOGLE_CALENDAR_SCOPE);
	url.searchParams.set('access_type', 'offline');
	url.searchParams.set('prompt', 'consent');
	url.searchParams.set('include_granted_scopes', 'true');
	url.searchParams.set('state', state);
	return url.toString();
}

/**
 * Timed class block. Summary includes the end time so week/day tiles show the full range.
 * @param {import('./occurrences.js').ClassOccurrence} occurrence
 * @returns {object}
 */
export function googleCalendarEventBody(occurrence) {
	const occurrenceKey = [
		occurrence.courseCode,
		occurrence.section,
		occurrence.date,
		occurrence.startTime
	].join('|');
	const range = `${formatClock(occurrence.startTime)}–${formatClock(occurrence.endTime)}`;
	return {
		summary: `${range} ${occurrence.title}`,
		location: occurrence.classroom,
		description: `${occurrence.courseCode} sec.${occurrence.section}, teacher: ${occurrence.teacher}\n${range}`,
		start: {
			dateTime: `${occurrence.date}T${occurrence.startTime}:00`,
			timeZone: GOOGLE_CALENDAR_TIMEZONE
		},
		end: {
			dateTime: `${occurrence.date}T${occurrence.endTime}:00`,
			timeZone: GOOGLE_CALENDAR_TIMEZONE
		},
		extendedProperties: {
			private: {
				maritools: '1',
				occurrenceKey
			}
		}
	};
}

/**
 * All-day college closed / no-school marker (Google end date is exclusive).
 * @param {string} date YYYY-MM-DD
 * @param {string} [title]
 * @returns {object}
 */
export function googleCalendarNoSchoolEventBody(date, title = 'No school') {
	return {
		summary: title,
		description: 'Marianopolis college closed / no classes (MariTools calendar).',
		start: { date },
		end: { date: nextCivilDate(date) },
		extendedProperties: {
			private: {
				maritools: '1',
				occurrenceKey: `noshool|${date}`
			}
		}
	};
}

/**
 * @param {import('./occurrences.js').ClassOccurrence[]} occurrences
 * @param {string[]} [noSchoolDates]
 * @returns {{ timeMin: string, timeMax: string } | null}
 */
export function occurrenceWindow(occurrences, noSchoolDates = []) {
	const dates = [...occurrences.map((row) => row.date), ...noSchoolDates]
		.filter(Boolean)
		.sort();
	if (!dates.length) return null;
	return {
		timeMin: `${dates[0]}T00:00:00-04:00`,
		timeMax: `${dates[dates.length - 1]}T23:59:59-04:00`
	};
}

/**
 * @param {string[]} noSchoolDates
 * @param {{ timeMin: string, timeMax: string } | null} window
 * @returns {string[]}
 */
export function noSchoolDatesInWindow(noSchoolDates, window) {
	if (!window) return [...new Set(noSchoolDates)].filter(Boolean).sort();
	const start = window.timeMin.slice(0, 10);
	const end = window.timeMax.slice(0, 10);
	return [...new Set(noSchoolDates)].filter((date) => date >= start && date <= end).sort();
}

/**
 * Replace prior MariTools pushes in the same window, then insert class blocks + no-school days.
 * @param {import('./occurrences.js').ClassOccurrence[]} occurrences
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} fetchImpl
 * @param {string} accessToken
 * @param {{ noSchoolDates?: string[] }} [opts]
 * @returns {Promise<{ inserted: number, deleted: number, noSchool: number }>}
 */
export async function insertOccurrencesIntoGoogleCalendar(
	occurrences,
	fetchImpl,
	accessToken,
	opts = {}
) {
	let deleted = 0;
	const noSchoolDates = opts.noSchoolDates ?? [];
	const window = occurrenceWindow(occurrences, noSchoolDates);
	if (window) {
		const listUrl = new URL(
			'https://www.googleapis.com/calendar/v3/calendars/primary/events'
		);
		listUrl.searchParams.set('privateExtendedProperty', 'maritools=1');
		listUrl.searchParams.set('singleEvents', 'true');
		listUrl.searchParams.set('timeMin', window.timeMin);
		listUrl.searchParams.set('timeMax', window.timeMax);
		listUrl.searchParams.set('maxResults', '2500');
		const listed = await fetchImpl(listUrl.toString(), {
			headers: { authorization: `Bearer ${accessToken}` }
		});
		if (listed.ok) {
			const payload = await listed.json();
			const items = Array.isArray(payload?.items) ? payload.items : [];
			for (const item of items) {
				const eventId = String(item?.id ?? '');
				if (!eventId) continue;
				const del = await fetchImpl(
					`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
					{
						method: 'DELETE',
						headers: { authorization: `Bearer ${accessToken}` }
					}
				);
				if (del.ok || del.status === 410) deleted += 1;
			}
		}
	}

	let inserted = 0;
	for (const occurrence of occurrences) {
		const response = await fetchImpl(
			'https://www.googleapis.com/calendar/v3/calendars/primary/events',
			{
				method: 'POST',
				headers: {
					authorization: `Bearer ${accessToken}`,
					'content-type': 'application/json'
				},
				body: JSON.stringify(googleCalendarEventBody(occurrence))
			}
		);
		if (!response.ok) {
			const body = await response.text();
			throw new Error(`Google Calendar insert failed (${response.status}): ${body.slice(0, 200)}`);
		}
		inserted += 1;
	}

	let noSchool = 0;
	for (const date of noSchoolDatesInWindow(noSchoolDates, window)) {
		const response = await fetchImpl(
			'https://www.googleapis.com/calendar/v3/calendars/primary/events',
			{
				method: 'POST',
				headers: {
					authorization: `Bearer ${accessToken}`,
					'content-type': 'application/json'
				},
				body: JSON.stringify(googleCalendarNoSchoolEventBody(date))
			}
		);
		if (!response.ok) {
			const body = await response.text();
			throw new Error(
				`Google Calendar no-school insert failed (${response.status}): ${body.slice(0, 200)}`
			);
		}
		noSchool += 1;
		inserted += 1;
	}

	return { inserted, deleted, noSchool };
}

/**
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} redirectUri
 * @param {string} code
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} fetchImpl
 */
export async function exchangeGoogleCalendarCode(clientId, clientSecret, redirectUri, code, fetchImpl) {
	const response = await fetchImpl('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});
	if (!response.ok) {
		throw new Error('Google token exchange failed');
	}
	return response.json();
}

/**
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} refreshToken
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} fetchImpl
 */
export async function refreshGoogleCalendarAccessToken(clientId, clientSecret, refreshToken, fetchImpl) {
	const response = await fetchImpl('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: refreshToken,
			grant_type: 'refresh_token'
		})
	});
	if (!response.ok) {
		throw new Error('Google token refresh failed');
	}
	return response.json();
}
