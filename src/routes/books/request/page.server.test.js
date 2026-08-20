// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { BookRequestSubmissionError } from '$lib/server/books/submission.js';
import {
	BookWorkRateLimitError,
	BookWorkUnavailableError
} from '$lib/server/books/work-repository.js';
import { _createBookRequestHandlers } from './+page.server.js';

const RUNTIME = Object.freeze({
	appOrigin: 'https://club.example.com',
	databaseUrl: 'postgresql://runtime:password@db.example.com/books',
	rateLimitHmacKey: 'rate-limit-test-key-that-is-longer-than-thirty-two-characters'
});
const RELAY = Object.freeze({
	...RUNTIME,
	cronSecret: 'cron-secret-with-at-least-32-characters',
	discordWebhookUrl: null
});
const OPTIONS = Object.freeze({
	teachers: [{ id: '10000000-0000-4000-8000-000000000001', name: 'Mme Tremblay' }],
	courses: [{ id: '20000000-0000-4000-8000-000000000001', code: 'FRE-101', title: 'French 101' }]
});

function handlers(overrides = {}) {
	const repository = {
		listFormOptions: vi.fn(async () => OPTIONS),
		submitRequest: vi.fn(async () => ({
			publicReference: 'REQ-ABCDEFGH2345',
			replayed: false
		})),
		...overrides.repository
	};
	const drain = vi.fn(async () => ({ delivered: 1 }));
	return {
		..._createBookRequestHandlers({
			requireLaunch: vi.fn(),
			readRequestEnvironment: vi.fn(() => RUNTIME),
			readRelayEnvironment: vi.fn(() => RELAY),
			createRepository: vi.fn(() => repository),
			readSubmission: vi.fn(async () => ({ clientRequestId: 'id' })),
			createNotificationRelay: vi.fn(() => ({ drain })),
			...overrides
		}),
		repository,
		drain
	};
}

function event() {
	return {
		request: new Request('https://club.example.com/books/request', { method: 'POST' }),
		getClientAddress: () => '127.0.0.1'
	};
}

describe('book request page load', () => {
	it('loads catalogue options for the form', async () => {
		const current = handlers();
		await expect(current.load()).resolves.toMatchObject({
			unavailable: false,
			teachers: OPTIONS.teachers,
			courses: OPTIONS.courses
		});
	});

	it('marks the form unavailable when the environment cannot be read', async () => {
		const current = handlers({
			readRequestEnvironment: vi.fn(() => {
				throw new Error('missing database');
			})
		});
		await expect(current.load()).resolves.toMatchObject({
			unavailable: true,
			teachers: [],
			courses: []
		});
	});

	it('marks the form unavailable when the catalogue cannot be listed', async () => {
		const current = handlers({
			repository: {
				listFormOptions: vi.fn(async () => {
					throw new Error('database down');
				})
			}
		});
		await expect(current.load()).resolves.toMatchObject({ unavailable: true });
	});
});

describe('book request submit', () => {
	it('redirects to the received page after a durable insert', async () => {
		const current = handlers();
		await expect(current.actions.submit(event())).rejects.toMatchObject({
			status: 303,
			location: '/books/request/received?reference=REQ-ABCDEFGH2345'
		});
		expect(current.repository.submitRequest).toHaveBeenCalledOnce();
	});

	it('returns field errors from the multipart boundary', async () => {
		const current = handlers({
			readSubmission: vi.fn(async () => {
				throw new BookRequestSubmissionError(400, 'Enter a valid email address.', ['email']);
			})
		});
		await expect(current.actions.submit(event())).resolves.toMatchObject({
			status: 400,
			data: { errorSummary: 'Enter a valid email address.', fields: ['email'] }
		});
	});

	it('propagates unexpected parse failures', async () => {
		const current = handlers({
			readSubmission: vi.fn(async () => {
				throw new Error('body stream exploded');
			})
		});
		await expect(current.actions.submit(event())).rejects.toThrow('body stream exploded');
	});

	it('fails closed when request environment is missing at submit time', async () => {
		const current = handlers({
			readRequestEnvironment: vi.fn(() => {
				throw new Error('gone');
			})
		});
		await expect(current.actions.submit(event())).resolves.toMatchObject({
			status: 503
		});
	});

	it('returns 429 when the email or address window is exhausted', async () => {
		const current = handlers({
			repository: {
				submitRequest: vi.fn(async () => {
					throw new BookWorkRateLimitError(30);
				})
			}
		});
		await expect(current.actions.submit(event())).resolves.toMatchObject({
			status: 429,
			data: { errorSummary: 'Too many requests. Wait a moment and try again.' }
		});
	});

	it('returns 503 when book work persistence is unavailable', async () => {
		const current = handlers({
			repository: {
				submitRequest: vi.fn(async () => {
					throw new BookWorkUnavailableError();
				})
			}
		});
		await expect(current.actions.submit(event())).resolves.toMatchObject({ status: 503 });
	});

	it('propagates unexpected persistence failures', async () => {
		const current = handlers({
			repository: {
				submitRequest: vi.fn(async () => {
					throw new Error('constraint exploded');
				})
			}
		});
		await expect(current.actions.submit(event())).rejects.toThrow('constraint exploded');
	});

	it('drains Discord with a webhook when one is configured and swallows drain failures', async () => {
		const drain = vi.fn(async () => {
			throw new Error('discord down');
		});
		const createSink = vi.fn(() => ({ deliver: vi.fn() }));
		const current = handlers({
			readRelayEnvironment: vi.fn(() => ({
				...RELAY,
				discordWebhookUrl:
					'https://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests'
			})),
			createDiscordSink: createSink,
			createNotificationRelay: vi.fn(() => ({ drain }))
		});
		await expect(current.actions.submit(event())).rejects.toMatchObject({ status: 303 });
		await vi.waitFor(() => expect(drain).toHaveBeenCalled());
		expect(createSink).toHaveBeenCalledOnce();
	});

	it('uses the default launch guard when Book Delivery is closed', async () => {
		const current = _createBookRequestHandlers();
		await expect(current.load()).rejects.toMatchObject({ status: 404 });
	});
});
