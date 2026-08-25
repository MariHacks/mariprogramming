/** @typedef {import('./occurrences.js').ClassOccurrence} ClassOccurrence */

/**
 * @param {string} isoDate
 * @param {string} hhmm
 * @returns {string}
 */
function stamp(isoDate, hhmm) {
	return `${isoDate.replaceAll('-', '')}T${hhmm.replace(':', '')}00`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function fold(value) {
	return value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,');
}

/**
 * @param {ClassOccurrence[]} occurrences
 * @param {string} [prodId]
 * @returns {string}
 */
export function occurrencesToIcs(occurrences, prodId = '-//MariTools//Schedule//EN') {
	const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`, 'CALSCALE:GREGORIAN'];

	for (const item of occurrences) {
		const uid = `${item.courseCode}-${item.section}-${item.date}-${item.startTime}@maritools`;
		lines.push(
			'BEGIN:VEVENT',
			`UID:${uid}`,
			`DTSTART:${stamp(item.date, item.startTime)}`,
			`DTEND:${stamp(item.date, item.endTime)}`,
			`SUMMARY:${fold(item.title)}`,
			`LOCATION:${fold(item.classroom)}`,
			`DESCRIPTION:${fold(`${item.courseCode} sec.${item.section}, teacher: ${item.teacher}`)}`,
			'END:VEVENT'
		);
	}

	lines.push('END:VCALENDAR');
	return lines.join('\r\n');
}
