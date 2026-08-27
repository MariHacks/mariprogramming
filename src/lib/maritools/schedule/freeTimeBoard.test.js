import { describe, expect, it } from 'vitest';
import {
	availabilityFromFreeCells,
	commonFreeCells,
	freeCellsFromAvailability,
	freeCellsFromCourses,
	paintCellKey,
	paintSlotLabel,
	paintSlotTimes,
	slugFromBoardTitle
} from './freeTimeBoard.js';

describe('paintSlotTimes', () => {
	it('covers half-hour blocks from 08:00 through 17:30', () => {
		expect(paintSlotTimes()[0]).toBe('08:00');
		expect(paintSlotTimes().at(-1)).toBe('17:30');
		expect(paintSlotTimes()).toHaveLength(20);
	});
});

describe('paintSlotLabel', () => {
	it('labels hour rows like the preview rail', () => {
		expect(paintSlotLabel('08:00')).toBe('8 AM');
		expect(paintSlotLabel('08:30')).toBe(':30');
		expect(paintSlotLabel('12:00')).toBe('12 PM');
		expect(paintSlotLabel('13:00')).toBe('1 PM');
	});
});

describe('freeCellsFromAvailability', () => {
	it('round-trips through availabilityFromFreeCells', () => {
		const cells = new Set([paintCellKey('Mon', '09:00'), paintCellKey('Tue', '10:00')]);
		const serialized = availabilityFromFreeCells(cells);
		expect(freeCellsFromAvailability(serialized)).toEqual(cells);
	});
});

describe('commonFreeCells', () => {
	it('returns only cells every member marked free', () => {
		const shared = paintCellKey('Wed', '12:00');
		expect(commonFreeCells([])).toEqual(new Set());
		expect(
			commonFreeCells([
				{ availability: availabilityFromFreeCells(new Set([shared, paintCellKey('Mon', '09:00')])) },
				{ availability: availabilityFromFreeCells(new Set([shared])) }
			])
		).toEqual(new Set([shared]));
	});
});

describe('freeCellsFromCourses', () => {
	it('marks class times busy and the rest free', () => {
		const cells = freeCellsFromCourses([
			{
				meetings: [{ weekday: 'Mon', startTime: '09:00', endTime: '10:30' }]
			}
		]);
		expect(cells.has(paintCellKey('Mon', '09:00'))).toBe(false);
		expect(cells.has(paintCellKey('Mon', '09:30'))).toBe(false);
		expect(cells.has(paintCellKey('Mon', '10:00'))).toBe(false);
		expect(cells.has(paintCellKey('Mon', '10:30'))).toBe(true);
		expect(cells.has(paintCellKey('Tue', '09:00'))).toBe(true);
	});

	it('skips meetings without a weekday or clock times', () => {
		const cells = freeCellsFromCourses([
			{},
			{ meetings: [{ weekday: 'Sat', startTime: '09:00', endTime: '10:00' }] },
			{ meetings: [{ weekday: 'Mon', startTime: 'nope', endTime: '10:00' }] },
			{ meetings: [{ weekday: 'Mon' }] },
			{ meetings: [{ weekday: 'Tue', startTime: '09:00', endTime: 'nope' }] }
		]);
		expect(cells.has(paintCellKey('Mon', '09:00'))).toBe(true);
	});

	it('returns no cells for missing availability payloads', () => {
		expect(freeCellsFromAvailability(null).size).toBe(0);
		expect(freeCellsFromAvailability([]).size).toBe(0);
		expect(freeCellsFromAvailability({}).size).toBe(0);
	});
});

describe('slugFromBoardTitle', () => {
	it('builds a url-safe slug', () => {
		expect(slugFromBoardTitle('Data Structures study group')).toBe('data-structures-study-group');
	});
});
