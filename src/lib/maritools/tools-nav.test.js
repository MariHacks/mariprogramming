import { describe, expect, it } from 'vitest';
import { TOOL_SECTIONS } from './tools-nav.js';

describe('TOOL_SECTIONS', () => {
	it('names the three suite sections and omits a book marketplace', () => {
		expect(TOOL_SECTIONS.map((section) => section.title)).toEqual([
			'Schedule',
			'Courses',
			'Student Life'
		]);
		const labels = TOOL_SECTIONS.flatMap((section) => section.items.map((item) => item.label));
		expect(labels).toEqual([
			'My Schedule',
			'Common Free Time',
			'Semester',
			'Course Catalog',
			'Clubs',
			'Forum'
		]);
		expect(labels.join(' ')).not.toMatch(/marketplace/i);
	});
});
