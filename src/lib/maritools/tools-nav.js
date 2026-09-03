export const TOOL_SECTIONS = [
	{
		id: 'schedule',
		title: 'Schedule',
		blurb: 'Plan and compare the week.',
		items: [
			{
				href: '/tools/schedule',
				label: 'My schedule',
				summary: 'Paste your Omnivox list into a weekly calendar.'
			},
			{
				href: '/tools/free-time',
				label: 'Common free time',
				summary: 'Make a board and see when people overlap without an account.'
			}
		]
	},
	{
		id: 'courses',
		title: 'Courses',
		blurb: 'Course outlines and shared facts.',
		items: [
			{
				href: '/tools/semester',
				label: 'Semester',
				summary: 'Upload an outline and check the dates.'
			},
			{
				href: '/tools/catalog',
				label: 'Course catalog',
				summary: 'Compare course outlines by code, term, and section.'
			}
		]
	},
	{
		id: 'student-life',
		title: 'Student life',
		blurb: 'Find clubs and answers.',
		items: [
			{
				href: '/tools/clubs',
				label: 'Clubs',
				summary: 'What a club does and how to reach it.'
			},
			{
				href: '/tools/forum',
				label: 'Forum',
				summary: 'Read threads or post with a course tag.'
			}
		]
	}
];

export const TOOL_NAV_ITEMS = [
	{ href: '/tools/schedule', label: 'Schedule' },
	{ href: '/tools/free-time', label: 'Free time' },
	{ href: '/tools/semester', label: 'Semester' },
	{ href: '/tools/catalog', label: 'Catalog' },
	{ href: '/tools/clubs', label: 'Clubs' },
	{ href: '/tools/forum', label: 'Forum' }
];

/**
 * @param {string} pathname
 * @param {string} href
 */
export function isToolNavCurrent(pathname, href) {
	return pathname === href || pathname.startsWith(`${href}/`);
}
