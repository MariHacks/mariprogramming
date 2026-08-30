/**
 * @param {unknown} proposals
 * @returns {boolean}
 */
export function proposalsNeedIdentity(proposals) {
	if (!proposals || typeof proposals !== 'object' || Array.isArray(proposals)) return true;
	const row = /** @type {Record<string, unknown>} */ (proposals);
	const courseCode = typeof row.courseCode === 'string' ? row.courseCode.trim() : '';
	const title = typeof row.title === 'string' ? row.title.trim() : '';
	return !courseCode && !title;
}

/**
 * Best-effort course identity from outline text when the model omits it.
 * @param {string} text
 * @returns {{ courseCode: string | null, title: string | null, section: string | null, teacherName: string | null }}
 */
export function guessOutlineIdentity(text) {
	const raw = String(text ?? '');
	const courseCode = raw.match(/\b(\d{3}-[A-Z]{2,4}-[A-Z0-9]{2,3})\b/)?.[1] ?? null;
	const section =
		raw.match(/\b(?:section|sec\.?)\s*[:#]?\s*([0-9]{3,5})\b/i)?.[1] ?? null;
	const teacherName =
		raw.match(
			/\b(?:teacher|instructor|professor)\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,60})/i
		)?.[1]?.trim() ?? null;
	const titledAfterCode = courseCode
		? raw.match(
				new RegExp(
					`${courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+(?:Fall|Winter|Summer))?` +
						`(?:\\s+\\d{4})?(?:\\s+\\d+)?\\s+([A-Za-z][A-Za-z0-9 ,&\\-]{5,80}?)\\s+COURSE`,
					'i'
				)
			)?.[1]?.trim()
		: null;
	const titleLine = raw
		.split(/\n/)
		.map((line) => line.trim())
		.find(
			(line) =>
				line.length > 8 &&
				line.length < 90 &&
				!/\d{3}-[A-Z]/.test(line) &&
				!/COURSE CODE|REQUIRED TEXT|MINISTRY/i.test(line) &&
				/[A-Za-z]/.test(line)
		);
	return {
		courseCode,
		title: titledAfterCode || titleLine || null,
		section,
		teacherName
	};
}

/**
 * @param {Record<string, unknown> | null | undefined} proposals
 * @param {string} text
 */
export function withGuessedIdentity(proposals, text) {
	const base =
		proposals && typeof proposals === 'object' && !Array.isArray(proposals)
			? { ...proposals }
			: {};
	if (!proposalsNeedIdentity(base)) return base;
	const guessed = guessOutlineIdentity(text);
	return {
		...base,
		courseCode: guessed.courseCode,
		title: guessed.title,
		section: guessed.section ?? (typeof base.section === 'string' ? base.section : null),
		teacherName: guessed.teacherName ?? (typeof base.teacherName === 'string' ? base.teacherName : null)
	};
}
