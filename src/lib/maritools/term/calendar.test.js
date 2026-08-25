import { describe, expect, it } from 'vitest';
import {
	ACADEMIC_CALENDAR_RULES,
	ACADEMIC_TERMS,
	calendarDate,
	resolveCurrentTerm,
	rulesForTerm
} from './calendar.js';

describe('calendarDate', () => {
	it('formats the local calendar day', () => {
		expect(calendarDate(new Date(2027, 0, 5, 23, 30))).toBe('2027-01-05');
		expect(calendarDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('resolveCurrentTerm', () => {
	it('selects Fall 2026 when today falls inside it', () => {
		const resolution = resolveCurrentTerm('2026-08-24');
		expect(resolution.reason).toBe('contains-today');
		expect(resolution.selected?.id).toBe('fall-2026');
	});

	it('returns none after Fall ends and before Winter begins', () => {
		const resolution = resolveCurrentTerm('2027-01-05');
		expect(resolution.reason).toBe('none');
		expect(resolution.selected).toBeNull();
	});

	it('returns an explicit historical term without guessing current', () => {
		const resolution = resolveCurrentTerm('2027-01-05', ACADEMIC_TERMS, 'fall-2026');
		expect(resolution.reason).toBe('explicit');
		expect(resolution.selected?.id).toBe('fall-2026');
	});

	it('returns none when the explicit id is unknown', () => {
		const resolution = resolveCurrentTerm('2026-08-24', ACADEMIC_TERMS, 'summer-2099');
		expect(resolution.reason).toBe('none');
		expect(resolution.selected).toBeNull();
	});

	it('selects Winter 2027 during that window', () => {
		const resolution = resolveCurrentTerm('2027-03-10');
		expect(resolution.selected?.id).toBe('winter-2027');
	});
});

describe('rulesForTerm', () => {
	it('returns Fall 2026 locked no-class and Monday overrides', () => {
		const rules = rulesForTerm('fall-2026');
		expect(rules?.noClassDates).toEqual(['2026-09-07', '2026-10-12', '2026-11-09']);
		expect(rules?.scheduleOverrides.map((entry) => entry.date)).toEqual([
			'2026-09-08',
			'2026-10-09',
			'2026-10-14',
			'2026-11-12'
		]);
		expect(ACADEMIC_CALENDAR_RULES['fall-2026'].termId).toBe('fall-2026');
	});

	it('returns null for an unknown term', () => {
		expect(rulesForTerm('spring-1999')).toBeNull();
	});
});
