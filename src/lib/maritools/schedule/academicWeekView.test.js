import { describe, expect, it } from 'vitest';
import { ACADEMIC_CALENDAR_RULES, ACADEMIC_TERMS } from '../term/calendar.js';
import {
	mondayOfWeek,
	weekGridForTermWeek,
	weekTitle
} from './academicWeekView.js';

const fallTerm = ACADEMIC_TERMS.find((term) => term.id === 'fall-2026');
const fallRules = ACADEMIC_CALENDAR_RULES['fall-2026'];

describe('mondayOfWeek', () => {
	it('returns the Monday on or before the given date', () => {
		expect(mondayOfWeek('2026-09-09')).toBe('2026-09-07');
		expect(mondayOfWeek('2026-09-08')).toBe('2026-09-07');
		expect(mondayOfWeek('2026-09-13')).toBe('2026-09-07');
	});
});

describe('weekGridForTermWeek', () => {
	it('marks Labour Day as a no-class column', () => {
		const weekStart = mondayOfWeek('2026-09-07');
		const grid = weekGridForTermWeek(weekStart, fallTerm, fallRules, [], '2026-09-07');
		expect(grid[0].date).toBe('2026-09-07');
		expect(grid[0].isNoClass).toBe(true);
		expect(grid[0].meetings).toEqual([]);
	});

	it('uses schedule overrides for class meetings', () => {
		const weekStart = mondayOfWeek('2026-09-08');
		const grid = weekGridForTermWeek(
			weekStart,
			fallTerm,
			fallRules,
			[
				{
					title: 'Calculus II',
					courseCode: '201-NYB-05',
					section: '00001',
					teacher: 'Teacher',
					meetings: [{ weekday: 'Mon', startTime: '09:00', endTime: '10:30', classroom: 'A-301' }]
				}
			],
			'2026-09-08'
		);
		expect(grid[1].date).toBe('2026-09-08');
		expect(grid[1].isNoClass).toBe(false);
		expect(grid[1].meetings[0]?.title).toBe('Calculus II');
	});
});

describe('weekTitle', () => {
	it('labels a week within one month', () => {
		expect(weekTitle('2026-09-07')).toBe('Week of September 7');
	});

	it('labels a week that spans two months', () => {
		expect(weekTitle('2026-09-28')).toBe('Week of September 28 to October 2');
	});
});
