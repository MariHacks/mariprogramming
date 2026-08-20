// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { parseClubFact } from './facts.js';
import { createDiscordSink } from './discord.js';

const WEBHOOK_URL =
	'https://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests';

describe('club facts', () => {
	it('parses a book request without student identity', () => {
		const fact = parseClubFact({
			action: 'book_request_submitted',
			requestReference: 'REQ-ABCDEFGH2345',
			requestTitles: ['Calculus'],
			nextState: { teacherLabel: 'Mme Tremblay', courseLabel: 'FRE-101 French', bookCount: 1 }
		});
		expect(fact).toEqual({
			kind: 'book_request_submitted',
			reference: 'REQ-ABCDEFGH2345',
			count: 1,
			titles: ['Calculus'],
			teacher: 'Mme Tremblay',
			course: 'FRE-101 French',
			bookstores: []
		});
		expect(JSON.stringify(fact)).not.toContain('sam@');
		expect(JSON.stringify(fact)).not.toContain('studentEmail');
	});

	it('parses fulfillment, pickup, and assignment without student identity', () => {
		expect(
			parseClubFact({
				action: 'staff_fulfillment_ready_for_pickup',
				orderReference: 'MPC-ABCDEFGH2345',
				orderBookCount: 2,
				orderTitles: ['Calculus'],
				orderBookstores: ['Campus Books']
			})
		).toMatchObject({
			kind: 'fulfillment_advanced',
			to: 'ready_for_pickup',
			reference: 'MPC-ABCDEFGH2345'
		});
		expect(
			parseClubFact({
				action: 'book_pickup_recorded',
				orderReference: 'MPC-ABCDEFGH2345',
				nextState: { quantity: 2 },
				titles: ['Calculus'],
				bookstores: ['Campus Books']
			})
		).toMatchObject({ kind: 'book_picked_up', count: 2 });
		expect(
			parseClubFact({
				action: 'book_request_assigned',
				requestReference: 'REQ-ABCDEFGH2345',
				requestTitles: ['Calculus'],
				requestBookstore: 'Campus Books'
			})
		).toEqual({
			kind: 'book_request_assigned',
			reference: 'REQ-ABCDEFGH2345',
			count: 1,
			titles: ['Calculus'],
			bookstores: ['Campus Books']
		});
	});

	it('uses empty collections when paid-order context is omitted', () => {
		expect(parseClubFact({ action: 'stripe_completed_applied' })).toMatchObject({
			kind: 'order_paid',
			count: 0,
			titles: [],
			bookstores: []
		});
		expect(
			parseClubFact({ action: 'staff_fulfillment_purchasing', orderReference: 'MPC-ABCDEFGH2345' })
		).toMatchObject({
			kind: 'fulfillment_advanced',
			count: 0,
			titles: [],
			bookstores: []
		});
		expect(parseClubFact({ action: 'book_request_submitted' })).toMatchObject({
			kind: 'book_request_submitted',
			count: 0,
			titles: [],
			teacher: null,
			course: null
		});
		expect(parseClubFact({ action: 'book_pickup_recorded', requestReference: 'REQ-ABCDEFGH2345' })).toMatchObject({
			kind: 'book_picked_up',
			reference: 'REQ-ABCDEFGH2345',
			count: 0,
			titles: [],
			bookstores: []
		});
		expect(parseClubFact({ action: 'book_request_assigned', requestReference: 'REQ-ABCDEFGH2345' })).toMatchObject({
			kind: 'book_request_assigned',
			count: 0,
			bookstores: []
		});
	});
});

describe('discord sink', () => {
	it('posts reference, counts, and teacher labels without student PII', async () => {
		/** @type {string | undefined} */
		let body;
		const sink = createDiscordSink({
			webhookUrl: WEBHOOK_URL,
			appOrigin: 'https://club.example.com',
			fetchImpl: async (_url, init) => {
				body = String(init?.body);
				return new Response(null, { status: 204 });
			}
		});
		await expect(
			sink.deliver({
				kind: 'book_request_submitted',
				reference: 'REQ-ABCDEFGH2345',
				count: 1,
				titles: ['Calculus'],
				teacher: 'Mme Tremblay',
				course: 'FRE-101 French',
				bookstores: []
			})
		).resolves.toEqual({ disposition: 'delivered' });
		expect(body).toContain('REQ-ABCDEFGH2345');
		expect(body).toContain('Mme Tremblay');
		expect(body).not.toContain('sam@example.com');
		expect(body).not.toContain('Sam Tremblay');
	});

	it('retries when Discord is down', async () => {
		const sink = createDiscordSink({
			webhookUrl: WEBHOOK_URL,
			appOrigin: 'https://club.example.com',
			fetchImpl: async () => {
				throw new Error('network down');
			}
		});
		await expect(
			sink.deliver({
				kind: 'order_paid',
				reference: 'MPC-ABCDEFGH2345',
				count: 2,
				titles: [],
				bookstores: []
			})
		).resolves.toEqual({ disposition: 'retry', afterSeconds: 0, reason: 'network_error' });
	});

	it('includes bookstores and retries 429, 5xx, and dead 4xx responses', async () => {
		const limited = createDiscordSink({
			webhookUrl: WEBHOOK_URL,
			appOrigin: 'https://club.example.com',
			fetchImpl: async () =>
				new Response(JSON.stringify({ retry_after: 2.2 }), {
					status: 429,
					headers: { 'content-type': 'application/json' }
				})
		});
		await expect(
			limited.deliver({
				kind: 'order_paid',
				reference: 'MPC-ABCDEFGH2345',
				count: 1,
				titles: ['Calculus'],
				bookstores: ['Campus Books']
			})
		).resolves.toMatchObject({ disposition: 'retry', afterSeconds: 3, reason: 'rate_limited' });

		const server = createDiscordSink({
			webhookUrl: WEBHOOK_URL,
			appOrigin: 'https://club.example.com',
			fetchImpl: async () => new Response('nope', { status: 500 })
		});
		await expect(server.deliver({ kind: 'order_paid' })).resolves.toMatchObject({
			disposition: 'retry',
			reason: 'server_error'
		});

		const rejected = createDiscordSink({
			webhookUrl: WEBHOOK_URL,
			appOrigin: 'https://club.example.com',
			fetchImpl: async () => new Response('missing', { status: 404 })
		});
		await expect(rejected.deliver({ kind: 'order_paid' })).resolves.toEqual({
			disposition: 'dead',
			reason: 'webhook_rejected'
		});

		const payload = createDiscordSink({
			webhookUrl: WEBHOOK_URL,
			appOrigin: 'https://club.example.com',
			fetchImpl: async () => new Response('bad', { status: 400 })
		});
		await expect(payload.deliver({ kind: 'order_paid' })).resolves.toEqual({
			disposition: 'dead',
			reason: 'payload_rejected'
		});

		const invalidRetry = createDiscordSink({
			webhookUrl: WEBHOOK_URL,
			appOrigin: 'https://club.example.com',
			fetchImpl: async () => new Response('not-json', { status: 429 })
		});
		await expect(invalidRetry.deliver({ kind: 'order_paid' })).resolves.toMatchObject({
			disposition: 'retry',
			afterSeconds: 30,
			reason: 'rate_limited'
		});
	});

	it('retries when Discord exceeds the request timeout', async () => {
		const sink = createDiscordSink({
			webhookUrl: WEBHOOK_URL,
			appOrigin: 'https://club.example.com',
			fetchImpl: (_url, init) =>
				new Promise((_, reject) => {
					init.signal.addEventListener('abort', () => {
						const error = new Error('aborted');
						error.name = 'AbortError';
						reject(error);
					});
				})
		});
		await expect(sink.deliver({ kind: 'order_paid' })).resolves.toMatchObject({
			disposition: 'retry',
			reason: 'network_error'
		});
	}, 8000);
});
