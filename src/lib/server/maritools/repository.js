import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { ACADEMIC_CALENDAR_RULES, ACADEMIC_TERMS } from '../../maritools/term/calendar.js';
import {
	mtAcademicCalendarRules,
	mtAcademicTerms,
	mtCatalogContributions,
	mtClubSubmissions,
	mtClubs,
	mtCourseOfferings,
	mtCourses,
	mtForumReplies,
	mtForumReports,
	mtForumThreads,
	mtOutlineDocuments,
	mtOutlineExtractions,
	mtStudentProfiles
} from '../db/schema';
import { withDatabaseTransaction } from '../db/transaction.js';
import { isCompleteStudentId } from './community.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const USER_ID_MAX = 128;
const FORUM_CATEGORIES = new Set(['courses', 'student-life']);
const CLUB_SUBMISSION_STATUSES = new Set(['pending', 'published', 'rejected']);
const REPORT_STATUSES = new Set(['open', 'resolved', 'dismissed']);
const REPORT_KINDS = new Set(['thread', 'reply']);
const FALL_2026_TERM_ID = 'fall-2026';

export class MariToolsValidationError extends Error {
	constructor() {
		super('MariTools request is invalid');
		this.name = 'MariToolsValidationError';
		this.code = 'MARITOOLS_INVALID';
	}
}

export class MariToolsConflictError extends Error {
	constructor() {
		super('MariTools record conflicts');
		this.name = 'MariToolsConflictError';
		this.code = 'MARITOOLS_CONFLICT';
	}
}

export class MariToolsNotFoundError extends Error {
	constructor() {
		super('MariTools record was not found');
		this.name = 'MariToolsNotFoundError';
		this.code = 'MARITOOLS_NOT_FOUND';
	}
}

export class MariToolsUnavailableError extends Error {
	constructor() {
		super('MariTools is unavailable');
		this.name = 'MariToolsUnavailableError';
		this.code = 'MARITOOLS_UNAVAILABLE';
	}
}

/** @returns {never} */
function invalid() {
	throw new MariToolsValidationError();
}

/** @returns {never} */
function conflict() {
	throw new MariToolsConflictError();
}

/** @returns {never} */
function notFound() {
	throw new MariToolsNotFoundError();
}

/** @returns {never} */
function unavailable() {
	throw new MariToolsUnavailableError();
}

/**
 * @param {any} transaction
 * @param {string} userId
 */
async function assertPosterAllowed(transaction, userId) {
	const profile = oneRow(
		await transaction.select().from(mtStudentProfiles).where(eq(mtStudentProfiles.userId, userId))
	);
	if (!profile) return;
	if (profile.bannedAt) return conflict();
	if (profile.mutedUntil instanceof Date && profile.mutedUntil.getTime() > Date.now()) {
		return conflict();
	}
}

/** @param {Buffer | Uint8Array | string} input */
export function sha256Hex(input) {
	const buffer = typeof input === 'string' ? Buffer.from(input) : Buffer.from(input);
	return createHash('sha256').update(buffer).digest('hex');
}

/** @param {unknown} error */
export function isUniqueViolation(error) {
	let current = error;
	for (let depth = 0; depth < 5 && current; depth += 1) {
		if (current && typeof current === 'object' && current.code === '23505') return true;
		current = typeof current === 'object' && current !== null ? current.cause : null;
	}
	return false;
}

/** @param {unknown} value */
function canonicalize(value) {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonicalize(/** @type {Record<string, unknown>} */ (value)[key])])
		);
	}
	return value;
}

/** @param {unknown} left @param {unknown} right */
export function structuredFactsConflict(left, right) {
	return JSON.stringify(canonicalize(left)) !== JSON.stringify(canonicalize(right));
}

/**
 * @param {{ structured: unknown } | null} existingSameIdentity
 * @param {unknown} incomingStructured
 * @param {Array<{ status: string }>} otherLiveForOffering
 * @returns {'published' | 'conflict' | 'reuse'}
 */
export function resolveCatalogContributionStatus(
	existingSameIdentity,
	incomingStructured,
	otherLiveForOffering
) {
	if (existingSameIdentity) {
		return structuredFactsConflict(existingSameIdentity.structured, incomingStructured)
			? 'conflict'
			: 'reuse';
	}
	if (otherLiveForOffering.some((row) => row.status === 'published' || row.status === 'conflict')) {
		return 'conflict';
	}
	return 'published';
}

/** @param {any} profile */
export function publicStudentView(profile) {
	if (profile === null || typeof profile !== 'object') return invalid();
	const mutedUntil = profile.mutedUntil ?? null;
	const bannedAt = profile.bannedAt ?? null;
	const mutedActive =
		mutedUntil instanceof Date
			? mutedUntil.getTime() > Date.now()
			: typeof mutedUntil === 'string' && new Date(mutedUntil).getTime() > Date.now();
	return {
		userId: profile.userId,
		displayName: profile.displayName ?? null,
		role: profile.role,
		nimDisclosureAcceptedAt: profile.nimDisclosureAcceptedAt ?? null,
		mutedUntil,
		bannedAt,
		isMuted: Boolean(mutedActive),
		isBanned: Boolean(bannedAt)
	};
}

/** Public profile card: no student number, no staff-only internals beyond restriction flags. */
/** @param {any} profile */
export function publicProfileCard(profile) {
	const view = publicStudentView(profile);
	return {
		userId: view.userId,
		displayName: view.displayName,
		role: view.role === 'staff' || view.role === 'moderator' ? view.role : 'student',
		isRestricted: view.isMuted || view.isBanned
	};
}

/** @param {any} document */
export function publicOutlineView(document) {
	if (document === null || typeof document !== 'object') return invalid();
	return {
		id: document.id,
		userId: document.userId,
		sha256: document.sha256,
		byteLength: document.byteLength
	};
}

/**
 * @param {typeof ACADEMIC_TERMS} [terms]
 * @param {typeof ACADEMIC_CALENDAR_RULES} [rulesByTerm]
 */
export function fall2026TermSeed(terms = ACADEMIC_TERMS, rulesByTerm = ACADEMIC_CALENDAR_RULES) {
	const term = terms.find((entry) => entry.id === FALL_2026_TERM_ID);
	const rules = rulesByTerm[FALL_2026_TERM_ID];
	if (!term || !rules) return unavailable();
	return { term, rules };
}

/**
 * @param {typeof ACADEMIC_TERMS} [terms]
 * @param {typeof ACADEMIC_CALENDAR_RULES} [rulesByTerm]
 */
export function committedTermSeeds(terms = ACADEMIC_TERMS, rulesByTerm = ACADEMIC_CALENDAR_RULES) {
	return terms.map((term) => {
		const rules = rulesByTerm[term.id];
		if (!rules) return unavailable();
		return { term, rules };
	});
}

/** @param {unknown} value @param {number} maximum */
function requiredText(value, maximum) {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > maximum ||
		value !== value.trim()
	) {
		return invalid();
	}
	return value;
}

/** @param {unknown} value @param {number} maximum */
function optionalText(value, maximum) {
	if (value === null || value === undefined) return null;
	return requiredText(value, maximum);
}

/** @param {unknown} value */
function requiredUuid(value) {
	if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return invalid();
	return value;
}

/** @param {unknown} value */
function optionalUuid(value) {
	if (value === null || value === undefined) return null;
	return requiredUuid(value);
}

/** @param {unknown} value */
function requiredUserId(value) {
	return requiredText(value, USER_ID_MAX);
}

/** @param {unknown} value */
function optionalUserId(value) {
	if (value === null || value === undefined) return null;
	return requiredUserId(value);
}

/** @param {unknown} value */
function requiredSha256(value) {
	if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) return invalid();
	return value;
}

/** @param {unknown} value */
function requiredJsonObject(value) {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid();
	return value;
}

/** @param {unknown} value */
function requiredPositiveInt(value) {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return invalid();
	return value;
}

/** @param {unknown} rows */
function asRows(rows) {
	if (!Array.isArray(rows)) return unavailable();
	return rows;
}

/** @param {unknown} rows */
function oneRow(rows) {
	const list = asRows(rows);
	if (list.length > 1) return unavailable();
	return list[0] ?? null;
}

/** @param {any} term */
function termDto(term) {
	if (
		term === null ||
		typeof term !== 'object' ||
		typeof term.id !== 'string' ||
		typeof term.name !== 'string' ||
		typeof term.startDate !== 'string' ||
		typeof term.endDate !== 'string' ||
		typeof term.classStartDate !== 'string' ||
		typeof term.classEndDate !== 'string' ||
		(term.status !== 'active' && term.status !== 'historical')
	) {
		return unavailable();
	}
	return {
		id: term.id,
		name: term.name,
		startDate: term.startDate,
		endDate: term.endDate,
		classStartDate: term.classStartDate,
		classEndDate: term.classEndDate,
		status: term.status
	};
}

/** @param {any} rules */
function rulesDto(rules) {
	if (
		rules === null ||
		typeof rules !== 'object' ||
		typeof rules.termId !== 'string' ||
		!Array.isArray(rules.noClassDates) ||
		!Array.isArray(rules.scheduleOverrides)
	) {
		return unavailable();
	}
	return {
		termId: rules.termId,
		noClassDates: rules.noClassDates,
		scheduleOverrides: rules.scheduleOverrides
	};
}

/** @param {any} seed @param {any} stored */
function termMatchesSeed(seed, stored) {
	return (
		stored.id === seed.id &&
		stored.name === seed.name &&
		stored.startDate === seed.startDate &&
		stored.endDate === seed.endDate &&
		stored.classStartDate === seed.classStartDate &&
		stored.classEndDate === seed.classEndDate &&
		stored.status === seed.status
	);
}

/** @param {any} seed @param {any} stored */
function rulesMatchSeed(seed, stored) {
	return (
		stored.termId === seed.termId &&
		!structuredFactsConflict(stored.noClassDates, seed.noClassDates) &&
		!structuredFactsConflict(stored.scheduleOverrides, seed.scheduleOverrides)
	);
}

/** @template T @param {() => Promise<T>} operation */
function redactUnexpected(operation) {
	return operation().catch((error) => {
		if (
			error instanceof MariToolsValidationError ||
			error instanceof MariToolsConflictError ||
			error instanceof MariToolsNotFoundError ||
			error instanceof MariToolsUnavailableError
		) {
			throw error;
		}
		throw new MariToolsUnavailableError();
	});
}

/**
 * @param {any} transaction
 * @param {any} table
 * @param {any} values
 * @param {() => Promise<any>} recover
 */
async function insertOrRecover(transaction, table, values, recover) {
	try {
		const created = oneRow(await transaction.insert(table).values(values).returning());
		return created ?? unavailable();
	} catch (error) {
		if (!isUniqueViolation(error)) throw error;
		const recovered = await recover();
		return recovered ?? conflict();
	}
}

/**
 * @param {any} transaction
 * @param {{ term: any, rules: any }} seed
 */
async function upsertTermSeed(transaction, seed) {
	const existingTerm = oneRow(
		await transaction.select().from(mtAcademicTerms).where(eq(mtAcademicTerms.id, seed.term.id))
	);
	if (existingTerm) {
		if (!termMatchesSeed(seed.term, termDto(existingTerm))) return conflict();
	} else {
		await insertOrRecover(
			transaction,
			mtAcademicTerms,
			{
				id: seed.term.id,
				name: seed.term.name,
				startDate: seed.term.startDate,
				endDate: seed.term.endDate,
				classStartDate: seed.term.classStartDate,
				classEndDate: seed.term.classEndDate,
				status: seed.term.status
			},
			async () => {
				const raced = oneRow(
					await transaction.select().from(mtAcademicTerms).where(eq(mtAcademicTerms.id, seed.term.id))
				);
				if (!raced || !termMatchesSeed(seed.term, termDto(raced))) return null;
				return raced;
			}
		);
	}

	const existingRules = oneRow(
		await transaction
			.select()
			.from(mtAcademicCalendarRules)
			.where(eq(mtAcademicCalendarRules.termId, seed.rules.termId))
	);
	if (existingRules) {
		if (!rulesMatchSeed(seed.rules, rulesDto(existingRules))) return conflict();
	} else {
		await insertOrRecover(
			transaction,
			mtAcademicCalendarRules,
			{
				termId: seed.rules.termId,
				noClassDates: seed.rules.noClassDates,
				scheduleOverrides: seed.rules.scheduleOverrides
			},
			async () => {
				const raced = oneRow(
					await transaction
						.select()
						.from(mtAcademicCalendarRules)
						.where(eq(mtAcademicCalendarRules.termId, seed.rules.termId))
				);
				if (!raced || !rulesMatchSeed(seed.rules, rulesDto(raced))) return null;
				return raced;
			}
		);
	}

	return { term: seed.term, rules: seed.rules };
}

/**
 * @param {unknown} links
 */
function normalizeClubLinks(links) {
	if (links === undefined) return [];
	if (!Array.isArray(links)) return invalid();
	/** @type {{ label: string, url: string }[]} */
	const normalized = [];
	for (const entry of links) {
		if (!entry || typeof entry !== 'object') return invalid();
		const label = optionalText(/** @type {Record<string, unknown>} */ (entry).label, 80) ?? 'Link';
		const rawUrl = /** @type {Record<string, unknown>} */ (entry).url;
		if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 500) return invalid();
		let parsed;
		try {
			parsed = new URL(rawUrl.trim());
		} catch {
			return invalid();
		}
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return invalid();
		normalized.push({ label, url: parsed.href });
	}
	return normalized;
}

/**
 * @param {{
 *   databaseUrl: string,
 *   runTransaction?: typeof withDatabaseTransaction
 * }} configuration
 */
export function createMariToolsRepository({
	databaseUrl,
	runTransaction = withDatabaseTransaction
}) {
	if (
		typeof databaseUrl !== 'string' ||
		databaseUrl.length === 0 ||
		databaseUrl !== databaseUrl.trim() ||
		typeof runTransaction !== 'function'
	) {
		return unavailable();
	}

	/** @param {(transaction: any) => Promise<any>} operation */
	const transact = (operation) => runTransaction(operation, { databaseUrl });

	return Object.freeze({
		async listTerms() {
			return redactUnexpected(async () =>
				asRows(
					await transact((transaction) =>
						transaction.select().from(mtAcademicTerms).orderBy(asc(mtAcademicTerms.startDate))
					)
				).map(termDto)
			);
		},

		/** @param {unknown} termId */
		async getTerm(termId) {
			const id = requiredText(termId, 64);
			return redactUnexpected(async () => {
				const row = oneRow(
					await transact((transaction) =>
						transaction.select().from(mtAcademicTerms).where(eq(mtAcademicTerms.id, id))
					)
				);
				return row ? termDto(row) : null;
			});
		},

		/** @param {unknown} termId */
		async getCalendarRules(termId) {
			const id = requiredText(termId, 64);
			return redactUnexpected(async () => {
				const row = oneRow(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtAcademicCalendarRules)
							.where(eq(mtAcademicCalendarRules.termId, id))
					)
				);
				return row ? rulesDto(row) : null;
			});
		},

		async seedFall2026() {
			const seed = fall2026TermSeed();
			return redactUnexpected(() =>
				transact(async (transaction) => upsertTermSeed(transaction, seed))
			);
		},

		/** Seeds every committed AcademicTerm + calendar rules once. */
		async seedCommittedTerms() {
			const seeds = committedTermSeeds();
			return redactUnexpected(() =>
				transact(async (transaction) => {
					/** @type {{ term: ReturnType<typeof termDto>, rules: ReturnType<typeof rulesDto> }[]} */
					const results = [];
					for (const seed of seeds) {
						results.push(await upsertTermSeed(transaction, seed));
					}
					return results;
				})
			);
		},

		/**
		 * @param {{
		 *   termId: unknown,
		 *   code: unknown,
		 *   section: unknown,
		 *   teacherName: unknown,
		 *   canonicalTitle: unknown
		 * }} input
		 */
		async findOrCreateOffering(input) {
			const termId = requiredText(input.termId, 64);
			const code = requiredText(input.code, 64);
			const section = requiredText(input.section, 80);
			const teacherName = requiredText(input.teacherName, 160);
			const canonicalTitle = requiredText(input.canonicalTitle, 240);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const term = oneRow(
						await transaction.select().from(mtAcademicTerms).where(eq(mtAcademicTerms.id, termId))
					);
					if (!term) return notFound();

					let course = oneRow(
						await transaction.select().from(mtCourses).where(eq(mtCourses.code, code))
					);
					if (!course) {
						course = await insertOrRecover(
							transaction,
							mtCourses,
							{ code, canonicalTitle },
							async () =>
								oneRow(await transaction.select().from(mtCourses).where(eq(mtCourses.code, code)))
						);
					}

					let offering = oneRow(
						await transaction
							.select()
							.from(mtCourseOfferings)
							.where(
								and(
									eq(mtCourseOfferings.termId, termId),
									eq(mtCourseOfferings.courseId, course.id),
									eq(mtCourseOfferings.section, section),
									eq(mtCourseOfferings.teacherName, teacherName)
								)
							)
					);
					if (!offering) {
						offering = await insertOrRecover(
							transaction,
							mtCourseOfferings,
							{ courseId: course.id, termId, section, teacherName },
							async () =>
								oneRow(
									await transaction
										.select()
										.from(mtCourseOfferings)
										.where(
											and(
												eq(mtCourseOfferings.termId, termId),
												eq(mtCourseOfferings.courseId, course.id),
												eq(mtCourseOfferings.section, section),
												eq(mtCourseOfferings.teacherName, teacherName)
											)
										)
								)
						);
					}
					return { course, offering };
				})
			);
		},

		/**
		 * @param {{
		 *   userId: unknown,
		 *   studentId: unknown,
		 *   displayName?: unknown,
		 *   role?: unknown
		 * }} input
		 */
		async upsertStudentProfile(input) {
			const userId = requiredUserId(input.userId);
			if (typeof input.studentId !== 'string' || !isCompleteStudentId(input.studentId)) {
				return invalid();
			}
			const studentId = input.studentId.trim();
			const displayName = optionalText(input.displayName, 120);
			const roleInput = optionalText(input.role, 16);
			const role =
				roleInput === 'staff' || roleInput === 'student' || roleInput === 'moderator'
					? roleInput
					: 'student';
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction
							.select()
							.from(mtStudentProfiles)
							.where(eq(mtStudentProfiles.userId, userId))
					);
					if (existing) {
						if (existing.studentId !== studentId) return conflict();
						if (displayName === null || displayName === existing.displayName) return existing;
						const updated = oneRow(
							await transaction
								.update(mtStudentProfiles)
								.set({ displayName, updatedAt: new Date() })
								.where(eq(mtStudentProfiles.userId, userId))
								.returning()
						);
						return updated ?? unavailable();
					}

					const taken = oneRow(
						await transaction
							.select()
							.from(mtStudentProfiles)
							.where(eq(mtStudentProfiles.studentId, studentId))
					);
					if (taken) return conflict();

					return insertOrRecover(
						transaction,
						mtStudentProfiles,
						{ userId, studentId, displayName, role },
						async () => {
							const raced = oneRow(
								await transaction
									.select()
									.from(mtStudentProfiles)
									.where(eq(mtStudentProfiles.userId, userId))
							);
							if (raced && raced.studentId === studentId) return raced;
							return null;
						}
					);
				})
			);
		},

		/** @param {unknown} userId */
		async getStudentProfile(userId) {
			const id = requiredUserId(userId);
			return redactUnexpected(async () =>
				oneRow(
					await transact((transaction) =>
						transaction.select().from(mtStudentProfiles).where(eq(mtStudentProfiles.userId, id))
					)
				)
			);
		},

		/**
		 * Mute posting until `until` (Date).
		 * @param {unknown} userId
		 * @param {Date} until
		 */
		async muteUser(userId, until) {
			const id = requiredUserId(userId);
			if (!(until instanceof Date) || Number.isNaN(until.getTime())) return invalid();
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction
							.select()
							.from(mtStudentProfiles)
							.where(eq(mtStudentProfiles.userId, id))
					);
					if (!existing) return notFound();
					const updated = oneRow(
						await transaction
							.update(mtStudentProfiles)
							.set({ mutedUntil: until, updatedAt: new Date() })
							.where(eq(mtStudentProfiles.userId, id))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/** @param {unknown} userId */
		async banUser(userId) {
			const id = requiredUserId(userId);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction
							.select()
							.from(mtStudentProfiles)
							.where(eq(mtStudentProfiles.userId, id))
					);
					if (!existing) return notFound();
					const updated = oneRow(
						await transaction
							.update(mtStudentProfiles)
							.set({ bannedAt: new Date(), updatedAt: new Date() })
							.where(eq(mtStudentProfiles.userId, id))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/** @param {unknown} authorUserId @param {number} [limit] */
		async listThreadsByAuthor(authorUserId, limit = 20) {
			const id = requiredUserId(authorUserId);
			const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
			return redactUnexpected(async () => {
				const rows = asRows(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtForumThreads)
							.where(
								and(eq(mtForumThreads.authorUserId, id), isNull(mtForumThreads.removedAt))
							)
							.orderBy(desc(mtForumThreads.createdAt))
							.limit(take)
					)
				);
				return rows;
			});
		},

		/** @param {unknown} userId */
		async getStudentRole(userId) {
			const profile = await this.getStudentProfile(userId);
			return profile?.role ?? null;
		},

		/** @param {unknown} userId */
		async acceptNimDisclosure(userId) {
			const id = requiredUserId(userId);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction
							.select()
							.from(mtStudentProfiles)
							.where(eq(mtStudentProfiles.userId, id))
					);
					if (!existing) return notFound();
					if (existing.nimDisclosureAcceptedAt) return existing;
					const updated = oneRow(
						await transaction
							.update(mtStudentProfiles)
							.set({ nimDisclosureAcceptedAt: new Date(), updatedAt: new Date() })
							.where(eq(mtStudentProfiles.userId, id))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/**
		 * @param {{ userId: unknown, sha256: unknown, byteLength: unknown, extractedText?: unknown }} input
		 */
		async saveOutlineDocument(input) {
			const userId = requiredUserId(input.userId);
			const sha256 = requiredSha256(input.sha256);
			const byteLength = requiredPositiveInt(input.byteLength);
			const extractedText =
				input.extractedText === undefined || input.extractedText === null
					? null
					: requiredText(String(input.extractedText).trim(), 2_000_000);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction
							.select()
							.from(mtOutlineDocuments)
							.where(
								and(eq(mtOutlineDocuments.userId, userId), eq(mtOutlineDocuments.sha256, sha256))
							)
					);
					if (existing) {
						if (existing.byteLength !== byteLength) return conflict();
						if (
							existing.extractedText &&
							extractedText &&
							existing.extractedText !== extractedText
						) {
							return conflict();
						}
						if (!existing.extractedText && extractedText) {
							const updated = oneRow(
								await transaction
									.update(mtOutlineDocuments)
									.set({ extractedText, updatedAt: new Date() })
									.where(eq(mtOutlineDocuments.id, existing.id))
									.returning()
							);
							return updated ?? unavailable();
						}
						return existing;
					}
					return insertOrRecover(
						transaction,
						mtOutlineDocuments,
						{ userId, sha256, byteLength, extractedText },
						async () =>
							oneRow(
								await transaction
									.select()
									.from(mtOutlineDocuments)
									.where(
										and(
											eq(mtOutlineDocuments.userId, userId),
											eq(mtOutlineDocuments.sha256, sha256)
										)
									)
							)
					);
				})
			);
		},

		/** @param {{ userId: unknown, sha256: unknown }} input */
		async getOutlineDocument(input) {
			const userId = requiredUserId(input.userId);
			const sha256 = requiredSha256(input.sha256);
			return redactUnexpected(async () =>
				oneRow(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtOutlineDocuments)
							.where(
								and(eq(mtOutlineDocuments.userId, userId), eq(mtOutlineDocuments.sha256, sha256))
							)
					)
				)
			);
		},

		/** @param {{ documentSha256?: unknown, offeringId?: unknown }} input */
		async findExtraction(input) {
			const documentSha256 =
				input.documentSha256 === undefined || input.documentSha256 === null
					? null
					: requiredSha256(input.documentSha256);
			const offeringId = optionalUuid(input.offeringId);
			if (!documentSha256 && !offeringId) return invalid();
			return redactUnexpected(() =>
				transact(async (transaction) => {
					if (documentSha256 && offeringId) {
						const exact = oneRow(
							await transaction
								.select()
								.from(mtOutlineExtractions)
								.where(
									and(
										eq(mtOutlineExtractions.documentSha256, documentSha256),
										eq(mtOutlineExtractions.offeringId, offeringId)
									)
								)
						);
						if (exact) return exact;
					}
					if (documentSha256) {
						const bySha = asRows(
							await transaction
								.select()
								.from(mtOutlineExtractions)
								.where(eq(mtOutlineExtractions.documentSha256, documentSha256))
								.orderBy(desc(mtOutlineExtractions.createdAt))
						);
						if (bySha[0]) return bySha[0];
					}
					if (!offeringId) return null;
					const byOffering = asRows(
						await transaction
							.select()
							.from(mtOutlineExtractions)
							.where(eq(mtOutlineExtractions.offeringId, offeringId))
							.orderBy(desc(mtOutlineExtractions.createdAt))
					);
					return byOffering[0] ?? null;
				})
			);
		},

		/**
		 * @param {{
		 *   documentSha256: unknown,
		 *   offeringId?: unknown,
		 *   proposals: unknown,
		 *   model?: unknown
		 * }} input
		 */
		async saveExtraction(input) {
			const documentSha256 = requiredSha256(input.documentSha256);
			const offeringId = optionalUuid(input.offeringId);
			const proposals = requiredJsonObject(input.proposals);
			const model = optionalText(input.model, 120);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const lookup = () =>
						offeringId
							? transaction
									.select()
									.from(mtOutlineExtractions)
									.where(
										and(
											eq(mtOutlineExtractions.documentSha256, documentSha256),
											eq(mtOutlineExtractions.offeringId, offeringId)
										)
									)
							: transaction
									.select()
									.from(mtOutlineExtractions)
									.where(
										and(
											eq(mtOutlineExtractions.documentSha256, documentSha256),
											isNull(mtOutlineExtractions.offeringId)
										)
									);
					const existing = oneRow(await lookup());
					if (existing) {
						const existingNeeds = (() => {
							const raw = existing.proposals;
							if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true;
							const row = /** @type {Record<string, unknown>} */ (raw);
							const courseCode = typeof row.courseCode === 'string' ? row.courseCode.trim() : '';
							const title = typeof row.title === 'string' ? row.title.trim() : '';
							return !courseCode && !title;
						})();
						const incomingHas =
							typeof proposals.courseCode === 'string' &&
							proposals.courseCode.trim() &&
							typeof proposals.title === 'string' &&
							proposals.title.trim();
						if (existingNeeds && incomingHas) {
							const updated = oneRow(
								await transaction
									.update(mtOutlineExtractions)
									.set({ proposals, model, updatedAt: new Date() })
									.where(eq(mtOutlineExtractions.id, existing.id))
									.returning()
							);
							return { extraction: updated ?? existing, cacheHit: false };
						}
						return { extraction: existing, cacheHit: true };
					}
					try {
						const created = oneRow(
							await transaction
								.insert(mtOutlineExtractions)
								.values({
									documentSha256,
									offeringId,
									proposals,
									model,
									inferenceCount: 1
								})
								.returning()
						);
						if (!created) return unavailable();
						return { extraction: created, cacheHit: false };
					} catch (error) {
						if (!isUniqueViolation(error)) throw error;
						const raced = oneRow(await lookup());
						if (!raced) return conflict();
						return { extraction: raced, cacheHit: true };
					}
				})
			);
		},

		/**
		 * @param {{
		 *   offeringId: unknown,
		 *   contributorUserId?: unknown,
		 *   documentSha256: unknown,
		 *   structured: unknown
		 * }} input
		 */
		async publishCatalogContribution(input) {
			const offeringId = requiredUuid(input.offeringId);
			const contributorUserId = optionalUserId(input.contributorUserId);
			const documentSha256 = requiredSha256(input.documentSha256);
			const structured = requiredJsonObject(input.structured);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					await transaction.execute(
						sql`SELECT pg_advisory_xact_lock(hashtextextended(${`mt-catalog-offering:v1:${offeringId}`}, 0))`
					);
					const offering = oneRow(
						await transaction
							.select()
							.from(mtCourseOfferings)
							.where(eq(mtCourseOfferings.id, offeringId))
					);
					if (!offering) return notFound();

					const existingSame = oneRow(
						await transaction
							.select()
							.from(mtCatalogContributions)
							.where(
								and(
									eq(mtCatalogContributions.offeringId, offeringId),
									eq(mtCatalogContributions.documentSha256, documentSha256)
								)
							)
					);
					const others = asRows(
						await transaction
							.select()
							.from(mtCatalogContributions)
							.where(
								and(
									eq(mtCatalogContributions.offeringId, offeringId),
									ne(mtCatalogContributions.documentSha256, documentSha256)
								)
							)
					);
					const liveOthers = others.filter((row) => row.status !== 'withdrawn');
					const decision = resolveCatalogContributionStatus(existingSame, structured, liveOthers);

					if (existingSame && decision === 'reuse') {
						return { contribution: existingSame, conflict: existingSame.status === 'conflict' };
					}

					if (existingSame && decision === 'conflict') {
						if (existingSame.status === 'conflict') {
							return { contribution: existingSame, conflict: true };
						}
						const updated = oneRow(
							await transaction
								.update(mtCatalogContributions)
								.set({ status: 'conflict', updatedAt: new Date() })
								.where(eq(mtCatalogContributions.id, existingSame.id))
								.returning()
						);
						return { contribution: updated ?? unavailable(), conflict: true };
					}

					// Keep any already-published offering facts live for students.
					// Later disagreeing uploads enter the staff conflict queue only.
					const created = await insertOrRecover(
						transaction,
						mtCatalogContributions,
						{
							offeringId,
							contributorUserId,
							documentSha256,
							structured,
							status: decision
						},
						async () =>
							oneRow(
								await transaction
									.select()
									.from(mtCatalogContributions)
									.where(
										and(
											eq(mtCatalogContributions.offeringId, offeringId),
											eq(mtCatalogContributions.documentSha256, documentSha256)
										)
									)
							)
					);
					return { contribution: created, conflict: created.status === 'conflict' };
				})
			);
		},

		/** @param {{ offeringId: unknown, status?: unknown }} input */
		async listCatalogContributions(input) {
			const offeringId = requiredUuid(input.offeringId);
			const status =
				input.status === undefined || input.status === null ? null : requiredText(input.status, 16);
			if (status && status !== 'published' && status !== 'conflict' && status !== 'withdrawn') {
				return invalid();
			}
			return redactUnexpected(async () => {
				const rows = asRows(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtCatalogContributions)
							.where(eq(mtCatalogContributions.offeringId, offeringId))
							.orderBy(desc(mtCatalogContributions.createdAt))
					)
				);
				return status ? rows.filter((row) => row.status === status) : rows;
			});
		},

		/**
		 * @param {{ termId?: unknown }} [input]
		 */
		async listPublishedCatalog(input = {}) {
			const termId =
				input.termId === undefined || input.termId === null || input.termId === ''
					? null
					: requiredText(input.termId, 64);
			return redactUnexpected(async () => {
				const rows = asRows(
					await transact((transaction) =>
						transaction
							.select({
								id: mtCatalogContributions.id,
								courseId: mtCourses.id,
								termId: mtCourseOfferings.termId,
								courseCode: mtCourses.code,
								title: mtCourses.canonicalTitle,
								section: mtCourseOfferings.section,
								teacherName: mtCourseOfferings.teacherName,
								structured: mtCatalogContributions.structured,
								status: mtCatalogContributions.status
							})
							.from(mtCatalogContributions)
							.innerJoin(
								mtCourseOfferings,
								eq(mtCatalogContributions.offeringId, mtCourseOfferings.id)
							)
							.innerJoin(mtCourses, eq(mtCourseOfferings.courseId, mtCourses.id))
							.where(eq(mtCatalogContributions.status, 'published'))
							.orderBy(asc(mtCourses.code))
					)
				);
				return termId ? rows.filter((row) => row.termId === termId) : rows;
			});
		},

		/**
		 * Offerings with at least one conflict: return every live peer (published + conflict)
		 * so staff can compare the catalog incumbent with later disagreeing uploads.
		 */
		async listConflictCatalog() {
			return redactUnexpected(async () => {
				const rows = asRows(
					await transact((transaction) =>
						transaction
							.select({
								id: mtCatalogContributions.id,
								offeringId: mtCatalogContributions.offeringId,
								documentSha256: mtCatalogContributions.documentSha256,
								structured: mtCatalogContributions.structured,
								contributorUserId: mtCatalogContributions.contributorUserId,
								status: mtCatalogContributions.status,
								createdAt: mtCatalogContributions.createdAt,
								updatedAt: mtCatalogContributions.updatedAt,
								termId: mtCourseOfferings.termId,
								courseCode: mtCourses.code,
								title: mtCourses.canonicalTitle,
								section: mtCourseOfferings.section,
								teacherName: mtCourseOfferings.teacherName
							})
							.from(mtCatalogContributions)
							.innerJoin(
								mtCourseOfferings,
								eq(mtCatalogContributions.offeringId, mtCourseOfferings.id)
							)
							.innerJoin(mtCourses, eq(mtCourseOfferings.courseId, mtCourses.id))
							.where(inArray(mtCatalogContributions.status, ['conflict', 'published']))
							.orderBy(asc(mtCourses.code), asc(mtCatalogContributions.createdAt))
					)
				);
				const conflictOfferingIds = new Set(
					rows.filter((row) => row.status === 'conflict').map((row) => row.offeringId)
				);
				return rows.filter((row) => conflictOfferingIds.has(row.offeringId));
			});
		},

		/**
		 * Staff picks one peer as published; other live peers for that offering
		 * become withdrawn so the public catalog can show a single fact set.
		 * @param {unknown} contributionId
		 */
		async resolveCatalogConflict(contributionId) {
			const id = requiredUuid(contributionId);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction
							.select()
							.from(mtCatalogContributions)
							.where(eq(mtCatalogContributions.id, id))
					);
					if (!existing) return notFound();
					if (existing.status !== 'conflict' && existing.status !== 'published') {
						return invalid();
					}

					/** @type {any} */
					let published = existing;
					if (existing.status === 'conflict') {
						published = oneRow(
							await transaction
								.update(mtCatalogContributions)
								.set({ status: 'published', updatedAt: new Date() })
								.where(eq(mtCatalogContributions.id, id))
								.returning()
						);
						if (!published) return unavailable();
					}

					await transaction
						.update(mtCatalogContributions)
						.set({ status: 'withdrawn', updatedAt: new Date() })
						.where(
							and(
								eq(mtCatalogContributions.offeringId, existing.offeringId),
								ne(mtCatalogContributions.id, id),
								inArray(mtCatalogContributions.status, ['conflict', 'published'])
							)
						);

					return published;
				})
			);
		},

		/**
		 * @param {{
		 *   name: unknown,
		 *   slug: unknown,
		 *   category?: unknown,
		 *   description?: unknown,
		 *   links?: unknown,
		 *   published?: unknown
		 * }} input
		 */
		async createClub(input) {
			const name = requiredText(input.name, 160);
			const slug = requiredText(input.slug, 120);
			if (!SLUG_PATTERN.test(slug)) return invalid();
			const category = optionalText(input.category, 80);
			const description = optionalText(input.description, 4000);
			const links = normalizeClubLinks(input.links);
			const published = input.published === true;
			return redactUnexpected(() =>
				transact((transaction) =>
					insertOrRecover(
						transaction,
						mtClubs,
						{ name, slug, category, description, links, published },
						async () => null
					)
				)
			);
		},

		async listPublishedClubs() {
			return redactUnexpected(async () =>
				asRows(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtClubs)
							.where(eq(mtClubs.published, true))
							.orderBy(asc(mtClubs.name))
					)
				)
			);
		},

		/** @param {unknown} slug */
		async getPublishedClubBySlug(slug) {
			const normalized = typeof slug === 'string' ? slug.trim() : '';
			if (!normalized || !SLUG_PATTERN.test(normalized)) return null;
			return redactUnexpected(async () =>
				oneRow(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtClubs)
							.where(and(eq(mtClubs.slug, normalized), eq(mtClubs.published, true)))
							.limit(1)
					)
				)
			);
		},

		/** @param {{ submitterUserId?: unknown, clubId?: unknown, payload: unknown }} input */
		async submitClub(input) {
			const submitterUserId = optionalUserId(input.submitterUserId);
			const clubId = optionalUuid(input.clubId);
			const payload = requiredJsonObject(input.payload);
			return redactUnexpected(async () => {
				const created = oneRow(
					await transact((transaction) =>
						transaction
							.insert(mtClubSubmissions)
							.values({ submitterUserId, clubId, payload, status: 'pending' })
							.returning()
					)
				);
				return created ?? unavailable();
			});
		},

		/** @param {{ status?: unknown }} [input] */
		async listClubSubmissions(input = {}) {
			const status =
				input.status === undefined || input.status === null ? null : requiredText(input.status, 16);
			if (status && !CLUB_SUBMISSION_STATUSES.has(status)) return invalid();
			return redactUnexpected(async () => {
				const rows = asRows(
					await transact((transaction) =>
						transaction.select().from(mtClubSubmissions).orderBy(desc(mtClubSubmissions.createdAt))
					)
				);
				return status ? rows.filter((row) => row.status === status) : rows;
			});
		},

		/** @param {unknown} id */
		async getClubSubmission(id) {
			const submissionId = requiredUuid(id);
			return redactUnexpected(async () =>
				oneRow(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtClubSubmissions)
							.where(eq(mtClubSubmissions.id, submissionId))
							.limit(1)
					)
				)
			);
		},

		/** @param {unknown} id @param {unknown} payload */
		async updateClubSubmissionPayload(id, payload) {
			const submissionId = requiredUuid(id);
			const nextPayload = requiredJsonObject(payload);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction
							.select()
							.from(mtClubSubmissions)
							.where(eq(mtClubSubmissions.id, submissionId))
					);
					if (!existing) return notFound();
					const updated = oneRow(
						await transaction
							.update(mtClubSubmissions)
							.set({ payload: nextPayload, updatedAt: new Date() })
							.where(eq(mtClubSubmissions.id, submissionId))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/** @param {unknown} id @param {unknown} status */
		async setClubSubmissionStatus(id, status) {
			const submissionId = requiredUuid(id);
			const nextStatus = requiredText(status, 16);
			if (!CLUB_SUBMISSION_STATUSES.has(nextStatus)) return invalid();
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction
							.select()
							.from(mtClubSubmissions)
							.where(eq(mtClubSubmissions.id, submissionId))
					);
					if (!existing) return notFound();
					const updated = oneRow(
						await transaction
							.update(mtClubSubmissions)
							.set({ status: nextStatus, updatedAt: new Date() })
							.where(eq(mtClubSubmissions.id, submissionId))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/**
		 * @param {{
		 *   authorUserId: unknown,
		 *   title: unknown,
		 *   body: unknown,
		 *   category: unknown,
		 *   courseId?: unknown,
		 *   offeringId?: unknown,
		 *   termId?: unknown
		 * }} input
		 */
		async createThread(input) {
			const authorUserId = requiredUserId(input.authorUserId);
			const title = requiredText(input.title, 240);
			const body = requiredText(input.body, 20_000);
			const category = requiredText(input.category, 32);
			if (!FORUM_CATEGORIES.has(category)) return invalid();
			const courseId = optionalUuid(input.courseId);
			const offeringId = optionalUuid(input.offeringId);
			const termId = optionalText(input.termId, 64);
			return redactUnexpected(async () => {
				const created = oneRow(
					await transact(async (transaction) => {
						await assertPosterAllowed(transaction, authorUserId);
						return transaction
							.insert(mtForumThreads)
							.values({ authorUserId, title, body, category, courseId, offeringId, termId })
							.returning();
					})
				);
				return created ?? unavailable();
			});
		},

		/** @param {{ category?: unknown, courseId?: unknown }} [input] */
		async listThreads(input = {}) {
			const category =
				input.category === undefined || input.category === null
					? null
					: requiredText(input.category, 32);
			if (category && !FORUM_CATEGORIES.has(category)) return invalid();
			const courseId = optionalUuid(input.courseId);
			return redactUnexpected(async () => {
				const rows = asRows(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtForumThreads)
							.where(isNull(mtForumThreads.removedAt))
							.orderBy(desc(mtForumThreads.createdAt))
					)
				);
				return rows.filter((row) => {
					if (category && row.category !== category) return false;
					if (courseId && row.courseId !== courseId) return false;
					return true;
				});
			});
		},

		/** @param {unknown} id */
		async getThread(id) {
			const threadId = requiredUuid(id);
			return redactUnexpected(async () =>
				oneRow(
					await transact((transaction) =>
						transaction.select().from(mtForumThreads).where(eq(mtForumThreads.id, threadId))
					)
				)
			);
		},

		/** @param {{ threadId: unknown, authorUserId: unknown, body: unknown }} input */
		async createReply(input) {
			const threadId = requiredUuid(input.threadId);
			const authorUserId = requiredUserId(input.authorUserId);
			const body = requiredText(input.body, 20_000);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					await assertPosterAllowed(transaction, authorUserId);
					const thread = oneRow(
						await transaction.select().from(mtForumThreads).where(eq(mtForumThreads.id, threadId))
					);
					if (!thread || thread.removedAt) return notFound();
					if (thread.lockedAt) return conflict();
					const created = oneRow(
						await transaction
							.insert(mtForumReplies)
							.values({ threadId, authorUserId, body })
							.returning()
					);
					return created ?? unavailable();
				})
			);
		},

		/** @param {unknown} threadId */
		async listReplies(threadId) {
			const id = requiredUuid(threadId);
			return redactUnexpected(async () =>
				asRows(
					await transact((transaction) =>
						transaction
							.select()
							.from(mtForumReplies)
							.where(and(eq(mtForumReplies.threadId, id), isNull(mtForumReplies.removedAt)))
							.orderBy(asc(mtForumReplies.createdAt))
					)
				)
			);
		},

		/** @param {unknown} id */
		async lockThread(id) {
			const threadId = requiredUuid(id);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction.select().from(mtForumThreads).where(eq(mtForumThreads.id, threadId))
					);
					if (!existing) return notFound();
					if (existing.lockedAt) return existing;
					const updated = oneRow(
						await transaction
							.update(mtForumThreads)
							.set({ lockedAt: new Date(), updatedAt: new Date() })
							.where(eq(mtForumThreads.id, threadId))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/** @param {unknown} id */
		async removeThread(id) {
			const threadId = requiredUuid(id);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction.select().from(mtForumThreads).where(eq(mtForumThreads.id, threadId))
					);
					if (!existing) return notFound();
					if (existing.removedAt) return existing;
					const updated = oneRow(
						await transaction
							.update(mtForumThreads)
							.set({ removedAt: new Date(), updatedAt: new Date() })
							.where(eq(mtForumThreads.id, threadId))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/** @param {unknown} id */
		async removeReply(id) {
			const replyId = requiredUuid(id);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction.select().from(mtForumReplies).where(eq(mtForumReplies.id, replyId))
					);
					if (!existing) return notFound();
					if (existing.removedAt) return existing;
					const updated = oneRow(
						await transaction
							.update(mtForumReplies)
							.set({ removedAt: new Date(), updatedAt: new Date() })
							.where(eq(mtForumReplies.id, replyId))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/** @param {unknown} id */
		async getReply(id) {
			const replyId = requiredUuid(id);
			return redactUnexpected(async () =>
				oneRow(
					await transact((transaction) =>
						transaction.select().from(mtForumReplies).where(eq(mtForumReplies.id, replyId))
					)
				)
			);
		},

		/** @param {{ id: unknown, body: unknown }} input */
		async updateThread(input) {
			const threadId = requiredUuid(input.id);
			const body = requiredText(input.body, 20_000);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction.select().from(mtForumThreads).where(eq(mtForumThreads.id, threadId))
					);
					if (!existing) return notFound();
					if (existing.removedAt) return notFound();
					const updated = oneRow(
						await transaction
							.update(mtForumThreads)
							.set({ body, updatedAt: new Date() })
							.where(eq(mtForumThreads.id, threadId))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/** @param {{ id: unknown, body: unknown }} input */
		async updateReply(input) {
			const replyId = requiredUuid(input.id);
			const body = requiredText(input.body, 20_000);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction.select().from(mtForumReplies).where(eq(mtForumReplies.id, replyId))
					);
					if (!existing) return notFound();
					if (existing.removedAt) return notFound();
					const updated = oneRow(
						await transaction
							.update(mtForumReplies)
							.set({ body, updatedAt: new Date() })
							.where(eq(mtForumReplies.id, replyId))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		},

		/**
		 * @param {{
		 *   targetKind: unknown,
		 *   targetId: unknown,
		 *   reporterUserId: unknown,
		 *   reason: unknown
		 * }} input
		 */
		async createReport(input) {
			const targetKind = requiredText(input.targetKind, 16);
			if (!REPORT_KINDS.has(targetKind)) return invalid();
			const targetId = requiredUuid(input.targetId);
			const reporterUserId = requiredUserId(input.reporterUserId);
			const reason = requiredText(input.reason, 500);
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const target =
						targetKind === 'thread'
							? oneRow(
									await transaction
										.select()
										.from(mtForumThreads)
										.where(eq(mtForumThreads.id, targetId))
								)
							: oneRow(
									await transaction
										.select()
										.from(mtForumReplies)
										.where(eq(mtForumReplies.id, targetId))
								);
					if (!target) return notFound();
					const created = oneRow(
						await transaction
							.insert(mtForumReports)
							.values({ targetKind, targetId, reporterUserId, reason, status: 'open' })
							.returning()
					);
					return created ?? unavailable();
				})
			);
		},

		/** @param {{ status?: unknown }} [input] */
		async listReports(input = {}) {
			const status =
				input.status === undefined || input.status === null ? null : requiredText(input.status, 16);
			if (status && !REPORT_STATUSES.has(status)) return invalid();
			return redactUnexpected(async () => {
				const rows = asRows(
					await transact((transaction) =>
						transaction.select().from(mtForumReports).orderBy(desc(mtForumReports.createdAt))
					)
				);
				return status ? rows.filter((row) => row.status === status) : rows;
			});
		},

		/** @param {unknown} id @param {unknown} status */
		async setReportStatus(id, status) {
			const reportId = requiredUuid(id);
			const nextStatus = requiredText(status, 16);
			if (nextStatus !== 'resolved' && nextStatus !== 'dismissed') return invalid();
			return redactUnexpected(() =>
				transact(async (transaction) => {
					const existing = oneRow(
						await transaction.select().from(mtForumReports).where(eq(mtForumReports.id, reportId))
					);
					if (!existing) return notFound();
					const updated = oneRow(
						await transaction
							.update(mtForumReports)
							.set({
								status: nextStatus,
								resolvedAt: new Date(),
								updatedAt: new Date()
							})
							.where(eq(mtForumReports.id, reportId))
							.returning()
					);
					return updated ?? unavailable();
				})
			);
		}
	});
}
