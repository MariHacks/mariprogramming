export const ANNOUNCED_ACTIONS = Object.freeze([
	'stripe_completed_applied',
	'staff_fulfillment_purchasing',
	'staff_fulfillment_received',
	'staff_fulfillment_ready_for_pickup',
	'book_request_submitted',
	'book_pickup_recorded',
	'book_request_assigned'
]);

/** @param {any} source */
export function parseClubFact(source) {
	const state =
		source?.nextState && typeof source.nextState === 'object' && !Array.isArray(source.nextState)
			? source.nextState
			: {};
	if (source.action === 'stripe_completed_applied') {
		return Object.freeze({
			kind: 'order_paid',
			reference: source.orderReference,
			count: Number(source.orderBookCount ?? 0),
			titles: Object.freeze(source.orderTitles ?? []),
			bookstores: Object.freeze(source.orderBookstores ?? [])
		});
	}
	if (source.action?.startsWith('staff_fulfillment_')) {
		return Object.freeze({
			kind: 'fulfillment_advanced',
			reference: source.orderReference,
			to: source.action.slice('staff_fulfillment_'.length),
			count: Number(source.orderBookCount ?? 0),
			titles: Object.freeze(source.orderTitles ?? []),
			bookstores: Object.freeze(source.orderBookstores ?? [])
		});
	}
	if (source.action === 'book_request_submitted') {
		return Object.freeze({
			kind: 'book_request_submitted',
			reference: source.requestReference,
			count: Number(state.bookCount ?? source.requestTitles?.length ?? 0),
			titles: Object.freeze(source.requestTitles ?? []),
			teacher: state.teacherLabel ?? source.requestTeacher ?? null,
			course: state.courseLabel ?? source.requestCourse ?? null,
			bookstores: Object.freeze([])
		});
	}
	if (source.action === 'book_pickup_recorded') {
		return Object.freeze({
			kind: 'book_picked_up',
			reference: source.orderReference ?? source.requestReference,
			count: Number(state.quantity ?? 0),
			titles: Object.freeze(source.titles ?? []),
			bookstores: Object.freeze(source.bookstores ?? [])
		});
	}
	if (source.action === 'book_request_assigned') {
		return Object.freeze({
			kind: 'book_request_assigned',
			reference: source.requestReference,
			count: source.requestTitles?.length ?? 0,
			titles: Object.freeze(source.requestTitles ?? []),
			bookstores: Object.freeze(source.requestBookstore ? [source.requestBookstore] : [])
		});
	}
	return null;
}
