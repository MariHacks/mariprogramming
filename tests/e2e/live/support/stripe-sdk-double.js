import { createHash } from 'node:crypto';

const sessions = new Map();

/** @param {unknown} value */
function totalLineItems(value) {
	if (!Array.isArray(value)) return 0;
	return value.reduce((total, line) => total + line.price_data.unit_amount * line.quantity, 0);
}

/** @param {string} idempotencyKey */
function sessionId(idempotencyKey) {
	return `cs_test_${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32)}`;
}

export default class Stripe {
	constructor() {
		this.checkout = {
			sessions: {
				create: async (payload, options = {}) => {
					const id = sessionId(options.idempotencyKey ?? JSON.stringify(payload));
					const existing = sessions.get(id);
					if (existing) return structuredClone(existing);
					const created = Math.floor(Date.now() / 1000);
					const session = {
						object: 'checkout.session',
						id,
						livemode: false,
						mode: payload.mode,
						ui_mode: 'hosted_page',
						status: 'open',
						payment_status: 'unpaid',
						currency: 'cad',
						amount_total: totalLineItems(payload.line_items),
						client_reference_id: payload.client_reference_id,
						metadata: payload.metadata,
						customer_email: payload.customer_email,
						payment_method_types: payload.payment_method_types,
						success_url: payload.success_url,
						cancel_url: payload.cancel_url,
						created,
						expires_at: created + 60 * 60,
						payment_intent: null,
						url: `https://checkout.mariprogramming.dev/session/${id}`
					};
					sessions.set(id, session);
					return structuredClone(session);
				},
				retrieve: async (id) => {
					const session = sessions.get(id);
					if (!session) throw new Error('Unknown local checkout session');
					return structuredClone(session);
				}
			}
		};
	}
}
