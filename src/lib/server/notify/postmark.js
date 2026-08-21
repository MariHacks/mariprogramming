import { createConfirmationCapability } from '../orders/request.js';

const POSTMARK_EMAIL_ENDPOINT = 'https://api.postmarkapp.com/email';
const REQUEST_TIMEOUT_MS = 4000;

/** @param {string} value */
function escapeHtml(value) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/** @param {number} cents */
function formatCad(cents) {
	return `$${(cents / 100).toFixed(2)} CAD`;
}

/** @param {any} order */
export function buildOrderConfirmationEmail(order) {
	const reference = String(order.reference);
	const recipient = String(order.recipient);
	const trackingUrl = String(order.trackingUrl);
	const total = formatCad(Number(order.totalCents));
	const titles = /** @type {unknown[]} */ (order.titles).map((title) => String(title));
	const textTitles = titles.map((title, index) => `${index + 1}. ${title}`).join('\n');
	const htmlTitles = titles.map((title) => `<li>${escapeHtml(title)}</li>`).join('');

	return Object.freeze({
		From: 'Marianopolis Programming Club <orders@marihacks.com>',
		To: recipient,
		ReplyTo: 'team@marihacks.com',
		Subject: `Your book order ${reference}`,
		TextBody: [
			'Your payment went through.',
			'',
			`Order reference: ${reference}`,
			`Total paid: ${total}`,
			'',
			'Books:',
			textTitles,
			'',
			'Check your order status:',
			trackingUrl,
			'',
			'Questions? Reply to this email and the club team will get back to you.'
		].join('\n'),
		HtmlBody: `<p>Your payment went through.</p><p><strong>Order reference:</strong> ${escapeHtml(reference)}<br><strong>Total paid:</strong> ${escapeHtml(total)}</p><p><strong>Books:</strong></p><ol>${htmlTitles}</ol><p><a href="${escapeHtml(trackingUrl)}">Check your order status</a></p><p>Questions? Reply to this email and the club team will get back to you.</p>`,
		MessageStream: 'outbound',
		TrackLinks: 'None'
	});
}

/**
 * @param {{ serverToken: string, appOrigin?: string, capabilityKey?: string, fetchImpl?: typeof fetch }} configuration
 */
export function createPostmarkSink({ serverToken, appOrigin, capabilityKey, fetchImpl = fetch }) {
	return Object.freeze({
		name: 'postmark',
		/** @param {any} order */
		async deliver(order) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
			try {
				const trackingUrl =
					order.trackingUrl ??
					`${appOrigin}/books/order-confirmation/${order.reference}/access#${createConfirmationCapability({ capabilityKey, orderId: order.orderId, attemptId: order.attemptId })}`;
				const response = await fetchImpl(POSTMARK_EMAIL_ENDPOINT, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						accept: 'application/json',
						'X-Postmark-Server-Token': serverToken
					},
					body: JSON.stringify(buildOrderConfirmationEmail({ ...order, trackingUrl })),
					signal: controller.signal
				});
				if (response.ok) return Object.freeze({ disposition: 'delivered' });
				if (response.status === 429) {
					return Object.freeze({ disposition: 'retry', afterSeconds: 30, reason: 'rate_limited' });
				}
				if (response.status >= 500) {
					return Object.freeze({ disposition: 'retry', afterSeconds: 0, reason: 'server_error' });
				}
				return Object.freeze({
					disposition: 'dead',
					reason: [401, 403].includes(response.status) ? 'credential_rejected' : 'payload_rejected'
				});
			} catch {
				return Object.freeze({ disposition: 'retry', afterSeconds: 0, reason: 'network_error' });
			} /* v8 ignore next -- V8 treats the always-run finally keyword as a branch. */ finally {
				clearTimeout(timeout);
			}
		}
	});
}
