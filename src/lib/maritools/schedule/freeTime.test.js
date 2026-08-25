import { describe, expect, it } from 'vitest';
import { ACADEMIC_CALENDAR_RULES } from '../term/calendar.js';
import { CANONICAL_OMNIVOX_SCHEDULE } from './fixture.js';
import {
	commonFreeOnDate,
	commonFreeOnWeekday,
	commonFreeWeek,
	effectiveWeekdayForDate
} from './freeTime.js';
import { parseOmnivox } from './parseOmnivox.js';

const FALL_RULES = ACADEMIC_CALENDAR_RULES['fall-2026'];

describe('commonFreeOnWeekday', () => {
	it('finds a late-morning gap on Tuesday for the fixture plus an empty schedule', () => {
		const me = parseOmnivox(CANONICAL_OMNIVOX_SCHEDULE).courses;
		const slots = commonFreeOnWeekday([me, []], 'Tue', 45);
		expect(slots.some((slot) => slot.startTime === '10:05' && slot.endTime === '14:15')).toBe(
			true
		);
	});

	it('merges overlapping busy blocks', () => {
		const left = parseOmnivox(
			'1  Algebra\n101-AA1-MQ sec.00001, teacher: T\nMon 08:15 - 10:05, classroom X\n'
		).courses;
		const right = parseOmnivox(
			'1  Biology\n102-AA1-MQ sec.00001, teacher: T\nMon 09:00 - 12:05, classroom Y\n'
		).courses;
		const slots = commonFreeOnWeekday([left, right], 'Mon', 30);
		expect(slots[0]).toEqual({ startTime: '12:05', endTime: '18:00' });
	});
});

describe('commonFreeWeek', () => {
	it('returns five weekdays', () => {
		expect(commonFreeWeek([[]]).map((/** @type {{ weekday: string }} */ row) => row.weekday)).toEqual([
			'Mon',
			'Tue',
			'Wed',
			'Thu',
			'Fri'
		]);
	});
});

describe('effectiveWeekdayForDate', () => {
	it('follows Monday schedule overrides on 2026-09-08', () => {
		expect(effectiveWeekdayForDate('2026-09-08', FALL_RULES)).toBe('Mon');
		expect(effectiveWeekdayForDate('2026-09-07', FALL_RULES)).toBeNull();
	});
});

describe('commonFreeOnDate', () => {
	it('uses calendar rules for a specific date', () => {
		const me = parseOmnivox(CANONICAL_OMNIVOX_SCHEDULE).courses;
		const slots = commonFreeOnDate([me, []], '2026-09-08', FALL_RULES, 45);
		expect(slots.length).toBeGreaterThan(0);
	});
});
