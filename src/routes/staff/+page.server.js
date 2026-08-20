import { error, fail } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';
import { readStaffCatalogueEnvironment } from '$lib/server/config/environment.js';
import {
	StaffOrderUnavailableError,
	StaffOrderValidationError,
	createStaffOrderRepository
} from '$lib/server/orders/staff-repository.js';
import { StaffActionRequestError, guardStaffMutation } from '$lib/server/staff/request.js';

function emptyListing() {
	return {
		orders: [],
		totalCount: 0,
		page: 1,
		pageSize: 25,
		hasPrevious: false,
		hasNext: false,
		filters: { payment: 'actionable', fulfillment: 'all' }
	};
}

/** @param {StaffActionRequestError} failure */
function requestSummary(failure) {
	if (failure.status === 403) return 'This request could not be verified. Reload and try again.';
	if (failure.status === 413) return 'This search is too large. Shorten it and try again.';
	if (failure.status === 415) return 'This form could not be read. Reload and try again.';
	if (failure.status === 429) return 'Too many searches. Wait a moment and try again.';
	if (failure.status === 503) return 'Order search is unavailable. Try again.';
	return 'Check the search and try again.';
}

/** @param {{ databaseUrl: string, approvedHostnames: readonly string[] }} runtime @param {Function} createRepository */
function openRepository(runtime, createRepository) {
	return createRepository({
		databaseUrl: runtime.databaseUrl,
		approvedHostnames: [...runtime.approvedHostnames]
	});
}

/** @param {Record<string, any>} [dependencies] */
export function _createStaffOrderLedgerHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const readEnvironment = dependencies.readEnvironment ?? readStaffCatalogueEnvironment;
	const createRepository = dependencies.createRepository ?? createStaffOrderRepository;
	const guardMutation = dependencies.guardMutation ?? guardStaffMutation;

	/** @param {any} event */
	async function load(event) {
		authorize(event.locals);
		let runtime;
		try {
			runtime = readEnvironment();
		} catch {
			return { listing: emptyListing(), unavailable: true };
		}
		try {
			const repository = openRepository(runtime, createRepository);
			const listing = await repository.listStaffOrders({
				payment: event.url.searchParams.get('payment') ?? '',
				fulfillment: event.url.searchParams.get('fulfillment') ?? '',
				page: event.url.searchParams.get('page') ?? ''
			});
			return { listing, unavailable: false };
		} catch (failure) {
			if (failure instanceof StaffOrderUnavailableError) {
				return { listing: emptyListing(), unavailable: true };
			}
			if (failure instanceof StaffOrderValidationError) error(400, 'Order filters are invalid');
			throw failure;
		}
	}

	/** @param {any} event */
	async function search(event) {
		let guarded;
		try {
			guarded = await guardMutation(event, {
				action: 'orders_search',
				fields: ['query', 'page'],
				route: '/staff'
			});
		} catch (failure) {
			if (failure instanceof StaffActionRequestError) {
				return fail(failure.status, { errorSummary: requestSummary(failure) });
			}
			throw failure;
		}
		try {
			const repository = openRepository(guarded.runtime, createRepository);
			const result = await repository.searchStaffOrders(guarded.form.query, guarded.form.page);
			return { success: true, search: result };
		} catch (failure) {
			if (failure instanceof StaffOrderValidationError) {
				return fail(400, {
					errorSummary: 'Enter a complete order reference or email address.'
				});
			}
			if (failure instanceof StaffOrderUnavailableError) {
				return fail(503, { errorSummary: 'Order search is unavailable. Try again.' });
			}
			throw failure;
		}
	}

	return Object.freeze({ load, actions: Object.freeze({ search }) });
}

const handlers = _createStaffOrderLedgerHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
