/**
 * Staff-facing forum report queue rows.
 * @typedef {{
 *   id: string,
 *   targetKind: string,
 *   targetId: string,
 *   threadId: string | null,
 *   reporterUserId: string,
 *   reason: string,
 *   status: string,
 *   resolvedAt: string | null,
 *   createdAt: string,
 *   href: string | null
 * }} StaffReportQueueItem
 */

/** @param {unknown} value */
function toIso(value) {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'string' && value) return new Date(value).toISOString();
	return String(value ?? '');
}

/**
 * @param {Iterable<Record<string, any>>} reports
 * @param {(id: string) => Promise<{ threadId?: string | null } | null>} getReply
 * @returns {Promise<StaffReportQueueItem[]>}
 */
export async function buildStaffReportQueue(reports, getReply) {
	const rows = Array.from(reports);
	return Promise.all(
		rows.map(async (report) => {
			let threadId = report.targetKind === 'thread' ? report.targetId : null;
			if (report.targetKind === 'reply') {
				const reply = await getReply(report.targetId);
				threadId = reply?.threadId ?? null;
			}
			return Object.freeze({
				id: report.id,
				targetKind: report.targetKind,
				targetId: report.targetId,
				threadId,
				reporterUserId: report.reporterUserId,
				reason: report.reason,
				status: report.status,
				resolvedAt: report.resolvedAt ? toIso(report.resolvedAt) : null,
				createdAt: toIso(report.createdAt),
				href: threadId ? `/tools/forum/${threadId}` : null
			});
		})
	);
}
