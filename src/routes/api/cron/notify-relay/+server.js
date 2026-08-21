// @ts-nocheck
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { readNotificationRelayEnvironment } from '$lib/server/config/environment.js';
import { createDiscordSink } from '$lib/server/notify/discord.js';
import { createPostmarkSink } from '$lib/server/notify/postmark.js';
import { createNotificationRelay } from '$lib/server/notify/relay.js';

/**
 * @param {Record<string, any>} [dependencies]
 */
export function _createNotifyRelayCronEndpoint(dependencies = {}) {
	const readEnvironment =
		dependencies.readEnvironment ?? (() => readNotificationRelayEnvironment(env));
	const createSink = dependencies.createDiscordSink ?? createDiscordSink;
	const createEmailSink = dependencies.createPostmarkSink ?? createPostmarkSink;
	const createRelay = dependencies.createNotificationRelay ?? createNotificationRelay;

	return async function GET({ request }) {
		let runtime;
		try {
			runtime = readEnvironment();
		} catch {
			return json({ error: 'Scheduled work is unavailable' }, { status: 503 });
		}
		if (request.headers.get('authorization') !== `Bearer ${runtime.cronSecret}`) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const sink = runtime.discordWebhookUrl
			? createSink({
					webhookUrl: runtime.discordWebhookUrl,
					appOrigin: runtime.appOrigin
				})
			: null;
		try {
			const summary = await createRelay({ databaseUrl: runtime.databaseUrl, sink }).drain({
				limit: 50,
				budgetMs: 8000
			});
			if (runtime.postmarkServerToken) {
				const emailSink = createEmailSink({
					serverToken: runtime.postmarkServerToken,
					appOrigin: runtime.appOrigin,
					capabilityKey: runtime.bookCheckoutCapabilityKey
				});
				await createRelay({
					databaseUrl: runtime.databaseUrl,
					sink: emailSink,
					sinkName: 'postmark',
					actions: ['stripe_completed_applied']
				}).drain({ limit: 50, budgetMs: 8000 });
			}
			return json(summary);
		} catch {
			return json({ error: 'Scheduled work is unavailable' }, { status: 503 });
		}
	};
}

export const GET = _createNotifyRelayCronEndpoint();
