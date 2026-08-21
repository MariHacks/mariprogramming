import { describe, expect, it, vi } from 'vitest';
import { createConfirmationCapability } from '../orders/request.js';
import { buildOrderConfirmationEmail, createPostmarkSink } from './postmark.js';

const ORDER = Object.freeze({
	kind: 'order_paid',
	reference: 'MPC-ABCDEFGH2345',
	recipient: 'student@example.com',
	count: 2,
	titles: ['Calculus', 'Programming in C'],
	totalCents: 7598,
	trackingUrl:
		'https://club.example.com/books/order-confirmation/MPC-ABCDEFGH2345/access#capability-value'
});

describe('Postmark order confirmation email', () => {
	it('includes the order reference, paid total, titles, and secure tracking link', () => {
		const email = buildOrderConfirmationEmail(ORDER);
		expect(email.Subject).toBe('Your book order MPC-ABCDEFGH2345');
		expect(email.To).toBe('student@example.com');
		expect(email.From).toBe('Marianopolis Programming Club <orders@marihacks.com>');
		expect(email.ReplyTo).toBe('team@marihacks.com');
		expect(email.MessageStream).toBe('outbound');
		expect(email.TrackLinks).toBe('None');
		expect(email.TextBody).toContain('Order reference: MPC-ABCDEFGH2345');
		expect(email.TextBody).toContain('Total paid: $75.98 CAD');
		expect(email.TextBody).toContain('1. Calculus');
		expect(email.TextBody).toContain('2. Programming in C');
		expect(email.TextBody).toContain(ORDER.trackingUrl);
		expect(email.HtmlBody).toContain('MPC-ABCDEFGH2345');
		expect(email.HtmlBody).toContain('$75.98 CAD');
		expect(email.HtmlBody).toContain(
			'href="https://club.example.com/books/order-confirmation/MPC-ABCDEFGH2345/access#capability-value"'
		);
		expect(email.HtmlBody).not.toMatch(/[—–·•]/u);
		expect(email.TextBody).not.toMatch(/[—–·•]/u);
	});

	it('escapes customer-facing values in HTML', () => {
		const email = buildOrderConfirmationEmail({
			...ORDER,
			titles: ['A <script>alert("x")</script> & B']
		});
		expect(email.HtmlBody).toContain('A &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; B');
		expect(email.HtmlBody).not.toContain('<script>');
	});

	it('posts through the transactional stream without logging or returning provider data', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(JSON.stringify({ ErrorCode: 0, Message: 'OK', MessageID: 'provider-id' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		);
		const sink = createPostmarkSink({
			serverToken: '00000000-0000-4000-8000-000000000000',
			fetchImpl
		});
		await expect(sink.deliver(ORDER)).resolves.toEqual({ disposition: 'delivered' });
		expect(fetchImpl).toHaveBeenCalledOnce();
		const [url, request] = /** @type {any} */ (fetchImpl).mock.calls[0];
		expect(url).toBe('https://api.postmarkapp.com/email');
		expect(request.headers['X-Postmark-Server-Token']).toBe('00000000-0000-4000-8000-000000000000');
		expect(JSON.parse(request.body)).toMatchObject({
			To: 'student@example.com',
			MessageStream: 'outbound',
			TrackLinks: 'None'
		});
	});

	it('derives a cross-browser tracking link without storing the plaintext capability', async () => {
		const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
		const capabilityKey = 'confirmation-capability-key-with-at-least-32-characters';
		const orderId = '123e4567-e89b-42d3-a456-426614174000';
		const attemptId = '123e4567-e89b-42d3-a456-426614174001';
		const capability = createConfirmationCapability({ capabilityKey, orderId, attemptId });
		const sink = createPostmarkSink({
			serverToken: '00000000-0000-4000-8000-000000000000',
			appOrigin: 'https://club.example.com',
			capabilityKey,
			fetchImpl
		});

		await sink.deliver({ ...ORDER, trackingUrl: undefined, orderId, attemptId });

		const body = JSON.parse(/** @type {any} */ (fetchImpl).mock.calls[0][1].body);
		expect(body.HtmlBody).toContain(
			`href="https://club.example.com/books/order-confirmation/MPC-ABCDEFGH2345/access#${capability}"`
		);
		expect(body.TrackLinks).toBe('None');
	});

	it.each([
		[429, 'retry', 'rate_limited'],
		[500, 'retry', 'server_error'],
		[422, 'dead', 'payload_rejected'],
		[401, 'dead', 'credential_rejected']
	])('maps Postmark %i to a bounded %s outcome', async (status, disposition, reason) => {
		const sink = createPostmarkSink({
			serverToken: '00000000-0000-4000-8000-000000000000',
			fetchImpl: vi.fn(async () => new Response('{}', { status }))
		});
		await expect(sink.deliver(ORDER)).resolves.toMatchObject({ disposition, reason });
	});

	it('retries a network failure without exposing the error', async () => {
		const sink = createPostmarkSink({
			serverToken: '00000000-0000-4000-8000-000000000000',
			fetchImpl: vi.fn(async () => {
				throw new Error('secret network details');
			})
		});
		await expect(sink.deliver(ORDER)).resolves.toEqual({
			disposition: 'retry',
			afterSeconds: 0,
			reason: 'network_error'
		});
	});
});
