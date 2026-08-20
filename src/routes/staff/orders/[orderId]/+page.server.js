import { error, fail } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';
import { createStripeClient } from '$lib/server/books/stripe.js';
import {
	readStaffCatalogueEnvironment,
	readStaffOrderCancellationEnvironment
} from '$lib/server/config/environment.js';
import {
	StripeStaffCancellationError,
	expireStaffCheckoutSession
} from '$lib/server/orders/cancellation-provider.js';
import {
	StaffOrderConflictError,
	StaffOrderNotFoundError,
	StaffOrderUnavailableError,
	StaffOrderValidationError,
	createStaffOrderRepository
} from '$lib/server/orders/staff-repository.js';
import { StaffActionRequestError, guardStaffMutation } from '$lib/server/staff/request.js';

const VERSION_PATTERN = /^[1-9]\d{0,8}$/u;

/** @param {unknown} value */
function version(value) {
	return typeof value === 'string' && VERSION_PATTERN.test(value) ? Number(value) : null;
}

/** @param {{ databaseUrl: string, approvedHostnames: readonly string[] }} runtime @param {Function} createRepository */
function openRepository(runtime, createRepository) {
	return createRepository({
		databaseUrl: runtime.databaseUrl,
		approvedHostnames: [...runtime.approvedHostnames]
	});
}

/** @param {StaffActionRequestError} failure */
function requestSummary(failure) {
	if (failure.status === 403) return 'This request could not be verified. Reload and try again.';
	if (failure.status === 429) return 'Too many changes. Wait a moment and try again.';
	if (failure.status === 503) return 'Order changes are unavailable. Try again.';
	return 'Reload this order and try again.';
}

/** @param {unknown} failure */
function orderFailure(failure) {
	if (failure instanceof StaffOrderConflictError) {
		return fail(409, { errorSummary: 'This order changed. Reload it before trying again.' });
	}
	if (failure instanceof StaffOrderNotFoundError) {
		return fail(404, { errorSummary: 'This order is no longer available.' });
	}
	if (failure instanceof StaffOrderValidationError) {
		return fail(400, { errorSummary: 'Reload this order and try again.' });
	}
	if (failure instanceof StaffOrderUnavailableError) {
		return fail(503, { errorSummary: 'Order changes are unavailable. Try again.' });
	}
	throw failure;
}

/** @param {Record<string, any>} [dependencies] */
export function _createStaffOrderDetailHandlers(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const readEnvironment = dependencies.readEnvironment ?? readStaffCatalogueEnvironment;
	const readCancellationEnvironment =
		dependencies.readCancellationEnvironment ?? readStaffOrderCancellationEnvironment;
	const createRepository = dependencies.createRepository ?? createStaffOrderRepository;
	const guardMutation = dependencies.guardMutation ?? guardStaffMutation;
	const createStripe = dependencies.createStripe ?? createStripeClient;
	const expireSession = dependencies.expireSession ?? expireStaffCheckoutSession;

	/** @param {any} event */
	async function load(event) {
		authorize(event.locals);
		let runtime;
		try {
			runtime = readEnvironment();
		} catch {
			return { order: null, unavailable: true };
		}
		try {
			const repository = openRepository(runtime, createRepository);
			return {
				order: await repository.getStaffOrderDetail(event.params.orderId),
				unavailable: false
			};
		} catch (failure) {
			if (
				failure instanceof StaffOrderNotFoundError ||
				failure instanceof StaffOrderValidationError
			) {
				error(404, 'Order not found');
			}
			if (failure instanceof StaffOrderUnavailableError) {
				return { order: null, unavailable: true };
			}
			throw failure;
		}
	}

	/** @param {any} event @param {'advance' | 'cancel'} action */
	async function mutate(event, action) {
		let guarded;
		try {
			guarded = await guardMutation(event, {
				action: action === 'advance' ? 'orders_advance_fulfillment' : 'orders_cancel_unpaid',
				fields: ['version'],
				route: '/staff/orders/[orderId]'
			});
		} catch (failure) {
			if (failure instanceof StaffActionRequestError) {
				return fail(failure.status, { errorSummary: requestSummary(failure) });
			}
			throw failure;
		}

		const expectedVersion = version(guarded.form.version);
		if (expectedVersion === null) {
			return fail(400, { errorSummary: 'Reload this order and try again.' });
		}
		const actor = {
			userId: guarded.staff.userId,
			email: guarded.staff.email,
			requestId: guarded.requestId
		};
		const repository = openRepository(guarded.runtime, createRepository);

		if (action === 'advance') {
			try {
				const result = await repository.advanceFulfillment({
					orderId: event.params.orderId,
					expectedVersion,
					actor
				});
				return {
					success: true,
					message: `Order moved to ${result.fulfillmentStatus.replaceAll('_', ' ')}.`,
					order: result
				};
			} catch (failure) {
				return orderFailure(failure);
			}
		}

		let seed;
		try {
			seed = await repository.loadCancellationSeed({
				orderId: event.params.orderId,
				expectedVersion
			});
		} catch (failure) {
			return orderFailure(failure);
		}

		let evidence;
		try {
			const providerRuntime = readCancellationEnvironment();
			const stripe = createStripe(providerRuntime.stripeSecretKey);
			evidence = await expireSession(stripe, providerRuntime.stripeSecretKey, seed);
		} catch (failure) {
			if (failure instanceof StripeStaffCancellationError) {
				return fail(409, {
					errorSummary:
						'Stripe no longer shows an unpaid checkout. Reload this order before trying again.'
				});
			}
			return fail(503, {
				errorSummary:
					'Stripe could not confirm the cancellation. The order was not changed. Try again.'
			});
		}

		try {
			const result = await repository.cancelOrder({
				orderId: event.params.orderId,
				expectedVersion,
				evidence,
				actor
			});
			return { success: true, message: 'Unpaid order cancelled.', order: result };
		} catch (failure) {
			return orderFailure(failure);
		}
	}

	return Object.freeze({
		load,
		actions: Object.freeze({
			advance: (/** @type {any} */ event) => mutate(event, 'advance'),
			cancel: (/** @type {any} */ event) => mutate(event, 'cancel')
		})
	});
}

const handlers = _createStaffOrderDetailHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
