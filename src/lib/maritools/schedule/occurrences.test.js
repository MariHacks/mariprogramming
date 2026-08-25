import { describe, expect, it } from 'vitest';
import { ACADEMIC_TERMS, rulesForTerm } from '../term/calendar.js';
import { CANONICAL_OMNIVOX_SCHEDULE } from './fixture.js';
import { generateOccurrences } from './occurrences.js';
import { parseOmnivox } from './parseOmnivox.js';

const fallTerm = ACADEMIC_TERMS.find((term) => term.id === 'fall-2026');
const fallRules = rulesForTerm('fall-2026');
if (!fallTerm || !fallRules) throw new Error('Fall 2026 calendar is missing');
const fall = fallTerm;
const rules = fallRules;
const courses = parseOmnivox(CANONICAL_OMNIVOX_SCHEDULE).courses;

/** @param {string} date */
function onDate(date) {
	return generateOccurrences(fall, rules, courses).filter((item) => item.date === date);
}

describe('generateOccurrences', () => {
	it('skips Labour Day 2026-09-07', () => {
		expect(onDate('2026-09-07')).toEqual([]);
	});

	it('runs the Monday timetable on Tuesday 2026-09-08', () => {
		const items = onDate('2026-09-08');
		expect(items.map((item) => item.courseCode).sort()).toEqual(['201-SN4-RE', 'PHE-103-A1']);
		expect(items.some((item) => item.courseCode === '420-SNT-MS')).toBe(false);
	});

	it('still holds Monday class on teacher-student day 2026-10-05', () => {
		const items = onDate('2026-10-05');
		expect(items.map((item) => item.courseCode).sort()).toEqual(['201-SN4-RE', 'PHE-103-A1']);
	});

	it('skips Thanksgiving 2026-10-12', () => {
		expect(onDate('2026-10-12')).toEqual([]);
	});

	it('skips exam simulation 2026-11-09', () => {
		expect(onDate('2026-11-09')).toEqual([]);
	});

	it('uses Monday meetings on 2026-10-09 and 2026-10-14', () => {
		expect(onDate('2026-10-09').map((item) => item.courseCode).sort()).toEqual([
			'201-SN4-RE',
			'PHE-103-A1'
		]);
		expect(onDate('2026-10-14').map((item) => item.courseCode).sort()).toEqual([
			'201-SN4-RE',
			'PHE-103-A1'
		]);
	});

	it('includes the last class day and nothing in common-exam week', () => {
		expect(onDate('2026-12-04').length).toBeGreaterThan(0);
		expect(onDate('2026-12-08')).toEqual([]);
	});

	it('starts on classStartDate Tuesday with Tuesday meetings', () => {
		expect(onDate('2026-08-18').map((item) => item.courseCode).sort()).toEqual([
			'203-SN3-RE',
			'420-SNT-MS',
			'603-103-MQ'
		]);
	});
});
