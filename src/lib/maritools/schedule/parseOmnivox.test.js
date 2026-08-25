import { describe, expect, it } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from './fixture.js';
import { parseOmnivox } from './parseOmnivox.js';

describe('parseOmnivox', () => {
	it('reads the canonical compact list as 7 courses and 14 meetings', () => {
		const result = parseOmnivox(CANONICAL_OMNIVOX_SCHEDULE);
		expect(result.ok).toBe(true);
		expect(result.courses).toHaveLength(7);
		expect(result.courses.reduce((count, course) => count + course.meetings.length, 0)).toBe(14);
		expect(result.courses[0]).toMatchObject({
			title: 'Badminton and Conditioning',
			courseCode: 'PHE-103-A1',
			section: '00002',
			teacher: 'Alexandre Vachon-Gee'
		});
		expect(result.courses[0].meetings[0]).toEqual({
			weekday: 'Mon',
			startTime: '08:15',
			endTime: '10:05',
			classroom: 'GYM'
		});
		expect(result.courses[1].title).toBe('Algèbre linéaire et géométrie vectorielle');
		expect(result.courses[3].title).toContain("Shakespeare's");
		expect(result.courses[5].teacher).toBe('Rémi Poitras');
	});

	it('tolerates CRLF, extra blanks, and trailing spaces', () => {
		const messy = `${CANONICAL_OMNIVOX_SCHEDULE.replaceAll('\n', '\r\n')}   \r\n\r\n`;
		const result = parseOmnivox(messy);
		expect(result.ok).toBe(true);
		expect(result.courses).toHaveLength(7);
	});

	it('warns on a student-number header and does not keep it as a course', () => {
		const paste = `Zhi Cheng Ma - 2530622\nStudent number 2530622\n${CANONICAL_OMNIVOX_SCHEDULE}`;
		const result = parseOmnivox(paste);
		expect(result.ok).toBe(true);
		expect(result.warnings.length).toBeGreaterThan(0);
		expect(result.courses.map((course) => course.title).join(' ')).not.toContain('2530622');
		expect(result.courses).toHaveLength(7);
	});

	it('returns not ok for empty or garbage input', () => {
		expect(parseOmnivox('').ok).toBe(false);
		expect(parseOmnivox('hello world').ok).toBe(false);
		expect(parseOmnivox(null).ok).toBe(false);
	});

	it('warns on a lone student number without inventing courses', () => {
		const result = parseOmnivox('2530622');
		expect(result.ok).toBe(false);
		expect(result.courses).toHaveLength(0);
		expect(result.warnings[0]).toMatch(/student number/i);
	});

	it('drops a numbered title that never gets meetings', () => {
		const result = parseOmnivox('1  Incomplete course\n\n');
		expect(result.ok).toBe(false);
		expect(result.courses).toHaveLength(0);
	});

	it('accepts lowercase weekday tokens', () => {
		const result = parseOmnivox(
			'1  Lab\n101-AA1-MQ sec.00001, teacher: A\nmon 08:15 - 10:05, classroom GYM\n'
		);
		expect(result.ok).toBe(true);
		expect(result.courses[0].meetings[0].weekday).toBe('Mon');
	});
});
