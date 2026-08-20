// @ts-nocheck
const REQUEST_TIMEOUT_MS = 4000;

/** @param {string} value */
function clean(value) {
	return value.replaceAll('`', '').replaceAll('@', '').slice(0, 1000);
}

/** @param {any} fact @param {string} appOrigin */
function payload(fact, appOrigin) {
	const fields = [
		{ name: 'Reference', value: clean(String(fact.reference ?? 'Unknown')), inline: true },
		{ name: 'Copies', value: String(fact.count ?? 0), inline: true }
	];
	if (fact.titles?.length) fields.push({ name: 'Books', value: clean(fact.titles.join('\n')) });
	if (fact.teacher) fields.push({ name: 'Teacher', value: clean(String(fact.teacher)), inline: true });
	if (fact.course) fields.push({ name: 'Course', value: clean(String(fact.course)), inline: true });
	if (fact.bookstores?.length) {
		fields.push({ name: 'Bookstores', value: clean(fact.bookstores.join('\n')) });
	}
	return {
		allowed_mentions: { parse: [] },
		embeds: [
			{
				title: clean(fact.kind.replaceAll('_', ' ')),
				url: `${appOrigin}/staff/book-work`,
				color: 0xdf5b48,
				fields
			}
		]
	};
}

/**
 * @param {{ webhookUrl: string, appOrigin: string, fetchImpl?: typeof fetch }} configuration
 */
export function createDiscordSink({ webhookUrl, appOrigin, fetchImpl = fetch }) {
	return Object.freeze({
		name: 'discord',
		async deliver(fact) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
			try {
				const response = await fetchImpl(webhookUrl, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload(fact, appOrigin)),
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
			} finally {
				clearTimeout(timeout);
			}
		}
	});
}
