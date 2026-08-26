import { describe, expect, it, vi } from 'vitest';
import {
	buildGoogleCalendarAuthorizeUrl,
	googleCalendarEventBody,
	insertOccurrencesIntoGoogleCalendar
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

describe('googleCalendarEventBody', () => {
	it('maps a class occurrence into a Google event payload', () => {
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
			summary: 'Calculus II',
			location: 'A-301',
			start: { dateTime: '2026-09-08T09:00:00', timeZone: 'America/Toronto' }
		});
	});
});

describe('insertOccurrencesIntoGoogleCalendar', () => {
	it('inserts each occurrence through the Calendar API', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(new Response('{}', { status: 200 }));
		const result = await insertOccurrencesIntoGoogleCalendar(
			[
				{
					title: 'Calculus II',
					courseCode: '201-NYB-05',
					section: '00001',
					teacher: 'Teacher',
					classroom: 'A-301',
					date: '2026-09-08',
					startTime: '09:00',
					endTime: '10:30'
				}
			],
			fetchImpl,
			'access-token'
		);
		expect(result.inserted).toBe(1);
		expect(fetchImpl).toHaveBeenCalledOnce();
	});
});
