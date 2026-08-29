import { fail } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';
import {
	MaritoolsInputError,
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

/**
 * @param {any} event
 * @param {'resolved' | 'dismissed'} status
 * @param {{ authorize: Function, createStore: Function }} deps
 */
async function setStatus(event, status, deps) {
	deps.authorize(event.locals);
	const data = await event.request.formData();
	const reportId = String(data.get('reportId') ?? '').trim();
	if (!reportId) return fail(400, { error: 'Pick a report first.' });
	try {
		await deps.createStore().setReportStatus(reportId, status);
		return { updated: true, status };
	} catch (error) {
		if (error instanceof MaritoolsInputError) {
			return fail(400, { error: 'Could not update that report.' });
		}
		if (error instanceof MaritoolsUnavailableError) {
			return fail(503, { error: 'Report updates are unavailable. Try again.' });
		}
		throw error;
	}
}

/** @param {Record<string, any>} [dependencies] */
export function _createStaffReportsHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const createStore = dependencies.createStore ?? openCommunityStore;
	const deps = { authorize, createStore };

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
		},
		actions: Object.freeze({
			/** @param {any} event */
			resolve: (event) => setStatus(event, 'resolved', deps),
			/** @param {any} event */
			dismiss: (event) => setStatus(event, 'dismissed', deps)
		})
	});
}

const handlers = _createStaffReportsHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
