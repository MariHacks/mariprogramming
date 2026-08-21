// @ts-nocheck
const REQUEST_TIMEOUT_MS = 4000;
const KIND_COPY = Object.freeze({
	order_paid: Object.freeze({
		title: 'Order paid',
		description: 'Stripe marked this order paid. Buy the listed titles next.',
		color: 0x2f6f4e
	}),
	fulfillment_advanced: Object.freeze({
		title: 'Fulfillment updated',
		color: 0xc48a2a
	}),
	book_request_submitted: Object.freeze({
		title: 'Book request received',
		description: 'A student asked for titles that are not in the catalogue yet.',
		color: 0xdf5b48
	}),
	book_picked_up: Object.freeze({
		title: 'Pickup recorded',
		color: 0x6b5a3a
	}),
	book_request_assigned: Object.freeze({
		title: 'Request assigned',
		description: 'Staff assigned this request to a bookstore.',
		color: 0x3d6b99
	})
});

/** @param {string} value */
function clean(value) {
	return value.replaceAll('`', '').replaceAll('@', '').slice(0, 1000);
}

/** @param {number} count */
function copiesLabel(count) {
	return count === 1 ? '1 copy' : `${count} copies`;
}

/** @param {unknown} value */
function numberedTitles(value) {
	if (!Array.isArray(value) || value.length === 0) return '';
	return value.map((title, index) => `${index + 1}. ${clean(String(title))}`).join('\n');
}

/** @param {any} fact */
function descriptionFor(fact) {
	if (fact.kind === 'fulfillment_advanced') {
		return `Status is now ${clean(String(fact.to).replaceAll('_', ' '))}.`;
	}
	if (fact.kind === 'book_picked_up') {
		const recorded = copiesLabel(Number(fact.count ?? 0));
		if (Number.isFinite(Number(fact.remaining)) && Number(fact.remaining) > 0) {
			return `Recorded ${recorded}. ${copiesLabel(Number(fact.remaining))} still outstanding.`;
		}
		return `Recorded ${recorded}.`;
	}
	return KIND_COPY[fact.kind].description;
}

/** @param {any} fact @param {string} appOrigin @param {Date} now */
export function buildDiscordPayload(fact, appOrigin, now) {
	const copy = KIND_COPY[fact.kind];
	const fields = [
		{ name: 'Reference', value: `\`${clean(String(fact.reference ?? 'Unknown'))}\``, inline: true },
		{ name: 'Copies', value: copiesLabel(Number(fact.count ?? 0)), inline: true }
	];
	if (Number.isFinite(Number(fact.remaining)) && Number(fact.remaining) > 0) {
		fields.push({
			name: 'Still outstanding',
			value: copiesLabel(Number(fact.remaining)),
			inline: true
		});
	}
	if (fact.teacher)
		fields.push({ name: 'Teacher', value: clean(String(fact.teacher)), inline: true });
	if (fact.course) fields.push({ name: 'Course', value: clean(String(fact.course)), inline: true });
	const titles = numberedTitles(fact.titles);
	if (titles) fields.push({ name: 'Titles', value: titles });
	if (fact.bookstores?.length) {
		fields.push({ name: 'Bookstores', value: clean(fact.bookstores.join('\n')) });
	}
	return {
		allowed_mentions: { parse: [] },
		embeds: [
			{
				title: copy.title,
				description: descriptionFor(fact),
				url: `${appOrigin}/staff/book-work`,
				color: copy.color,
				timestamp: now.toISOString(),
				footer: { text: 'Open staff book work · no student names or emails' },
				fields
			}
		]
	};
}

/**
 * @param {{ webhookUrl: string, appOrigin: string, fetchImpl?: typeof fetch, getNow?: () => Date }} configuration
 */
export function createDiscordSink({
	webhookUrl,
	appOrigin,
	fetchImpl = fetch,
	getNow = () => new Date()
}) {
	return Object.freeze({
		name: 'discord',
		async deliver(fact) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
			try {
				const response = await fetchImpl(webhookUrl, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(buildDiscordPayload(fact, appOrigin, getNow())),
					signal: controller.signal
				});
				if (response.ok) return Object.freeze({ disposition: 'delivered' });
				if (response.status === 429) {
					let afterSeconds = 1;
					try {
						const body = await response.json();
						const retryAfter = Number(body.retry_after);
						afterSeconds = Number.isFinite(retryAfter)
							? Math.min(900, Math.max(1, Math.ceil(retryAfter)))
							: 30;
					} catch {
						afterSeconds = 30;
					}
					return Object.freeze({ disposition: 'retry', afterSeconds, reason: 'rate_limited' });
				}
				if (response.status >= 500) {
					return Object.freeze({ disposition: 'retry', afterSeconds: 0, reason: 'server_error' });
				}
				return Object.freeze({
					disposition: 'dead',
					reason: [401, 403, 404].includes(response.status)
						? 'webhook_rejected'
						: 'payload_rejected'
				});
			} catch {
				return Object.freeze({ disposition: 'retry', afterSeconds: 0, reason: 'network_error' });
			} /* v8 ignore next -- V8 treats the always-run finally keyword as a branch. */ finally {
				clearTimeout(timeout);
			}
		}
	});
}
