export const TOOL_SECTIONS = [
	{
		id: 'schedule',
		title: 'Schedule',
		items: [
			{
				href: '/tools/schedule',
				label: 'My schedule',
				summary: 'Paste your Omnivox list and download a calendar.'
			},
			{
				href: '/tools/free-time',
				label: 'Common free time',
				summary: 'Compare a few schedules and see when everyone is free.'
			}
		]
	},
	{
		id: 'courses',
		title: 'Courses',
		items: [
			{
				href: '/tools/semester',
				label: 'Semester',
				summary: 'Review dates and weights from a course outline.'
			},
			{
				href: '/tools/catalog',
				label: 'Course catalog',
				summary: 'Browse course information students have shared.'
			}
		]
	},
	{
		id: 'student-life',
		title: 'Student life',
		items: [
			{
				href: '/tools/clubs',
				label: 'Clubs',
				summary: 'Find campus clubs from verified listings.'
			},
			{
				href: '/tools/forum',
				label: 'Forum',
				summary: 'Read and post questions tagged to real courses.'
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
