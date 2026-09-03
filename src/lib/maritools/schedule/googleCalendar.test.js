import { describe, expect, it, vi } from 'vitest';
import {
	buildGoogleCalendarAuthorizeUrl,
	formatClock,
	googleCalendarEventBody,
	insertOccurrencesIntoGoogleCalendar,
	noSchoolDatesInWindow,
	occurrenceWindow
} from './googleCalendar.js';

describe('buildGoogleCalendarAuthorizeUrl', () => {
	it('requests offline calendar event scope', () => {
		const url = new URL(
			buildGoogleCalendarAuthorizeUrl('client-id', 'https://example.com/callback', 'state-token')
		);
		expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.events');
		expect(url.searchParams.get('access_type')).toBe('offline');
		expect(url.searchParams.get('prompt')).toBe('consent');
	});
});

describe('calendar value helpers', () => {
	it('formats clock boundary and malformed inputs', () => {
		expect(formatClock('12')).toBe('12:00 PM');
		expect(formatClock('00:05')).toBe('12:05 AM');
		expect(formatClock('13:07')).toBe('1:07 PM');
		expect(formatClock('bad')).toBe('bad');
	});

	it('builds and filters date windows at empty boundaries', () => {
		expect(occurrenceWindow([])).toBeNull();
		expect(occurrenceWindow([], ['', '2026-09-08'])).toEqual({
			timeMin: '2026-09-08T00:00:00-04:00',
			timeMax: '2026-09-08T23:59:59-04:00'
		});
		expect(noSchoolDatesInWindow(['', '2026-09-08', '2026-09-08'], null)).toEqual(['2026-09-08']);
		expect(
			noSchoolDatesInWindow(['2026-09-07', '2026-09-08', '2026-09-10'], {
				timeMin: '2026-09-08T00:00:00-04:00',
				timeMax: '2026-09-09T23:59:59-04:00'
			})
		).toEqual(['2026-09-08']);
	});
});

describe('googleCalendarEventBody', () => {
	it('maps a class occurrence with visible start–end on the tile summary', () => {
		expect(
			googleCalendarEventBody({
				title: 'Calculus II',
				courseCode: '201-NYB-05',
				section: '00001',
				teacher: 'Teacher',
				classroom: 'A-301',
				date: '2026-09-08',
				startTime: '09:00',
				endTime: '10:30'
			})
		).toMatchObject({
			summary: '9:00 AM–10:30 AM Calculus II',
			location: 'A-301',
			start: { dateTime: '2026-09-08T09:00:00', timeZone: 'America/Toronto' },
			end: { dateTime: '2026-09-08T10:30:00', timeZone: 'America/Toronto' }
		});
	});
});

describe('googleCalendarNoSchoolEventBody', () => {
	it('builds an all-day no-school marker with exclusive end date', async () => {
		const { googleCalendarNoSchoolEventBody } = await import('./googleCalendar.js');
		expect(googleCalendarNoSchoolEventBody('2026-09-07')).toMatchObject({
			summary: 'No school',
			start: { date: '2026-09-07' },
			end: { date: '2026-09-08' },
			extendedProperties: { private: { maritools: '1', occurrenceKey: 'noshool|2026-09-07' } }
		});
	});
});

describe('insertOccurrencesIntoGoogleCalendar', () => {
	const occurrence = {
		title: 'Calculus II',
		courseCode: '201-NYB-05',
		section: '00001',
		teacher: 'Teacher',
		classroom: 'A-301',
		date: '2026-09-08',
		startTime: '09:00',
		endTime: '10:30'
	};

	it('throws when Google rejects an insert', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
			.mockResolvedValueOnce(new Response('quota', { status: 403 }));
		await expect(
			insertOccurrencesIntoGoogleCalendar([occurrence], fetchImpl, 'access-token')
		).rejects.toThrow(/Google Calendar insert failed/);
	});

	it('clears prior MariTools events then inserts class blocks and no-school days', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ items: [{ id: 'old-1' }, { id: 'old-2' }] }), {
					status: 200
				})
			)
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }));
		const result = await insertOccurrencesIntoGoogleCalendar(
			[occurrence],
			fetchImpl,
			'access-token',
			{ noSchoolDates: ['2026-09-07'] }
		);
		expect(result).toEqual({ inserted: 2, deleted: 2, noSchool: 1 });
		expect(fetchImpl).toHaveBeenCalledTimes(5);
		expect(String(fetchImpl.mock.calls[0][0])).toContain('privateExtendedProperty=maritools%3D1');
		expect(JSON.parse(String(fetchImpl.mock.calls[3][1].body)).summary).toBe(
			'9:00 AM–10:30 AM Calculus II'
		);
		expect(JSON.parse(String(fetchImpl.mock.calls[4][1].body))).toMatchObject({
			summary: 'No school',
			start: { date: '2026-09-07' }
		});
	});

	it('throws when Google Calendar insert fails', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
			.mockResolvedValueOnce(new Response('nope', { status: 500 }));
		await expect(
			insertOccurrencesIntoGoogleCalendar([occurrence], fetchImpl, 'access-token')
		).rejects.toThrow(/Google Calendar insert failed/);
	});

	it('ignores malformed list payloads and empty event ids', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ items: {} }), { status: 200 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }));
		await expect(
			insertOccurrencesIntoGoogleCalendar([occurrence], fetchImpl, 'access-token')
		).resolves.toEqual({ inserted: 1, deleted: 0, noSchool: 0 });

		const withEmptyId = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ items: [null, {}] }), { status: 200 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }));
		await insertOccurrencesIntoGoogleCalendar([occurrence], withEmptyId, 'access-token');
		expect(withEmptyId).toHaveBeenCalledTimes(2);
	});

	it('counts already-gone events and rejects no-school inserts', async () => {
		const gone = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ items: [{ id: 'gone' }] }), { status: 200 })
			)
			.mockResolvedValueOnce(new Response(null, { status: 410 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }));
		await expect(insertOccurrencesIntoGoogleCalendar([occurrence], gone, 'token')).resolves.toEqual(
			{
				inserted: 1,
				deleted: 1,
				noSchool: 0
			}
		);

		const noSchoolFailure = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
			.mockResolvedValueOnce(new Response('denied', { status: 403 }));
		await expect(
			insertOccurrencesIntoGoogleCalendar([], noSchoolFailure, 'token', {
				noSchoolDates: ['2026-09-07']
			})
		).rejects.toThrow('Google Calendar no-school insert failed');
	});
});

describe('exchangeGoogleCalendarCode', () => {
	it('returns the token payload', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r' }), { status: 200 })
			);
		const { exchangeGoogleCalendarCode } = await import('./googleCalendar.js');
		await expect(
			exchangeGoogleCalendarCode('id', 'secret', 'https://example.com/cb', 'code', fetchImpl)
		).resolves.toMatchObject({ access_token: 'a' });
	});

	it('throws when the exchange fails', async () => {
		const { exchangeGoogleCalendarCode } = await import('./googleCalendar.js');
		await expect(
			exchangeGoogleCalendarCode(
				'id',
				'secret',
				'https://example.com/cb',
				'code',
				vi.fn().mockResolvedValue(new Response('no', { status: 400 }))
			)
		).rejects.toThrow('Google token exchange failed');
	});
});

describe('refreshGoogleCalendarAccessToken', () => {
	it('returns the refreshed token payload', async () => {
		const { refreshGoogleCalendarAccessToken } = await import('./googleCalendar.js');
		await expect(
			refreshGoogleCalendarAccessToken(
				'id',
				'secret',
				'refresh',
				vi
					.fn()
					.mockResolvedValue(new Response(JSON.stringify({ access_token: 'n' }), { status: 200 }))
			)
		).resolves.toMatchObject({ access_token: 'n' });
	});

	it('throws when refresh fails', async () => {
		const { refreshGoogleCalendarAccessToken } = await import('./googleCalendar.js');
		await expect(
			refreshGoogleCalendarAccessToken(
				'id',
				'secret',
				'refresh',
				vi.fn().mockResolvedValue(new Response('no', { status: 400 }))
			)
		).rejects.toThrow('Google token refresh failed');
	});
});
