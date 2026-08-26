import { describe, expect, it } from 'vitest';
import {
	availabilityFromFreeCells,
	commonFreeCells,
	freeCellsFromAvailability,
	paintCellKey,
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
		expect(
			commonFreeCells([
				{ availability: availabilityFromFreeCells(new Set([shared, paintCellKey('Mon', '09:00')])) },
				{ availability: availabilityFromFreeCells(new Set([shared])) }
			])
		).toEqual(new Set([shared]));
	});
});

describe('slugFromBoardTitle', () => {
	it('builds a url-safe slug', () => {
		expect(slugFromBoardTitle('Data Structures study group')).toBe('data-structures-study-group');
	});
});
