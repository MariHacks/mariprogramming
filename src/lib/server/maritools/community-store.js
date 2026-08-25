import { readRuntimeEnvironment } from '../config/environment.js';
import { isStaffAccount } from './community.js';
import {
	MariToolsConflictError,
	MariToolsNotFoundError,
	MariToolsUnavailableError as RepoUnavailableError,
	MariToolsValidationError,
	createMariToolsRepository,
	publicStudentView
} from './repository.js';
import { MaritoolsInputError, MaritoolsUnavailableError } from './student-store.js';

export { MaritoolsInputError, MaritoolsUnavailableError };

/** @param {string} name */
export function slugFromName(name) {
	return String(name)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-+|-+$/gu, '')
		.slice(0, 120);
}

/** @param {any} thread */
export function publicThreadView(thread) {
	if (!thread || typeof thread !== 'object') return null;
	return {
		id: thread.id,
		title: thread.title,
		body: thread.body,
		category: thread.category,
		courseId: thread.courseId ?? null,
		offeringId: thread.offeringId ?? null,
		termId: thread.termId ?? null,
		createdAt: thread.createdAt,
		lockedAt: thread.lockedAt ?? null,
		removedAt: thread.removedAt ?? null
	};
}

/** @param {any} reply */
export function publicReplyView(reply) {
	if (!reply || typeof reply !== 'object') return null;
	return {
		id: reply.id,
		threadId: reply.threadId,
		body: reply.body,
		createdAt: reply.createdAt,
		removedAt: reply.removedAt ?? null
	};
}

/** @param {any} club */
export function publicClubView(club) {
	if (!club || typeof club !== 'object') return null;
	return {
		id: club.id,
		name: club.name,
		slug: club.slug,
		category: club.category ?? null,
		description: club.description ?? null,
		links: Array.isArray(club.links) ? club.links : []
	};
}

/**
 * @param {ReturnType<typeof createMariToolsRepository>} inner
 */
export function createCommunityStore(inner) {
	async function wrap(operation) {
		try {
			return await operation();
		} catch (error) {
			if (error instanceof MaritoolsInputError || error instanceof MaritoolsUnavailableError) {
				throw error;
			}
			if (error instanceof MariToolsValidationError || error instanceof MariToolsConflictError) {
				throw new MaritoolsInputError(error.code);
			}
			if (error instanceof MariToolsNotFoundError || error instanceof RepoUnavailableError) {
				throw new MaritoolsUnavailableError();
			}
			throw new MaritoolsUnavailableError();
		}
	}

	return {
		listClubs() {
			return wrap(async () => {
				const rows = await inner.listPublishedClubs();
				return rows.map(publicClubView).filter(Boolean);
			});
		},

		/** @param {{ submitterUserId?: string, payload: object, clubId?: string | null }} input */
		submitClub(input) {
			return wrap(() =>
				inner.submitClub({
					submitterUserId: input.submitterUserId,
					clubId: input.clubId ?? null,
					payload: input.payload
				})
			);
		},

		listPendingClubSubmissions() {
			return wrap(async () => {
				const rows = await inner.listClubSubmissions({ status: 'pending' });
				return rows.map((row) => ({
					id: row.id,
					name: row.payload?.name ?? '',
					slug: row.payload?.slug ?? '',
					category: row.payload?.category ?? '',
					description: row.payload?.description ?? '',
					links: Array.isArray(row.payload?.links) ? row.payload.links : []
				}));
			});
		},

		/** @param {string} submissionId */
		publishPendingClub(submissionId) {
			return wrap(async () => {
				const pending = await inner.listClubSubmissions({ status: 'pending' });
				const submission = pending.find((row) => row.id === submissionId);
				if (!submission) throw new MaritoolsInputError('missing-submission');
				const payload = submission.payload ?? {};
				const name = String(payload.name ?? '').trim();
				const slug = String(payload.slug ?? '').trim() || slugFromName(name);
				if (!name || !slug) throw new MaritoolsInputError('invalid-club');
				try {
					const club = await inner.createClub({
						name,
						slug,
						category: payload.category ?? null,
						description: payload.description ?? null,
						links: payload.links ?? [],
						published: true
					});
					await inner.setClubSubmissionStatus(submissionId, 'published');
					return publicClubView(club);
				} catch (error) {
					if (!(error instanceof MariToolsConflictError)) throw error;
					await inner.setClubSubmissionStatus(submissionId, 'published');
					const clubs = await inner.listPublishedClubs();
					const club = clubs.find((row) => row.slug === slug);
					return publicClubView(club);
				}
			});
		},

		listCatalogCourses() {
			return wrap(async () => {
				const rows = await inner.listPublishedCatalog();
				const seen = new Map();
				for (const row of rows) {
					const id = row.courseId;
					if (!id || seen.has(id)) continue;
					seen.set(id, { id, code: row.courseCode, title: row.title });
				}
				return [...seen.values()];
			});
		},

		/** @param {{ category?: string, courseId?: string }} [filter] */
		listThreads(filter = {}) {
			return wrap(async () => {
				const rows = await inner.listThreads({
					category: filter.category || null,
					courseId: filter.courseId || undefined
				});
				return rows.map(publicThreadView).filter(Boolean);
			});
		},

		/** @param {string} id */
		getThread(id) {
			return wrap(async () => publicThreadView(await inner.getThread(id)));
		},

		/** @param {string} threadId */
		listReplies(threadId) {
			return wrap(async () => {
				const rows = await inner.listReplies(threadId);
				return rows.map(publicReplyView).filter(Boolean);
			});
		},

		/** @param {Record<string, unknown>} input */
		createThread(input) {
			return wrap(async () => publicThreadView(await inner.createThread(input)));
		},

		/** @param {Record<string, unknown>} input */
		createReply(input) {
			return wrap(async () => publicReplyView(await inner.createReply(input)));
		},

		/** @param {Record<string, unknown>} input */
		createReport(input) {
			return wrap(() => inner.createReport(input));
		},

		lockThread(id) {
			return wrap(async () => publicThreadView(await inner.lockThread(id)));
		},

		removeThread(id) {
			return wrap(async () => publicThreadView(await inner.removeThread(id)));
		},

		removeReply(id) {
			return wrap(async () => publicReplyView(await inner.removeReply(id)));
		},

		/** @param {string} userId */
		getProfile(userId) {
			return wrap(async () => {
				const row = await inner.getStudentProfile(userId);
				return row ? publicStudentView(row) : null;
			});
		},

		/** @param {string} email @param {string | null} [role] */
		isStaff(email, role = null) {
			return isStaffAccount(email, role);
		}
	};
}

export function openCommunityStore() {
	return createCommunityStore(
		createMariToolsRepository({ databaseUrl: readRuntimeEnvironment().databaseUrl })
	);
}
