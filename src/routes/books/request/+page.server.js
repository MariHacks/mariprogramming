// @ts-nocheck
import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { createClubContactLinks } from '$lib/club-contact.js';
import {
	readBookRequestEnvironment,
	readNotificationRelayEnvironment
} from '$lib/server/config/environment.js';
import { requireLiveBookDelivery } from '$lib/server/books/launch-state.js';
import {
	BookRequestSubmissionError,
	readBookRequestSubmission
} from '$lib/server/books/submission.js';
import {
	BookWorkRateLimitError,
	BookWorkUnavailableError,
	createBookWorkRepository
} from '$lib/server/books/work-repository.js';
import { createDiscordSink } from '$lib/server/notify/discord.js';
import { createNotificationRelay } from '$lib/server/notify/relay.js';

function unavailablePage() {
	return {
		unavailable: true,
		teachers: [],
		courses: [],
		clientRequestId: crypto.randomUUID(),
		contact: createClubContactLinks()
	};
}

/**
 * @param {Record<string, any>} [dependencies]
 */
export function _createBookRequestHandlers(dependencies = {}) {
	const requireLaunch =
		dependencies.requireLaunch ??
		(() =>
			requireLiveBookDelivery({
				onClosed: () => error(404, 'Book requests are not available')
			}));
	const readRequestEnvironment = dependencies.readRequestEnvironment ?? readBookRequestEnvironment;
	const readRelayEnvironment =
		dependencies.readRelayEnvironment ?? readNotificationRelayEnvironment;
	const createRepository = dependencies.createRepository ?? createBookWorkRepository;
	const readSubmission = dependencies.readSubmission ?? readBookRequestSubmission;
	const createSink = dependencies.createDiscordSink ?? createDiscordSink;
	const createRelay = dependencies.createNotificationRelay ?? createNotificationRelay;

	async function drainQuietly() {
		try {
			const runtime = readRelayEnvironment();
			const sink = runtime.discordWebhookUrl
				? createSink({
						webhookUrl: runtime.discordWebhookUrl,
						appOrigin: runtime.appOrigin
					})
				: null;
			await createRelay({ databaseUrl: runtime.databaseUrl, sink }).drain({
				limit: 2,
				budgetMs: 2000
			});
		} catch {
			// The request is durable before notification delivery starts.
		}
	}

	return {
		async load() {
			requireLaunch();
			let runtime;
			try {
				runtime = readRequestEnvironment();
			} catch {
				return unavailablePage();
			}
			try {
				const options = await createRepository({
					databaseUrl: runtime.databaseUrl,
					hmacKey: runtime.rateLimitHmacKey
				}).listFormOptions();
				return {
					unavailable: false,
					teachers: options.teachers,
					courses: options.courses,
					clientRequestId: crypto.randomUUID(),
					contact: createClubContactLinks()
				};
			} catch {
				return unavailablePage();
			}
		},
		actions: {
			async submit(event) {
				requireLaunch();
				let submission;
				try {
					submission = await readSubmission(event.request, {
						clientAddress: event.getClientAddress()
					});
				} catch (failure) {
					if (failure instanceof BookRequestSubmissionError) {
						return fail(failure.status, {
							errorSummary: failure.summary,
							fields: failure.fields
						});
					}
					throw failure;
				}
				let runtime;
				try {
					runtime = readRequestEnvironment();
				} catch {
					return fail(503, {
						errorSummary: 'Book requests are unavailable right now. Try again.'
					});
				}
				try {
					const receipt = await createRepository({
						databaseUrl: runtime.databaseUrl,
						hmacKey: runtime.rateLimitHmacKey
					}).submitRequest(submission, { requestHeaders: event.request.headers });
					void drainQuietly();
					redirect(
						303,
						`/books/request/received?reference=${encodeURIComponent(receipt.publicReference)}`
					);
				} catch (failure) {
					if (isRedirect(failure)) throw failure;
					if (failure instanceof BookWorkRateLimitError) {
						return fail(429, {
							errorSummary: 'Too many requests. Wait a moment and try again.'
						});
					}
					if (failure instanceof BookWorkUnavailableError) {
						return fail(503, {
							errorSummary: 'Book requests are unavailable right now. Try again.'
						});
					}
					throw failure;
				}
			}
		}
	};
}

const handlers = _createBookRequestHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
