// @ts-nocheck
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { readNotificationRelayEnvironment } from '$lib/server/config/environment.js';
import { createDiscordSink } from '$lib/server/notify/discord.js';
import { createNotificationRelay } from '$lib/server/notify/relay.js';

/**
 * @param {Record<string, any>} [dependencies]
 */
export function _createNotifyRelayCronEndpoint(dependencies = {}) {
	const readEnvironment =
		dependencies.readEnvironment ?? (() => readNotificationRelayEnvironment(env));
	const createSink = dependencies.createDiscordSink ?? createDiscordSink;
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
			return json(
				await createRelay({ databaseUrl: runtime.databaseUrl, sink }).drain({
					limit: 50,
					budgetMs: 8000
				})
			);
		} catch {
			return json({ error: 'Scheduled work is unavailable' }, { status: 503 });
		}
	};
}

export const GET = _createNotifyRelayCronEndpoint();
