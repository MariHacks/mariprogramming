/** @typedef {'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'} Weekday */

/**
 * @typedef {object} AcademicTerm
 * @property {string} id
 * @property {string} name
 * @property {string} startDate
 * @property {string} endDate
 * @property {string} classStartDate
 * @property {string} classEndDate
 * @property {'active' | 'historical'} status
 */

/**
 * @typedef {object} ScheduleOverride
 * @property {string} date
 * @property {Weekday} followsWeekday
 */

/**
 * @typedef {object} AcademicCalendarRules
 * @property {string} termId
 * @property {string[]} noClassDates
 * @property {ScheduleOverride[]} scheduleOverrides
 */

/** @type {AcademicTerm[]} */
export const ACADEMIC_TERMS = [
	{
		id: 'fall-2026',
		name: 'Fall 2026',
		startDate: '2026-08-18',
		endDate: '2026-12-22',
		classStartDate: '2026-08-18',
		classEndDate: '2026-12-04',
		status: 'active'
	},
	{
		id: 'winter-2027',
		name: 'Winter 2027',
		startDate: '2027-01-18',
		endDate: '2027-05-31',
		classStartDate: '2027-01-18',
		classEndDate: '2027-05-14',
		status: 'active'
	}
];

/** @type {Record<string, AcademicCalendarRules>} */
export const ACADEMIC_CALENDAR_RULES = {
	'fall-2026': {
		termId: 'fall-2026',
		noClassDates: ['2026-09-07', '2026-10-12', '2026-11-09'],
		scheduleOverrides: [
			{ date: '2026-09-08', followsWeekday: 'Mon' },
			{ date: '2026-10-09', followsWeekday: 'Mon' },
			{ date: '2026-10-14', followsWeekday: 'Mon' },
			{ date: '2026-11-12', followsWeekday: 'Mon' }
		]
	},
	'winter-2027': {
		termId: 'winter-2027',
		noClassDates: [
			'2027-03-01',
			'2027-03-02',
			'2027-03-03',
			'2027-03-04',
			'2027-03-05',
			'2027-03-26',
			'2027-03-29',
			'2027-04-12'
		],
		scheduleOverrides: [
			{ date: '2027-03-23', followsWeekday: 'Fri' },
			{ date: '2027-04-14', followsWeekday: 'Mon' },
			{ date: '2027-05-13', followsWeekday: 'Wed' }
		]
	}
};

/**
 * @typedef {object} TermResolution
 * @property {AcademicTerm | null} selected
 * @property {'contains-today' | 'none' | 'explicit'} reason
 */

/**
 * @param {Date} [now]
 * @returns {string}
 */
export function calendarDate(now = new Date()) {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * @param {string} today YYYY-MM-DD
 * @param {AcademicTerm[]} [terms]
 * @param {string | null} [explicitId]
 * @returns {TermResolution}
 */
export function resolveCurrentTerm(today, terms = ACADEMIC_TERMS, explicitId = null) {
	if (explicitId) {
		const selected = terms.find((term) => term.id === explicitId) ?? null;
		return { selected, reason: selected ? 'explicit' : 'none' };
	}

	const selected =
		terms.find((term) => term.startDate <= today && today <= term.endDate) ?? null;
	return { selected, reason: selected ? 'contains-today' : 'none' };
}

/**
 * @param {string} termId
 * @param {Record<string, AcademicCalendarRules>} [rulesByTerm]
 * @returns {AcademicCalendarRules | null}
 */
export function rulesForTerm(termId, rulesByTerm = ACADEMIC_CALENDAR_RULES) {
	return rulesByTerm[termId] ?? null;
}
