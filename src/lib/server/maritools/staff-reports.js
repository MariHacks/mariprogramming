/**
 * Staff-facing forum report queue rows with human labels and subject author.
 * @typedef {{
 *   id: string,
 *   targetKind: string,
 *   targetId: string,
 *   threadId: string | null,
 *   targetTitle: string,
 *   reporterUserId: string,
 *   reporterDisplayName: string,
 *   subjectUserId: string | null,
 *   subjectDisplayName: string | null,
 *   reason: string,
 *   status: string,
 *   resolvedAt: string | null,
 *   createdAt: string,
 *   href: string | null,
 *   subjectProfileHref: string | null,
 *   reporterProfileHref: string
 * }} StaffReportQueueItem
 */

/** @param {unknown} value */
function toIso(value) {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'string' && value) return new Date(value).toISOString();
	return String(value ?? '');
}

/** @param {unknown} name @param {string} fallback */
function displayLabel(name, fallback) {
	const trimmed = typeof name === 'string' ? name.trim() : '';
	return trimmed || fallback;
}

/**
 * @param {Iterable<Record<string, any>>} reports
 * @param {{
 *   getReply: (id: string) => Promise<{ threadId?: string | null, authorUserId?: string | null, authorDisplayName?: string | null } | null>,
 *   getThread: (id: string) => Promise<{ title?: string | null, authorUserId?: string | null, authorDisplayName?: string | null } | null>,
 *   getProfile: (id: string) => Promise<{ displayName?: string | null } | null>
 * }} deps
 * @returns {Promise<StaffReportQueueItem[]>}
 */
export async function buildStaffReportQueue(reports, deps) {
	const getReply = typeof deps === 'function' ? deps : deps.getReply;
	const getThread = typeof deps === 'function' ? async () => null : deps.getThread;
	const getProfile = typeof deps === 'function' ? async () => null : deps.getProfile;

	const rows = Array.from(reports);
	return Promise.all(
		rows.map(async (report) => {
			let threadId = report.targetKind === 'thread' ? report.targetId : null;
			/** @type {string | null} */
			let subjectUserId = null;
			/** @type {string | null} */
			let subjectDisplayName = null;
			let targetTitle = report.targetKind === 'reply' ? 'Reply' : 'Thread';

			if (report.targetKind === 'reply') {
				const reply = await getReply(report.targetId);
				threadId = reply?.threadId ?? null;
				subjectUserId = reply?.authorUserId ?? null;
				subjectDisplayName = displayLabel(reply?.authorDisplayName, 'Student');
				if (threadId) {
					const thread = await getThread(threadId);
					if (thread?.title) targetTitle = `Reply in “${thread.title}”`;
				}
			} else if (threadId) {
				const thread = await getThread(threadId);
				if (thread) {
					targetTitle = thread.title ? String(thread.title) : 'Thread';
					subjectUserId = thread.authorUserId ?? null;
					subjectDisplayName = displayLabel(thread.authorDisplayName, 'Student');
				}
			}

			const reporterProfile = await getProfile(report.reporterUserId);
			const reporterDisplayName = displayLabel(reporterProfile?.displayName, 'Student');

			return Object.freeze({
				id: report.id,
				targetKind: report.targetKind,
				targetId: report.targetId,
				threadId,
				targetTitle,
				reporterUserId: report.reporterUserId,
				reporterDisplayName,
				subjectUserId,
				subjectDisplayName,
				reason: report.reason,
				status: report.status,
				resolvedAt: report.resolvedAt ? toIso(report.resolvedAt) : null,
				createdAt: toIso(report.createdAt),
				href: threadId ? `/tools/forum/${threadId}` : null,
				subjectProfileHref: subjectUserId ? `/tools/people/${subjectUserId}` : null,
				reporterProfileHref: `/tools/people/${report.reporterUserId}`
			});
		})
	);
}
