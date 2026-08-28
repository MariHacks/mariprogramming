import { requireStaff } from '$lib/server/auth/authorization.js';
import {
	MaritoolsUnavailableError,
	openCommunityStore
} from '$lib/server/maritools/community-store.js';
import { buildStaffReportQueue } from '$lib/server/maritools/staff-reports.js';

export const prerender = false;

const STATUS_FILTERS = new Set(['open', 'resolved', 'dismissed', 'all']);

/** @param {URL} url */
function statusFilterFrom(url) {
	const raw = url.searchParams.get('status');
	if (!raw || !STATUS_FILTERS.has(raw)) return 'open';
	return raw;
}

/** @param {Record<string, any>} [dependencies] */
export function _createStaffReportsHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const createStore = dependencies.createStore ?? openCommunityStore;

	return Object.freeze({
		/** @param {any} event */
		async load(event) {
			authorize(event.locals);
			const statusFilter = statusFilterFrom(event.url);
			try {
				const store = createStore();
				const rows = await store.listReports(
					statusFilter === 'all' ? {} : { status: statusFilter }
				);
				const reports = await buildStaffReportQueue(rows, (id) => store.getReply(id));
				return { reports, statusFilter, unavailable: false };
			} catch (error) {
				if (error instanceof MaritoolsUnavailableError) {
					return { reports: [], statusFilter, unavailable: true };
				}
				throw error;
			}
		}
	});
}

const handlers = _createStaffReportsHandlers();
export const load = handlers.load;
