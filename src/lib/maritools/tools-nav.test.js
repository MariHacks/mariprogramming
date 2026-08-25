import { describe, expect, it } from 'vitest';
import { TOOL_SECTIONS } from './tools-nav.js';

describe('TOOL_SECTIONS', () => {
	it('names the three suite sections and omits a book marketplace', () => {
		expect(TOOL_SECTIONS.map((section) => section.title)).toEqual([
			'Schedule',
			'Courses',
			'Student life'
		]);
		const labels = TOOL_SECTIONS.flatMap((section) => section.items.map((item) => item.label));
		expect(labels).toEqual([
			'My schedule',
			'Common free time',
			'Semester',
			'Course catalog',
			'Clubs',
			'Forum'
		]);
		expect(labels.join(' ')).not.toMatch(/marketplace/i);
	});
});
