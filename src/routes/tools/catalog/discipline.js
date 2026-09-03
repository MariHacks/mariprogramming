const DISCIPLINES = {
	101: 'Biology',
	201: 'Mathematics',
	202: 'Chemistry',
	203: 'Physics',
	320: 'History',
	330: 'Philosophy',
	345: 'Psychology',
	383: 'Economics',
	420: 'Computer Science',
	502: 'Physical Education',
	601: 'French',
	602: 'French',
	603: 'English'
};

/** @param {string | null | undefined} courseCode */
export function disciplineFromCourseCode(courseCode) {
	const prefix = String(courseCode ?? '').match(/^(\d{3})/u)?.[1];
	if (!prefix) return 'General';
	return DISCIPLINES[Number(prefix)] ?? 'General';
}
