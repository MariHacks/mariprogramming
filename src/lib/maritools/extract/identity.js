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
 * Continuous / announced / final-period rows often have no calendar day in outlines.
 * @param {string} title
 */
export function assessmentExpectsCalendarDate(title) {
	const t = String(title ?? '').trim();
	if (!t) return false;
	if (/^(weekly\s+)?labs?$/i.test(t)) return false;
	if (/^quizzes?$/i.test(t)) return false;
	if (/second test|final exam|common evaluation/i.test(t)) return false;
	return /test|quiz|exam|project|midterm|assignment|paper|essay|presentation/i.test(t);
}

/**
 * True when named assessments that expect a calendar date are missing one.
 * @param {unknown} proposals
 * @returns {boolean}
 */
export function proposalsNeedAssessmentDates(proposals) {
	if (!proposals || typeof proposals !== 'object' || Array.isArray(proposals)) return false;
	const assessments = /** @type {Record<string, unknown>} */ (proposals).assessments;
	if (!Array.isArray(assessments) || assessments.length === 0) return false;
	return assessments.some((row) => {
		if (!row || typeof row !== 'object') return false;
		const title = typeof row.title === 'string' ? row.title.trim() : '';
		const date = typeof row.date === 'string' ? row.date.trim() : '';
		return Boolean(title) && assessmentExpectsCalendarDate(title) && !date;
	});
}

/**
 * True for legacy cached rows that cannot represent exact due text and option weights.
 * @param {unknown} proposals
 * @returns {boolean}
 */
export function proposalsNeedAssessmentFacts(proposals) {
	if (!proposals || typeof proposals !== 'object' || Array.isArray(proposals)) return false;
	const assessments = /** @type {Record<string, unknown>} */ (proposals).assessments;
	if (!Array.isArray(assessments) || assessments.length === 0) return true;
	return assessments.some((row) => {
		if (!row || typeof row !== 'object') return false;
		const item = /** @type {Record<string, unknown>} */ (row);
		return !Object.hasOwn(item, 'dateIso') || !Object.hasOwn(item, 'weightLabel');
	});
}

/**
 * Best-effort course identity from outline text when the model omits it.
 * @param {string} text
 * @returns {{ courseCode: string | null, title: string | null, section: string | null, teacherName: string | null }}
 */
export function guessOutlineIdentity(text) {
	const raw = String(text ?? '');
	const courseCode = raw.match(/\b(\d{3}-[A-Z]{2,4}-[A-Z0-9]{2,3})\b/)?.[1] ?? null;
	const section = raw.match(/\b(?:section|sec\.?)\s*[:#]?\s*([0-9]{3,5})\b/i)?.[1] ?? null;
	const inlineTeacher = raw.match(
		/\b(?:teacher|instructor|professor)\s*[:-]\s*([A-Za-z][A-Za-z .'-]{2,60})/i
	);
	const teacherName = inlineTeacher ? inlineTeacher[1].trim() : null;
	const titledAfterCode = strongTitleAfterCode(raw, courseCode);
	const titleLine = raw
		.split(/\n/)
		.map((line) => line.trim())
		.find(
			(line) =>
				line.length > 8 &&
				line.length < 90 &&
				!/\d{3}-[A-Z]/.test(line) &&
				!/COURSE CODE|REQUIRED TEXT|MINISTRY|TERM:|PONDERATION|INSTRUCTOR/i.test(line) &&
				/[A-Za-z]/.test(line)
		);
	return {
		courseCode,
		title: titledAfterCode || titleLine || null,
		section,
		teacherName: teacherName ? teacherName.replace(/,.*$/, '').trim() : null
	};
}

/** @param {string} raw @param {string | null} courseCode */
function strongTitleAfterCode(raw, courseCode) {
	if (!courseCode) return null;
	return (
		raw
			.match(
				new RegExp(
					`${courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+(?:Fall|Winter|Summer))?` +
						`(?:\\s+\\d{4})?(?:\\s+\\d+)?\\s+([A-Za-z][A-Za-z0-9 ,&\\-]{5,80}?)\\s+COURSE`,
					'i'
				)
			)?.[1]
			?.trim() ?? null
	);
}

/**
 * Fill blank identity fields and normalize model values against the outline text.
 * @param {Record<string, unknown> | null | undefined} proposals
 * @param {string} text
 */
export function withGuessedIdentity(proposals, text) {
	const row =
		proposals && typeof proposals === 'object' && !Array.isArray(proposals) ? { ...proposals } : {};
	const guessed = guessOutlineIdentity(text);
	const strongTitle = strongTitleAfterCode(String(text ?? ''), guessed.courseCode);
	/** @param {unknown} v */
	const blank = (v) => !(typeof v === 'string' && v.trim());
	const courseCode = blank(row.courseCode) ? guessed.courseCode : row.courseCode;
	const title = strongTitle || (blank(row.title) ? guessed.title : row.title);
	let teacherName = blank(row.teacherName) ? guessed.teacherName : row.teacherName;
	if (
		guessed.teacherName &&
		typeof teacherName === 'string' &&
		teacherName.toLowerCase().startsWith(guessed.teacherName.toLowerCase())
	) {
		teacherName = guessed.teacherName;
	}
	let section = blank(row.section) ? guessed.section : row.section;
	if (typeof section === 'string' && /^\d$/.test(section.trim())) {
		section = section.trim().padStart(2, '0');
	}
	// Marianopolis Science outlines often omit section; default single-section "01"
	// so share identity can complete from live extract (not Playwright fill).
	if (!guessed.section && courseCode && title && teacherName && (blank(section) || strongTitle)) {
		section = '01';
	}
	return {
		...row,
		courseCode,
		title,
		section,
		teacherName
	};
}

/** @type {Readonly<Record<string, number>>} */
const MONTHS = Object.freeze({
	january: 1,
	february: 2,
	march: 3,
	april: 4,
	may: 5,
	june: 6,
	july: 7,
	august: 8,
	september: 9,
	october: 10,
	november: 11,
	december: 12
});

/**
 * Parse "Friday, October 2" style due cells into YYYY-MM-DD using year from outline.
 * @param {string} text
 * @param {string} dueCell
 */
function dueCellToIso(text, dueCell) {
	const m = String(dueCell).match(
		/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i
	);
	if (!m) return null;
	const month = MONTHS[m[1].toLowerCase()];
	const day = Number(m[2]);
	if (!month || !day) return null;
	const yearHint =
		Number(text.match(/\b(?:Fall|Winter|Summer)\s+(20\d{2})\b/i)?.[2]) ||
		Number(text.match(/\b(20\d{2})\b/)?.[1]) ||
		new Date().getFullYear();
	return `${yearHint}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Preserve evaluation-table due text and both grading options on assessment rows.
 * @param {Record<string, unknown> | null | undefined} proposals
 * @param {string} text
 */
export function withGuessedAssessmentDates(proposals, text) {
	const row =
		proposals && typeof proposals === 'object' && !Array.isArray(proposals) ? { ...proposals } : {};
	const assessments = Array.isArray(row.assessments) ? [...row.assessments] : [];

	/** @type {Array<{ due: string, type: string, iso: string | null, weightA: number, weightB: number }>} */
	const tableRows = [];
	for (const line of String(text ?? '').split(/\n/)) {
		const trimmed = line.trim();
		if (!trimmed || /Due Date|Option A|^EVALUATION$|Type\s+Platform/i.test(trimmed)) continue;
		const dueMatch = trimmed.match(
			/^((?:Weekly|As announced|In common evaluation period|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}))\s{2,}(.+)$/i
		);
		if (!dueMatch) continue;
		const weights = dueMatch[2].match(/(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/);
		if (!weights) continue;
		const columns = dueMatch[2]
			.slice(0, weights.index)
			.trim()
			.split(/\s{2,}/);
		const type = String(columns[0]).trim();
		if (!type) continue;
		const due = dueMatch[1].trim();
		tableRows.push({
			due,
			type,
			iso: dueCellToIso(text, due),
			weightA: Number(weights[1]),
			weightB: Number(weights[2])
		});
	}
	if (tableRows.length === 0) {
		const flatRow =
			/(Weekly|As announced|In common evaluation period|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})\s+(.+?)\s+(?:Lea|In class)?\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/gi;
		let match;
		while ((match = flatRow.exec(String(text ?? '')))) {
			const due = match[1].trim();
			const type = match[2].trim();
			if (!type) continue;
			tableRows.push({
				due,
				type,
				iso: dueCellToIso(text, due),
				weightA: Number(match[3]),
				weightB: Number(match[4])
			});
		}
	}
	if (assessments.length === 0 && tableRows.length > 0) {
		return {
			...row,
			assessments: tableRows.map((item) => ({
				title:
					item.due.toLowerCase() === 'weekly' && /^labs?$/i.test(item.type)
						? `Weekly ${item.type}`
						: item.type,
				date: item.due,
				dateIso: item.iso,
				weight: item.weightA === item.weightB ? item.weightA : null,
				weightLabel:
					item.weightA === item.weightB ? `${item.weightA}%` : `${item.weightA}% / ${item.weightB}%`
			}))
		};
	}

	const next = assessments.map((item) => {
		if (!item || typeof item !== 'object') return item;
		const current = /** @type {Record<string, unknown>} */ ({ ...item });
		const title = typeof current.title === 'string' ? current.title.trim() : '';
		if (!title) return current;
		const hit = tableRows.find((tr) => {
			const type = tr.type.toLowerCase().replace(/\*$/, '').trim();
			const t = title.toLowerCase();
			return type === t || type.includes(t) || t.includes(type);
		});
		if (!hit) return current;
		if (hit.due.toLowerCase() === 'weekly' && /^labs?\*?$/i.test(hit.type)) {
			current.title = `Weekly ${hit.type}`;
		}
		current.date = hit.due;
		current.dateIso = hit.iso;
		current.weight = hit.weightA === hit.weightB ? hit.weightA : null;
		current.weightLabel =
			hit.weightA === hit.weightB ? `${hit.weightA}%` : `${hit.weightA}% / ${hit.weightB}%`;
		return current;
	});

	return { ...row, assessments: next };
}
