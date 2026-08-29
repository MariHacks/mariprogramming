import { clubListingFromPayload, clubSubmissionView } from '$lib/maritools/club-listing.js';
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

/**
 * @param {string | null | undefined} authorUserId
 * @param {{ userId?: string | null, staff?: boolean } | null | undefined} viewer
 */
export function canManagePost(authorUserId, viewer) {
	if (!viewer) return false;
	if (viewer.staff) return true;
	return Boolean(viewer.userId && authorUserId && viewer.userId === authorUserId);
}

/** @param {unknown} value */
function normalizeAuthorDisplayName(value) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed || null;
}

/**
 * @param {ReturnType<typeof createMariToolsRepository>} inner
 * @param {Array<{ authorUserId?: string | null } | null | undefined>} rows
 */
async function withAuthorDisplayNames(inner, rows) {
	const ids = [
		...new Set(
			rows
				.map((row) => (typeof row?.authorUserId === 'string' ? row.authorUserId : null))
				.filter(Boolean)
		)
	];
	/** @type {Map<string, string | null>} */
	const names = new Map();
	await Promise.all(
		ids.map(async (id) => {
			const profile = await inner.getStudentProfile(id);
			names.set(id, normalizeAuthorDisplayName(profile?.displayName));
		})
	);
	return rows.map((row) => {
		if (!row || typeof row !== 'object') return row;
		const authorUserId = typeof row.authorUserId === 'string' ? row.authorUserId : null;
		return {
			...row,
			authorDisplayName: authorUserId ? (names.get(authorUserId) ?? null) : null
		};
	});
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
		removedAt: thread.removedAt ?? null,
		authorDisplayName: normalizeAuthorDisplayName(thread.authorDisplayName)
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
		removedAt: reply.removedAt ?? null,
		authorDisplayName: normalizeAuthorDisplayName(reply.authorDisplayName)
	};
}

/**
 * @template {Record<string, unknown>} T
 * @param {T | null} view
 * @param {string | null | undefined} authorUserId
 * @param {{ userId?: string | null, staff?: boolean } | null | undefined} viewer
 */
function withManageFlag(view, authorUserId, viewer) {
	if (!view) return null;
	return { ...view, canManage: canManagePost(authorUserId, viewer) };
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

		/** @param {string} slug */
		getPublishedClubBySlug(slug) {
			return wrap(async () => publicClubView(await inner.getPublishedClubBySlug(slug)));
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
				return rows.map((row) => clubSubmissionView(row));
			});
		},

		/** @param {string} submissionId */
		getClubSubmission(submissionId) {
			return wrap(async () => {
				const row = await inner.getClubSubmission(submissionId);
				if (!row) return null;
				return clubSubmissionView(row);
			});
		},

		/**
		 * @param {string} submissionId
		 * @param {Record<string, unknown>} payload
		 */
		updateClubSubmissionPayload(submissionId, payload) {
			return wrap(async () => {
				const existing = await inner.getClubSubmission(submissionId);
				if (!existing) throw new MaritoolsInputError('missing-submission');
				if (existing.status !== 'pending') throw new MaritoolsInputError('not-pending');
				const updated = await inner.updateClubSubmissionPayload(submissionId, payload);
				return clubSubmissionView(updated);
			});
		},

		/** @param {string} submissionId */
		publishPendingClub(submissionId) {
			return wrap(async () => {
				const submission = await inner.getClubSubmission(submissionId);
				if (!submission || submission.status !== 'pending') {
					throw new MaritoolsInputError('missing-submission');
				}
				const listing = clubListingFromPayload(submission.payload);
				const name = listing.name;
				const slug = listing.slug || slugFromName(name);
				if (!name || !slug) throw new MaritoolsInputError('invalid-club');
				try {
					const club = await inner.createClub({
						name,
						slug,
						category: listing.category || null,
						description: listing.description || null,
						links: listing.links,
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

		/** @param {string} submissionId */
		rejectPendingClub(submissionId) {
			return wrap(async () => {
				const submission = await inner.getClubSubmission(submissionId);
				if (!submission || submission.status !== 'pending') {
					throw new MaritoolsInputError('missing-submission');
				}
				const updated = await inner.setClubSubmissionStatus(submissionId, 'rejected');
				return clubSubmissionView(updated);
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

		/**
		 * @param {string} id
		 * @param {{ userId?: string | null, staff?: boolean } | null} [viewer]
		 */
		getThread(id, viewer = null) {
			return wrap(async () => {
				const thread = await inner.getThread(id);
				if (!thread) return null;
				const [enriched] = await withAuthorDisplayNames(inner, [thread]);
				return withManageFlag(publicThreadView(enriched), thread.authorUserId, viewer);
			});
		},

		/**
		 * @param {string} threadId
		 * @param {{ userId?: string | null, staff?: boolean } | null} [viewer]
		 */
		listReplies(threadId, viewer = null) {
			return wrap(async () => {
				const rows = await inner.listReplies(threadId);
				const enriched = await withAuthorDisplayNames(inner, rows);
				return enriched
					.map((row, index) =>
						withManageFlag(publicReplyView(row), rows[index]?.authorUserId, viewer)
					)
					.filter(Boolean);
			});
		},

		/**
		 * @param {string} id
		 * @param {{ userId?: string | null, staff?: boolean } | null | undefined} viewer
		 */
		canManageThread(id, viewer) {
			return wrap(async () => {
				const thread = await inner.getThread(id);
				if (!thread || thread.removedAt) return false;
				return canManagePost(thread.authorUserId, viewer);
			});
		},

		/**
		 * @param {string} id
		 * @param {{ userId?: string | null, staff?: boolean } | null | undefined} viewer
		 */
		canManageReply(id, viewer) {
			return wrap(async () => {
				const reply = await inner.getReply(id);
				if (!reply || reply.removedAt) return false;
				return canManagePost(reply.authorUserId, viewer);
			});
		},

		/** @param {Record<string, unknown>} input */
		createThread(input) {
			return wrap(async () => {
				const created = await inner.createThread(input);
				const [enriched] = await withAuthorDisplayNames(inner, [created]);
				return publicThreadView(enriched);
			});
		},

		/** @param {Record<string, unknown>} input */
		createReply(input) {
			return wrap(async () => {
				const created = await inner.createReply(input);
				const [enriched] = await withAuthorDisplayNames(inner, [created]);
				return publicReplyView(enriched);
			});
		},

		/** @param {{ id: unknown, body: unknown }} input */
		updateThread(input) {
			return wrap(async () => {
				const updated = await inner.updateThread(input);
				const [enriched] = await withAuthorDisplayNames(inner, [updated]);
				return publicThreadView(enriched);
			});
		},

		/** @param {{ id: unknown, body: unknown }} input */
		updateReply(input) {
			return wrap(async () => {
				const updated = await inner.updateReply(input);
				const [enriched] = await withAuthorDisplayNames(inner, [updated]);
				return publicReplyView(enriched);
			});
		},

		/** @param {Record<string, unknown>} input */
		createReport(input) {
			return wrap(() => inner.createReport(input));
		},

		/** @param {{ status?: unknown }} [input] */
		listReports(input = {}) {
			return wrap(() => inner.listReports(input));
		},

		/** @param {string} id @param {'resolved' | 'dismissed'} status */
		setReportStatus(id, status) {
			return wrap(() => inner.setReportStatus(id, status));
		},

		/** @param {string} id */
		getReply(id) {
			return wrap(async () => {
				const reply = await inner.getReply(id);
				if (!reply) return null;
				const [enriched] = await withAuthorDisplayNames(inner, [reply]);
				return publicReplyView(enriched);
			});
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
	try {
		return createCommunityStore(
			createMariToolsRepository({ databaseUrl: readRuntimeEnvironment().databaseUrl })
		);
	} catch (error) {
		if (error instanceof MaritoolsUnavailableError) throw error;
		throw new MaritoolsUnavailableError();
	}
}
