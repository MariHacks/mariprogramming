import { describe, expect, it } from 'vitest';
import {
	durationHours,
	gridHourLabels,
	layoutTimedMeetings,
	minutesToGridHours,
	nowLineHours,
	parseClockTime
} from './calendarLayout.js';

describe('parseClockTime', () => {
	it('converts HH:MM into minutes from midnight', () => {
		expect(parseClockTime('08:15')).toBe(495);
		expect(parseClockTime('14:05')).toBe(845);
	});
});

describe('minutesToGridHours', () => {
	it('measures hours from the 8 AM grid origin', () => {
		expect(minutesToGridHours(parseClockTime('09:00'))).toBe(1);
		expect(minutesToGridHours(parseClockTime('08:30'))).toBe(0.5);
	});
});

describe('durationHours', () => {
	it('returns the elapsed hours between two minute counts', () => {
		expect(durationHours(parseClockTime('08:15'), parseClockTime('10:05'))).toBeCloseTo(1.833, 2);
	});
});

describe('layoutTimedMeetings', () => {
	it('places non-overlapping meetings in a single lane', () => {
		const placed = layoutTimedMeetings([
			{ startTime: '08:15', endTime: '10:05' },
			{ startTime: '10:15', endTime: '12:05' }
		]);

		expect(placed).toHaveLength(2);
		expect(placed.every((meeting) => meeting.lane === 0 && meeting.lanes === 1)).toBe(true);
		expect(placed.every((meeting) => meeting.conflict === false)).toBe(true);
	});

	it('assigns multiple lanes when meetings overlap', () => {
		const placed = layoutTimedMeetings([
			{ startTime: '08:15', endTime: '10:05' },
			{ startTime: '09:00', endTime: '10:30' }
		]);

		expect(new Set(placed.map((meeting) => meeting.lane))).toEqual(new Set([0, 1]));
		expect(placed.every((meeting) => meeting.lanes === 2)).toBe(true);
		expect(placed.every((meeting) => meeting.conflict === true)).toBe(true);
	});

	it('keeps a later non-overlapping class full width', () => {
		const placed = layoutTimedMeetings([
			{ startTime: '09:00', endTime: '11:00' },
			{ startTime: '13:00', endTime: '15:00' },
			{ startTime: '13:30', endTime: '15:00' }
		]);

		expect(placed[0]).toMatchObject({ startTime: '09:00', lanes: 1, conflict: false });
		expect(placed[1]).toMatchObject({ startTime: '13:00', lanes: 2, conflict: true });
		expect(placed[2]).toMatchObject({ startTime: '13:30', lanes: 2, conflict: true });
	});
});

describe('nowLineHours', () => {
	it('returns hours from 8 AM for a time on the grid', () => {
		expect(nowLineHours(new Date(2026, 8, 8, 10, 18))).toBeCloseTo(2.3, 5);
	});

	it('returns null outside the visible day', () => {
		expect(nowLineHours(new Date(2026, 8, 8, 7, 0))).toBeNull();
		expect(nowLineHours(new Date(2026, 8, 8, 19, 0))).toBeNull();
		expect(nowLineHours(null)).toBeNull();
		expect(nowLineHours(new Date(Number.NaN))).toBeNull();
	});
});

describe('gridHourLabels', () => {
	it('labels the visible day from 8 AM through 6 PM', () => {
		expect(gridHourLabels()).toEqual([
			'8 AM',
			'9 AM',
			'10 AM',
			'11 AM',
			'12 PM',
			'1 PM',
			'2 PM',
			'3 PM',
			'4 PM',
			'5 PM',
			'6 PM'
		]);
	});
});
