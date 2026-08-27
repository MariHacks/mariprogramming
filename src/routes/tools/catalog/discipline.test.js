import { describe, expect, it } from 'vitest';
import { disciplineFromCourseCode } from './discipline.js';

describe('disciplineFromCourseCode', () => {
	it('maps Marianopolis prefixes used in the catalog preview', () => {
		expect(disciplineFromCourseCode('420-202-MA')).toBe('Computer Science');
		expect(disciplineFromCourseCode('201-NYA-05')).toBe('Mathematics');
		expect(disciplineFromCourseCode('203-NYA-05')).toBe('Physics');
		expect(disciplineFromCourseCode('603-101-MQ')).toBe('English');
	});

	it('falls back to General for unknown or empty codes', () => {
		expect(disciplineFromCourseCode('999-000-XX')).toBe('General');
		expect(disciplineFromCourseCode('')).toBe('General');
		expect(disciplineFromCourseCode(null)).toBe('General');
	});
});
