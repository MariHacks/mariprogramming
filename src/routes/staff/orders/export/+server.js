import { error } from '@sveltejs/kit';
import { CsvExportError, createBookstorePurchaseCsv } from '$lib/server/csv.js';
import {
	StaffOrderUnavailableError,
	createStaffOrderRepository
} from '$lib/server/orders/staff-repository.js';
import { StaffActionRequestError, guardStaffMutation } from '$lib/server/staff/request.js';

/** @param {Record<string, any>} [dependencies] */
export function _createStaffPurchaseExportHandler(dependencies = {}) {
	const guardMutation = dependencies.guardMutation ?? guardStaffMutation;
	const createRepository = dependencies.createRepository ?? createStaffOrderRepository;
	const buildCsv = dependencies.buildCsv ?? createBookstorePurchaseCsv;

	/** @param {any} event */
	return async function POST(event) {
		let guarded;
		try {
			guarded = await guardMutation(event, {
				action: 'orders_export_purchase_list',
				fields: ['intent'],
				route: '/staff/orders/export'
			});
		} catch (failure) {
			if (failure instanceof StaffActionRequestError) {
				error(failure.status, 'Purchase export request failed');
			}
			throw failure;
		}

		if (guarded.form.intent !== 'purchase_list') {
			error(400, 'Purchase export request failed');
		}

		const repository = createRepository({
			databaseUrl: guarded.runtime.databaseUrl,
			approvedHostnames: [...guarded.runtime.approvedHostnames]
		});
		let body;
		try {
			body = buildCsv(await repository.listBookstorePurchaseRows());
		} catch (failure) {
			if (failure instanceof StaffOrderUnavailableError || failure instanceof CsvExportError) {
				error(503, 'Purchase export is unavailable');
			}
			throw failure;
		}

		return new Response(body, {
			status: 200,
			headers: {
				'cache-control': 'no-store',
				'content-disposition': 'attachment; filename="bookstore-purchase-list.csv"',
				'content-type': 'text/csv; charset=utf-8',
				'x-content-type-options': 'nosniff'
			}
		});
	};
}

export const POST = _createStaffPurchaseExportHandler();
