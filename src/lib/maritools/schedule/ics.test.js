import { describe, expect, it } from 'vitest';
import { ACADEMIC_TERMS, rulesForTerm } from '../term/calendar.js';
import { CANONICAL_OMNIVOX_SCHEDULE } from './fixture.js';
import { occurrencesToIcs } from './ics.js';
import { generateOccurrences } from './occurrences.js';
import { parseOmnivox } from './parseOmnivox.js';

describe('occurrencesToIcs', () => {
	it('stamps Monday-on-Tuesday 2026-09-08 and omits Labour Day', () => {
		const fall = ACADEMIC_TERMS.find((term) => term.id === 'fall-2026');
		const rules = rulesForTerm('fall-2026');
		if (!fall || !rules) throw new Error('Fall 2026 calendar is missing');
		const courses = parseOmnivox(CANONICAL_OMNIVOX_SCHEDULE).courses;
		const ics = occurrencesToIcs(generateOccurrences(fall, rules, courses));

		expect(ics).toContain('BEGIN:VCALENDAR');
		expect(ics).toContain('DTSTART:20260908T081500');
		expect(ics).not.toContain('DTSTART:20260907');
		expect(ics).toContain('LOCATION:GYM');
		expect(ics).toContain('PHE-103-A1 sec.00002');
	});

	it('escapes commas, semicolons, and backslashes', () => {
		const ics = occurrencesToIcs([
			{
				courseCode: 'X',
				title: 'A, B; C\\D',
				section: '1',
				teacher: 'T',
				classroom: 'D-1,B',
				date: '2026-09-08',
				startTime: '08:15',
				endTime: '10:05'
			}
		]);
		expect(ics).toContain('SUMMARY:A\\, B\\; C\\\\D');
		expect(ics).toContain('LOCATION:D-1\\,B');
	});
});
