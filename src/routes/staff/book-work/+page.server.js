// @ts-nocheck
import { fail } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';
import { readStaffCatalogueEnvironment } from '$lib/server/config/environment.js';
import {
	BookWorkConflictError,
	BookWorkNotFoundError,
	BookWorkValidationError,
	createBookWorkRepository
} from '$lib/server/books/work-repository.js';
import { guardStaffMutation, StaffActionRequestError } from '$lib/server/staff/request.js';

function failure(error) {
	if (error instanceof BookWorkConflictError) {
		return fail(409, { errorSummary: 'This book work changed. Reload and try again.' });
	}
	if (error instanceof BookWorkNotFoundError) {
		return fail(404, { errorSummary: 'This book is no longer available.' });
	}
	if (error instanceof BookWorkValidationError) {
		return fail(400, { errorSummary: 'Check the copy count and try again.' });
	}
	throw error;
}

/**
 * @param {Record<string, any>} [dependencies]
 */
export function _createBookWorkHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const readEnvironment = dependencies.readEnvironment ?? readStaffCatalogueEnvironment;
	const createRepository = dependencies.createRepository ?? createBookWorkRepository;
	const guardMutation = dependencies.guardMutation ?? guardStaffMutation;

	return {
		async load({ locals }) {
			authorize(locals);
			const runtime = readEnvironment();
			return { board: await createRepository({ databaseUrl: runtime.databaseUrl }).openBoard() };
		},
		actions: {
			async pickup(event) {
				let guarded;
				try {
					guarded = await guardMutation(event, {
						action: 'book_work_pickup',
						fields: ['kind', 'parentId', 'lineId', 'version', 'quantity', 'clientRequestId'],
						route: '/staff/book-work'
					});
				} catch (error) {
					if (error instanceof StaffActionRequestError) {
						return fail(error.status, { errorSummary: 'The pickup could not be verified.' });
					}
					throw error;
				}
				const order = guarded.form.kind === 'order_line';
				try {
					const result = await createRepository({
						databaseUrl: guarded.runtime.databaseUrl
					}).recordPickup({
						ref: order
							? {
									kind: 'order_line',
									orderId: guarded.form.parentId,
									lineId: guarded.form.lineId
								}
							: {
									kind: 'request_item',
									requestId: guarded.form.parentId,
									itemId: guarded.form.lineId
								},
						version: Number(guarded.form.version),
						quantity: Number(guarded.form.quantity),
						clientRequestId: guarded.form.clientRequestId,
						actor: {
							userId: guarded.staff.userId,
							email: guarded.staff.email,
							requestId: guarded.requestId
						}
					});
					return {
						success: true,
						message: result.replayed
							? 'Pickup already recorded.'
							: `${result.remaining} copies remaining.`
					};
				} catch (error) {
					return failure(error);
				}
			},
			async assign(event) {
				let guarded;
				try {
					guarded = await guardMutation(event, {
						action: 'book_request_assign',
						fields: ['requestId', 'bookstoreId', 'version'],
						route: '/staff/book-work'
					});
				} catch (error) {
					if (error instanceof StaffActionRequestError) {
						return fail(error.status, { errorSummary: 'The assignment could not be verified.' });
					}
					throw error;
				}
				try {
					await createRepository({
						databaseUrl: guarded.runtime.databaseUrl
					}).assignRequestBookstore({
						requestId: guarded.form.requestId,
						bookstoreId: guarded.form.bookstoreId,
						version: Number(guarded.form.version),
						actor: {
							userId: guarded.staff.userId,
							email: guarded.staff.email,
							requestId: guarded.requestId
						}
					});
					return { success: true, message: 'Request assigned.' };
				} catch (error) {
					return failure(error);
				}
			}
		}
	};
}

const handlers = _createBookWorkHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
