import { describe, expect, it } from 'vitest';
import {
	availabilityFromFreeCells,
	availabilityWithWeek,
	commonFreeCells,
	freeCellsFromAvailability,
	freeCellsFromCourses,
	paintCellKey,
	paintSlotLabel,
	paintSlotTimes,
	restoreEditorState,
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
	const weekA = '2026-08-24';
	const weekB = '2026-08-31';
	const mon = paintCellKey('Mon', '09:00');
	const tue = paintCellKey('Tue', '10:00');

	it('round-trips legacy v1 through availabilityFromFreeCells for any week', () => {
		const cells = new Set([mon, tue]);
		const serialized = availabilityFromFreeCells(cells);
		expect(serialized).toEqual({ version: 1, free: [...cells].sort() });
		expect(freeCellsFromAvailability(serialized, weekA)).toEqual(cells);
		expect(freeCellsFromAvailability(serialized, weekB)).toEqual(cells);
	});

	it('reads and writes distinct weeks under version 2', () => {
		const withA = availabilityWithWeek(null, weekA, new Set([mon]));
		expect(withA).toEqual({ version: 2, byWeek: { [weekA]: [mon] } });
		const withBoth = availabilityWithWeek(withA, weekB, new Set([tue]));
		expect(freeCellsFromAvailability(withBoth, weekA)).toEqual(new Set([mon]));
		expect(freeCellsFromAvailability(withBoth, weekB)).toEqual(new Set([tue]));
		expect(freeCellsFromAvailability(withBoth, '2026-09-07').size).toBe(0);
	});

	it('drops legacy free once a week is saved under version 2', () => {
		const legacy = availabilityFromFreeCells(new Set([mon, tue]));
		const upgraded = availabilityWithWeek(legacy, weekA, new Set([mon]));
		expect(upgraded.free).toBeUndefined();
		expect(freeCellsFromAvailability(upgraded, weekA)).toEqual(new Set([mon]));
		expect(freeCellsFromAvailability(upgraded, weekB).size).toBe(0);
	});
});

describe('commonFreeCells', () => {
	const weekA = '2026-08-24';
	const weekB = '2026-08-31';
	const shared = paintCellKey('Wed', '12:00');

	it('returns only cells every member marked free for the requested week', () => {
		expect(commonFreeCells([], weekA)).toEqual(new Set());
		expect(
			commonFreeCells(
				[
					{
						availability: availabilityWithWeek(null, weekA, new Set([shared, paintCellKey('Mon', '09:00')]))
					},
					{ availability: availabilityWithWeek(null, weekA, new Set([shared])) }
				],
				weekA
			)
		).toEqual(new Set([shared]));
		expect(
			commonFreeCells(
				[
					{ availability: availabilityWithWeek(null, weekA, new Set([shared])) },
					{ availability: availabilityWithWeek(null, weekB, new Set([shared])) }
				],
				weekA
			).size
		).toBe(0);
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
		expect(freeCellsFromAvailability(null, '2026-08-24').size).toBe(0);
		expect(freeCellsFromAvailability([], '2026-08-24').size).toBe(0);
		expect(freeCellsFromAvailability({}, '2026-08-24').size).toBe(0);
	});
});

describe('slugFromBoardTitle', () => {
	it('builds a url-safe slug', () => {
		expect(slugFromBoardTitle('Data Structures study group')).toBe('data-structures-study-group');
	});
});

describe('restoreEditorState', () => {
	const weekA = '2026-08-24';
	const weekB = '2026-08-31';
	const mon = paintCellKey('Mon', '09:00');
	const tue = paintCellKey('Tue', '11:00');
	const board = {
		id: 'board-1',
		members: [
			{
				id: 'm1',
				displayName: 'Ada',
				shareToken: 'tok-ada',
				availability: availabilityWithWeek(
					availabilityWithWeek(null, weekA, new Set([mon, tue])),
					weekB,
					new Set([mon])
				)
			},
			{
				id: 'm2',
				displayName: 'Blake',
				shareToken: 'tok-blake',
				availability: availabilityWithWeek(null, weekA, new Set([mon]))
			}
		]
	};

	it('restores display name and painted cells for the requested week', () => {
		const restored = restoreEditorState(board, 'tok-ada', null, weekA);
		expect(restored.shareToken).toBe('tok-ada');
		expect(restored.displayName).toBe('Ada');
		expect(restored.freeCells).toEqual(new Set([mon, tue]));
		expect(restoreEditorState(board, 'tok-ada', null, weekB).freeCells).toEqual(new Set([mon]));
	});

	it('prefills the signed-in display name when no share token matches', () => {
		const restored = restoreEditorState(board, '', 'Nick', weekA);
		expect(restored.shareToken).toBe('');
		expect(restored.displayName).toBe('Nick');
		expect(restored.freeCells.size).toBe(0);
	});

	it('keeps a stale token but does not wipe the signed-in name when the member is gone', () => {
		const restored = restoreEditorState({ id: 'board-1', members: [] }, 'tok-gone', 'Nick', weekA);
		expect(restored.shareToken).toBe('tok-gone');
		expect(restored.displayName).toBe('Nick');
		expect(restored.freeCells.size).toBe(0);
	});
});
