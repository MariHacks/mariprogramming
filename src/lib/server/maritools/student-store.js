import { readRuntimeEnvironment } from '../config/environment.js';
import { isCompleteStudentId, isStaffAccount } from './community.js';
import {
	MariToolsConflictError,
	MariToolsNotFoundError,
	MariToolsUnavailableError as RepoUnavailableError,
	MariToolsValidationError,
	createMariToolsRepository,
	publicStudentView
} from './repository.js';

export class MaritoolsInputError extends Error {
	/** @param {string} code */
	constructor(code) {
		super(code);
		this.name = 'MaritoolsInputError';
		this.code = code;
	}
}

export class MaritoolsUnavailableError extends Error {
	constructor() {
		super('MariTools is unavailable');
		this.name = 'MaritoolsUnavailableError';
		this.code = 'MARITOOLS_UNAVAILABLE';
	}
}

/**
 * @param {ReturnType<typeof createMariToolsRepository>} inner
 */
export function createStudentStore(inner) {
	/** @param {() => Promise<any>} operation */
	async function wrap(operation) {
		try {
			return await operation();
		} catch (error) {
			if (error instanceof MaritoolsInputError || error instanceof MaritoolsUnavailableError) {
				throw error;
			}
			if (error instanceof MariToolsValidationError || error instanceof MariToolsConflictError) {
				throw new MaritoolsInputError(error.code ?? 'invalid');
			}
			if (error instanceof MariToolsNotFoundError || error instanceof RepoUnavailableError) {
				throw new MaritoolsUnavailableError();
			}
			throw new MaritoolsUnavailableError();
		}
	}

	return {
		listTerms() {
			return wrap(() => inner.listTerms());
		},

		/** @param {string} userId */
		getProfile(userId) {
			return wrap(async () => {
				const row = await inner.getStudentProfile(userId);
				return row ? publicStudentView(row) : null;
			});
		},

		/** @param {string} userId */
		acceptOutlineAnalysis(userId) {
			return wrap(() => inner.acceptNimDisclosure(userId));
		},

		/**
		 * @param {{
		 *   userId: string,
		 *   email: string,
		 *   studentId: string,
		 *   displayName?: string | null
		 * }} input
		 */
		async completeProfile(input) {
			if (!isCompleteStudentId(input.studentId)) {
				throw new MaritoolsInputError('invalid-student-id');
			}
			return wrap(async () => {
				await inner.upsertStudentProfile({
					userId: input.userId,
					studentId: String(input.studentId).trim(),
					displayName: input.displayName ? String(input.displayName).trim().slice(0, 120) : null,
					role: isStaffAccount(input.email) ? 'staff' : 'student'
				});
				const row = await inner.getStudentProfile(input.userId);
				return row ? publicStudentView(row) : null;
			});
		},

		/**
		 * @param {{ termId?: string, query?: string }} [filter]
		 */
		listPublishedCatalog(filter = {}) {
			return wrap(async () => {
				const termId = String(filter.termId ?? '').trim();
				const query = String(filter.query ?? '')
					.trim()
					.toLowerCase();
				const rows = await inner.listPublishedCatalog(termId ? { termId } : {});
				return rows
					.filter((row) => {
						if (!query) return true;
						return [row.courseCode, row.title, row.teacherName].some((value) =>
							String(value ?? '')
								.toLowerCase()
								.includes(query)
						);
					})
					.map((row) => ({
						id: row.id,
						offeringId: row.offeringId ?? null,
						courseId: row.courseId ?? null,
						termId: row.termId,
						courseCode: row.courseCode,
						title: row.title,
						section: row.section,
						teacherName: row.teacherName,
						structured: row.structured,
						status: row.status
					}));
			});
		},

		/** @param {string} courseId */
		listCatalogForCourse(courseId) {
			return wrap(async () => {
				const rows = await inner.listCatalogForCourse(courseId);
				return rows.map((row) => ({
					id: row.id,
					offeringId: row.offeringId ?? null,
					courseId: row.courseId ?? null,
					termId: row.termId,
					courseCode: row.courseCode,
					title: row.title,
					section: row.section,
					teacherName: row.teacherName,
					structured: row.structured,
					status: row.status,
					createdAt: row.createdAt ?? null
				}));
			});
		},

		/** @param {string} sha256 */
		getExtraction(sha256) {
			return wrap(async () => {
				const row = await inner.findExtraction({ documentSha256: sha256 });
				if (!row) return null;
				return { proposals: row.proposals, inferenceCount: row.inferenceCount };
			});
		},

		/** @param {string} userId */
		listOutlines(userId) {
			return wrap(async () => {
				const rows = await inner.listUserOutlines(userId);
				return rows.map((/** @type {any} */ row) => ({
					sha256: row.sha256,
					createdAt: row.createdAt,
					extraction:
						(row.reviewProposals ?? row.proposals)
							? {
									proposals: row.reviewProposals ?? row.proposals,
									inferenceCount: row.inferenceCount
								}
							: null
				}));
			});
		},

		/** @param {{ userId: string, sha256: string, proposals: object }} input */
		saveOutlineReview(input) {
			return wrap(() => inner.saveOutlineReview(input));
		},

		/** @param {{ userId: string, sha256: string }} input */
		deleteOutline(input) {
			return wrap(() => inner.deleteOutlineDocument(input));
		},

		/** @param {string} userId */
		getSchedule(userId) {
			return wrap(async () => (await inner.getSavedSchedule(userId))?.paste ?? '');
		},

		/** @param {{ userId: string, paste: string }} input */
		saveSchedule(input) {
			return wrap(() => inner.saveSchedule({ userId: input.userId, paste: input.paste }));
		},

		/** @param {{ userId: string, sha256: string, byteLength: number, extractedText: string }} input */
		saveOutlineDocument(input) {
			return wrap(() =>
				inner.saveOutlineDocument({
					userId: input.userId,
					sha256: input.sha256,
					byteLength: input.byteLength,
					extractedText: input.extractedText
				})
			);
		},

		/**
		 * @param {{
		 *   documentSha256: string,
		 *   offeringId: string | null,
		 *   proposals: object,
		 *   model: string | null,
		 *   inferenceCount: number
		 * }} input
		 */
		saveExtraction(input) {
			return wrap(() =>
				inner.saveExtraction({
					documentSha256: input.documentSha256,
					offeringId: input.offeringId,
					proposals: input.proposals,
					model: input.model
				})
			);
		},

		/**
		 * @param {{
		 *   contributorUserId: string,
		 *   documentSha256: string,
		 *   termId: string,
		 *   courseCode: string,
		 *   title: string,
		 *   section: string,
		 *   teacherName: string,
		 *   structured: object
		 * }} input
		 */
		async contribute(input) {
			const termId = String(input.termId ?? '').trim();
			const courseCode = String(input.courseCode ?? '').trim();
			const title = String(input.title ?? '').trim();
			const section = String(input.section ?? '').trim();
			const teacherName = String(input.teacherName ?? '').trim();
			if ([termId, courseCode, title, section, teacherName].some((value) => value.length === 0)) {
				throw new MaritoolsInputError('invalid-offering');
			}
			return wrap(async () => {
				const { offering } = await inner.findOrCreateOffering({
					termId,
					code: courseCode,
					section,
					teacherName,
					canonicalTitle: title
				});
				const result = await inner.publishCatalogContribution({
					offeringId: offering.id,
					contributorUserId: input.contributorUserId,
					documentSha256: input.documentSha256,
					structured: input.structured
				});
				return { offeringId: offering.id, conflict: result.conflict };
			});
		}
	};
}

export function openStudentStore() {
	try {
		return createStudentStore(
			createMariToolsRepository({ databaseUrl: readRuntimeEnvironment().databaseUrl })
		);
	} catch (error) {
		if (error instanceof MaritoolsUnavailableError) throw error;
		throw new MaritoolsUnavailableError();
	}
}
