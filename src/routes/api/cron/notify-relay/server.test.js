// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/server/config/environment.js', () => ({
	readNotificationRelayEnvironment: vi.fn()
}));
vi.mock('$lib/server/notify/discord.js', () => ({
	createDiscordSink: vi.fn(() => ({ deliver: vi.fn() }))
}));
vi.mock('$lib/server/notify/relay.js', () => ({
	createNotificationRelay: vi.fn()
}));

import { readNotificationRelayEnvironment } from '$lib/server/config/environment.js';
import { createNotificationRelay } from '$lib/server/notify/relay.js';
import { GET } from './+server.js';

const RUNTIME = Object.freeze({
	appOrigin: 'https://club.example.com',
	databaseUrl: 'postgresql://runtime:password@db.example.com/books',
	cronSecret: 'cron-secret-with-at-least-32-characters',
	discordWebhookUrl: null
});

describe('notify relay cron', () => {
	it('drains pending club events when authorized', async () => {
		vi.mocked(readNotificationRelayEnvironment).mockReturnValue(RUNTIME);
		const drain = vi.fn(async () =>
			Object.freeze({ enrolled: 1, attempted: 1, delivered: 1, retrying: 0, dead: 0, skipped: 0 })
		);
		vi.mocked(createNotificationRelay).mockReturnValue({ drain });
		const response = await GET(/** @type {any} */ ({
			request: new Request('https://club.example.com/api/cron/notify-relay', {
				headers: { authorization: `Bearer ${RUNTIME.cronSecret}` }
			})
		}));
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ delivered: 1 });
		expect(drain).toHaveBeenCalledOnce();
	});

	it('rejects a missing bearer secret', async () => {
		vi.mocked(readNotificationRelayEnvironment).mockReturnValue(RUNTIME);
		const response = await GET(/** @type {any} */ ({
			request: new Request('https://club.example.com/api/cron/notify-relay')
		}));
		expect(response.status).toBe(401);
	});

	it('returns 503 when the relay environment cannot be read', async () => {
		vi.mocked(readNotificationRelayEnvironment).mockImplementation(() => {
			throw new Error('missing cron secret');
		});
		const response = await GET(/** @type {any} */ ({
			request: new Request('https://club.example.com/api/cron/notify-relay', {
				headers: { authorization: `Bearer ${RUNTIME.cronSecret}` }
			})
		}));
		expect(response.status).toBe(503);
	});

	it('returns 503 when drain fails after authorization', async () => {
		vi.mocked(readNotificationRelayEnvironment).mockReturnValue(RUNTIME);
		vi.mocked(createNotificationRelay).mockReturnValue({
			drain: vi.fn(async () => {
				throw new Error('database down');
			})
		});
		const response = await GET(/** @type {any} */ ({
			request: new Request('https://club.example.com/api/cron/notify-relay', {
				headers: { authorization: `Bearer ${RUNTIME.cronSecret}` }
			})
		}));
		expect(response.status).toBe(503);
	});

	it('builds a Discord sink when a webhook is configured', async () => {
		const { createDiscordSink } = await import('$lib/server/notify/discord.js');
		vi.mocked(readNotificationRelayEnvironment).mockReturnValue({
			...RUNTIME,
			discordWebhookUrl:
				'https://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests'
		});
		vi.mocked(createNotificationRelay).mockReturnValue({
			drain: vi.fn(async () => ({
				enrolled: 0,
				attempted: 0,
				delivered: 0,
				retrying: 0,
				dead: 0,
				skipped: 0
			}))
		});
		const response = await GET(/** @type {any} */ ({
			request: new Request('https://club.example.com/api/cron/notify-relay', {
				headers: { authorization: `Bearer ${RUNTIME.cronSecret}` }
			})
		}));
		expect(response.status).toBe(200);
		expect(createDiscordSink).toHaveBeenCalledOnce();
	});
});
