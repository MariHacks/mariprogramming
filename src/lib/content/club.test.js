import { describe, expect, it } from 'vitest';
import { getUpcomingEvents, getWorkshopTracks } from './club';

describe('getUpcomingEvents', () => {
	it('excludes an event that has already started', () => {
		const events = [{ id: 'old', startsAt: '2024-08-19T09:00:00-04:00' }];

		expect(getUpcomingEvents(events, new Date('2026-08-01T12:00:00-04:00'))).toEqual([]);
	});

	it('keeps an event that starts at or after the cutoff', () => {
		const events = [
			{ id: 'now', startsAt: '2026-08-01T12:00:00-04:00' },
			{ id: 'next', startsAt: '2026-08-02T09:00:00-04:00' }
		];

		expect(getUpcomingEvents(events, new Date('2026-08-01T12:00:00-04:00'))).toEqual(events);
	});
});

describe('getWorkshopTracks', () => {
	it('groups workshops by their named learning track', () => {
		const pythonIntro = { id: 'python-1', track: 'Python foundations' };
		const webIntro = { id: 'web-1', track: 'Web development' };
		const pythonFunctions = { id: 'python-2', track: 'Python foundations' };

		expect(getWorkshopTracks([pythonIntro, webIntro, pythonFunctions])).toEqual({
			'Python foundations': [pythonIntro, pythonFunctions],
			'Web development': [webIntro]
		});
	});
});
