// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import config from '../../svelte.config.js';

describe('production security configuration', () => {
	it('uses SvelteKit as the single CSP owner with only required sources', () => {
		expect(config.kit.csp).toEqual({
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'base-uri': ['none'],
				'object-src': ['none'],
				'script-src': ['self'],
				'style-src': ['self'],
				'style-src-attr': ['unsafe-hashes', 'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo='],
				'font-src': ['self'],
				'img-src': ['self', 'data:', 'https:'],
				'connect-src': ['self'],
				'form-action': ['self'],
				'frame-src': ['self', 'https://www.google.com'],
				'frame-ancestors': ['none'],
				'manifest-src': ['self'],
				'worker-src': ['self'],
				'upgrade-insecure-requests': true
			}
		});
		expect(config.kit.csp.directives['script-src']).not.toContain('unsafe-eval');
		expect(config.kit.csp.directives['style-src']).not.toContain('unsafe-inline');
		expect(config.kit.csp.directives['style-src-attr']).not.toContain('unsafe-inline');
	});

	it('keeps non-CSP platform headers and the bounded cron schedule in vercel.json', async () => {
		const vercel =
			/** @type {{ crons: Array<Record<string, string>>, headers: Array<{ headers: Array<{ key: string, value: string }> }> }} */ (
				JSON.parse(await readFile('vercel.json', 'utf8'))
			);
		expect(vercel.crons).toEqual([
			{ path: '/api/cron/book-delivery', schedule: '17 3 * * *' },
			{ path: '/api/cron/notify-relay', schedule: '*/5 * * * *' }
		]);
		const headers = Object.fromEntries(
			vercel.headers[0].headers.map(({ key, value }) => [key.toLowerCase(), value])
		);
		expect(headers).toMatchObject({
			'x-content-type-options': 'nosniff',
			'x-frame-options': 'DENY',
			'referrer-policy': 'strict-origin-when-cross-origin',
			'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
			'strict-transport-security': 'max-age=31536000'
		});
		expect(headers).not.toHaveProperty('content-security-policy');
	});

	it('disallows indexing private and capability-bearing routes', async () => {
		const robots = await readFile('static/robots.txt', 'utf8');
		expect(robots).toBe(
			[
				'User-agent: *',
				'Allow: /',
				'Disallow: /api/',
				'Disallow: /staff/',
				'Disallow: /books/cart',
				'Disallow: /books/checkout',
				'Disallow: /books/order-confirmation',
				''
			].join('\n')
		);
	});
});
