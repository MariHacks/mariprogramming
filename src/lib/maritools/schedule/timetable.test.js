import { describe, expect, it } from 'vitest';
import { hasOverlap, weekGrid } from './timetable.js';
import { parseOmnivox } from './parseOmnivox.js';
import { CANONICAL_OMNIVOX_SCHEDULE } from './fixture.js';

describe('weekGrid', () => {
	it('places fixture meetings Monday through Friday', () => {
		const grid = weekGrid(parseOmnivox(CANONICAL_OMNIVOX_SCHEDULE).courses);
		expect(grid.map((column) => column.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
		expect(grid[0].meetings[0].classroom).toBe('GYM');
		expect(grid.some((column) => column.overlap)).toBe(false);
	});
});

describe('hasOverlap', () => {
	it('detects overlapping clock times', () => {
		expect(
			hasOverlap([
				{ startTime: '08:15', endTime: '10:05' },
				{ startTime: '09:00', endTime: '11:00' }
			])
		).toBe(true);
		expect(
			hasOverlap([
				{ startTime: '08:15', endTime: '10:05' },
				{ startTime: '10:15', endTime: '12:05' }
			])
		).toBe(false);
		expect(hasOverlap([{ startTime: '08:15', endTime: '10:05' }])).toBe(false);
	});
});
