import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
import { freeCellsFromCourses } from '$lib/maritools/schedule/freeTimeBoard.js';
import { isCompleteStudentId, isStaffAccount } from './community.js';
import { readRuntimeEnvironment } from '../config/environment.js';
import {
	MariToolsConflictError,
	MariToolsNotFoundError,
	MariToolsUnavailableError as RepositoryUnavailableError,
	MariToolsValidationError,
	createMariToolsRepository
} from './repository.js';

export const CLUB_INTERESTS = Object.freeze([
	'algorithms',
	'games',
	'hardware',
	'open-source',
	'web',
	'workshops'
]);

export const MARIANOPOLIS_PROGRAMS = Object.freeze([
	'Arts and Sciences',
	'Arts, Literature and Communication',
	'Liberal Arts',
	'Music',
	'Science, Health Science',
	'Science, Honours Health Science',
	'Science, Pure and Applied Science',
	'Science, Honours Pure and Applied Science',
	'Social Science, Core',
	'Social Science, Commerce',
	'Social Science, Human Behaviour',
	'Social Science, Law, Society and Justice',
	'Double DEC, Music and Science',
	'Double DEC, Music and Social Science'
]);

export const YEAR_LEVELS = Object.freeze(['first', 'second', 'third']);

const EXPERIENCE_LEVELS = new Set(['new', 'learning', 'comfortable', 'advanced']);
const INTERESTS = new Set(CLUB_INTERESTS);
const PROGRAMS = new Set(MARIANOPOLIS_PROGRAMS);
const VALID_YEAR_LEVELS = new Set(YEAR_LEVELS);
const WEEKDAYS = Object.freeze(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

export class ClubInputError extends Error {
	/** @param {string} code */
	constructor(code) {
		super(code);
		this.name = 'ClubInputError';
		this.code = code;
	}
}

export class ClubUnavailableError extends Error {
	constructor() {
		super('Programming Club signup is unavailable');
		this.name = 'ClubUnavailableError';
		this.code = 'CLUB_UNAVAILABLE';
	}
}

/** @param {unknown} value @param {number} maximum */
function text(value, maximum) {
	if (typeof value !== 'string') throw new ClubInputError('invalid-text');
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum) throw new ClubInputError('invalid-text');
	return normalized;
}

/** @param {unknown} value @param {number} maximum */
function optionalText(value, maximum) {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') throw new ClubInputError('invalid-text');
	const normalized = value.trim();
	if (!normalized) return null;
	if (normalized.length > maximum) throw new ClubInputError('invalid-text');
	return normalized;
}

/** @param {unknown} value */
function username(value) {
	const normalized = text(value, 32);
	if (!/^[A-Za-z0-9_]{3,24}$/u.test(normalized)) throw new ClubInputError('invalid-username');
	return normalized;
}

/** @param {unknown} value */
function profileImage(value) {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value !== 'string' || value.length > 750_000) {
		throw new ClubInputError('invalid-profile-image');
	}
	if (!/^data:image\/(?:gif|jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/u.test(value)) {
		throw new ClubInputError('invalid-profile-image');
	}
	return value;
}

/** @param {unknown} value */
function interests(value) {
	if (!Array.isArray(value) || value.length === 0 || value.length > 6) {
		throw new ClubInputError('invalid-interests');
	}
	const normalized = [...new Set(value.map((entry) => String(entry).trim()))].sort();
	if (normalized.length !== value.length || normalized.some((entry) => !INTERESTS.has(entry))) {
		throw new ClubInputError('invalid-interests');
	}
	return normalized;
}

/** @param {unknown} userId */
function userId(userId) {
	return text(userId, 128);
}

/** @param {() => Promise<any>} operation */
async function wrap(operation) {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof ClubInputError || error instanceof ClubUnavailableError) throw error;
		if (error instanceof MariToolsValidationError || error instanceof MariToolsConflictError) {
			throw new ClubInputError(error.code ?? 'invalid');
		}
		if (error instanceof MariToolsNotFoundError || error instanceof RepositoryUnavailableError) {
			throw new ClubUnavailableError();
		}
		throw error;
	}
}

function weeklyCells() {
	const cells = [];
	for (const weekday of WEEKDAYS) {
		for (let minutes = 8 * 60; minutes < 18 * 60; minutes += 30) {
			cells.push({
				weekday,
				time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
				freeCount: 0
			});
		}
	}
	return cells;
}

/** @param {string} weekday @param {string} time */
function key(weekday, time) {
	return `${weekday}-${time}`;
}

/** @param {{ joinProgrammingClub: Function, updateMemberProfile: Function, getProgrammingClubMembership: Function, completeProgrammingClubOnboarding: Function, shareSavedScheduleWithClub: Function, stopSharingScheduleWithClub: Function, listStaffClubMembers: Function, getStaffClubMember: Function, listSharedClubSchedules: Function }} inner */
export function createClubStore(inner) {
	return Object.freeze({
		/** @param {{ userId: string, email: string, studentId: string, username: string, firstName: string, lastName: string, profileImageDataUrl?: string | null, program: string, yearLevel: string, experienceLevel: string, interests: string[], clubGoals?: string }} input */
		async joinProgrammingClub(input) {
			const id = userId(input.userId);
			if (!isCompleteStudentId(input.studentId)) throw new ClubInputError('invalid-student-id');
			const level = text(input.experienceLevel, 16);
			if (!EXPERIENCE_LEVELS.has(level)) throw new ClubInputError('invalid-experience');
			const program = text(input.program, 160);
			if (!PROGRAMS.has(program)) throw new ClubInputError('invalid-program');
			const yearLevel = text(input.yearLevel, 8);
			if (!VALID_YEAR_LEVELS.has(yearLevel)) throw new ClubInputError('invalid-year-level');
			return wrap(() =>
				inner.joinProgrammingClub({
					userId: id,
					email: text(input.email, 320),
					studentId: String(input.studentId).trim(),
					username: username(input.username),
					firstName: text(input.firstName, 80),
					lastName: text(input.lastName, 80),
					profileImageDataUrl: profileImage(input.profileImageDataUrl),
					program,
					yearLevel,
					experienceLevel: level,
					interests: interests(input.interests),
					clubGoals: optionalText(input.clubGoals, 1000),
					staffVisibilityAccepted: true,
					role: isStaffAccount(input.email) ? 'staff' : 'student'
				})
			);
		},

		/** @param {{ userId: string, username: string, firstName: string, lastName: string, profileImageDataUrl?: string }} input */
		async updateMemberProfile(input) {
			const values = {
				userId: userId(input.userId),
				username: username(input.username),
				firstName: text(input.firstName, 80),
				lastName: text(input.lastName, 80),
				...(Object.prototype.hasOwnProperty.call(input, 'profileImageDataUrl')
					? { profileImageDataUrl: profileImage(input.profileImageDataUrl) }
					: {})
			};
			return wrap(() => inner.updateMemberProfile(values));
		},

		/** @param {string} id */
		getMyClubOnboarding(id) {
			return wrap(() => inner.getProgrammingClubMembership(userId(id)));
		},

		/** @param {string} id */
		completeRequiredForm(id) {
			return wrap(() => inner.completeProgrammingClubOnboarding(userId(id)));
		},

		/** @param {string} id */
		shareSavedScheduleWithClub(id) {
			return wrap(() => inner.shareSavedScheduleWithClub(userId(id)));
		},

		/** @param {string} id */
		stopSharingScheduleWithClub(id) {
			return wrap(() => inner.stopSharingScheduleWithClub(userId(id)));
		},

		/** @param {{ query?: string, page?: string | number }} filter */
		listStaffClubMembers(filter = {}) {
			return wrap(() => inner.listStaffClubMembers(filter));
		},

		/** @param {string} id */
		getStaffClubMember(id) {
			return wrap(async () => {
				const member = await inner.getStaffClubMember(userId(id));
				if (!member) return null;
				const parsed = member.schedulePaste ? parseOmnivox(member.schedulePaste) : null;
				const safe = { ...member };
				delete safe.schedulePaste;
				return {
					...safe,
					courses: parsed?.ok ? parsed.courses : [],
					scheduleInvalid: Boolean(member.schedulePaste && !parsed?.ok)
				};
			});
		},

		async getStaffMeetingAvailability() {
			return wrap(async () => {
				const rows = await inner.listSharedClubSchedules();
				const cells = weeklyCells();
				const counts = new Map(cells.map((cell) => [key(cell.weekday, cell.time), 0]));
				let denominator = 0;
				let invalidScheduleCount = 0;
				for (const row of rows) {
					const parsed = typeof row.paste === 'string' ? parseOmnivox(row.paste) : null;
					if (!parsed?.ok) {
						invalidScheduleCount += 1;
						continue;
					}
					denominator += 1;
					for (const free of freeCellsFromCourses(parsed.courses)) {
						if (counts.has(free)) counts.set(free, (counts.get(free) ?? 0) + 1);
					}
				}
				return {
					denominator,
					invalidScheduleCount,
					cells: cells.map((cell) => ({
						...cell,
						freeCount: counts.get(key(cell.weekday, cell.time)) ?? 0
					}))
				};
			});
		}
	});
}

export function openClubStore() {
	try {
		return createClubStore(
			createMariToolsRepository({ databaseUrl: readRuntimeEnvironment().databaseUrl })
		);
	} catch (error) {
		if (error instanceof ClubUnavailableError) throw error;
		throw new ClubUnavailableError();
	}
}
