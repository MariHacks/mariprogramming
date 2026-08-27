import { describe, expect, it } from 'vitest';
import { isToolNavCurrent, TOOL_NAV_ITEMS, TOOL_SECTIONS } from './tools-nav.js';

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
		expect(TOOL_SECTIONS.map((section) => section.blurb)).toEqual([
			'Plan and compare the week.',
			'Course outlines and shared facts.',
			'Find clubs and answers.'
		]);
		expect(TOOL_SECTIONS.flatMap((section) => section.items.map((item) => item.summary))).toEqual([
			'Paste your Omnivox list into a weekly calendar.',
			'Make a board and see when people overlap without an account.',
			'Upload an outline and check the dates.',
			'Browse assessments and books students have shared.',
			"Read a club's focus, meeting time, and how to reach it.",
			'Read threads or post with a course tag.'
		]);
	});
});

describe('TOOL_NAV_ITEMS', () => {
	it('names the six tools for the tools sidebar without Account', () => {
		expect(TOOL_NAV_ITEMS).toEqual([
			{ href: '/tools/schedule', label: 'Schedule' },
			{ href: '/tools/free-time', label: 'Free time' },
			{ href: '/tools/semester', label: 'Semester' },
			{ href: '/tools/catalog', label: 'Catalog' },
			{ href: '/tools/clubs', label: 'Clubs' },
			{ href: '/tools/forum', label: 'Forum' }
		]);
		expect(TOOL_NAV_ITEMS.map((item) => item.href)).toEqual(
			TOOL_SECTIONS.flatMap((section) => section.items.map((item) => item.href))
		);
	});
});

describe('isToolNavCurrent', () => {
	it('treats nested tool routes as the parent destination', () => {
		expect(isToolNavCurrent('/tools/forum', '/tools/forum')).toBe(true);
		expect(isToolNavCurrent('/tools/forum/abc', '/tools/forum')).toBe(true);
		expect(isToolNavCurrent('/tools/schedule', '/tools/forum')).toBe(false);
		expect(isToolNavCurrent('/tools/forums', '/tools/forum')).toBe(false);
	});
});
