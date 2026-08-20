// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	BookDeliveryProviderError,
	retrieveReconciliationEvidence
} from './book-delivery-provider.js';

const CANDIDATE = Object.freeze({
	kind: 'ready',
	orderId: '11111111-1111-4111-8111-111111111111',
	attemptId: '22222222-2222-4222-8222-222222222222',
	sessionId: 'cs_test_reconcile',
	paymentIntentId: null,
	customerEmail: 'student@example.com',
	totalCents: 2500,
	expiresAt: new Date('2026-08-13T17:00:00.000Z')
});

/** @param {string} status @param {string} paymentStatus */
function stripeWithStatus(status, paymentStatus) {
	return {
		checkout: {
			sessions: {
				retrieve: vi.fn(async () => ({
					id: CANDIDATE.sessionId,
					status,
					payment_status: paymentStatus,
					livemode: false
				}))
			}
		}
	};
}

describe('scheduled Stripe evidence retrieval', () => {
	it.each([
		['expired', 'unpaid', 'expired'],
		['complete', 'paid', 'completed']
	])(
		'fully validates a provider %s Session outside database work',
		async (status, payment, kind) => {
			const stripe = stripeWithStatus(status, payment);
			const evidence = Object.freeze({ ...CANDIDATE, kind });
			const retrieveCheckoutEvidence = /** @type {any} */ (
				vi.fn(async (_stripe, descriptor) => {
					expect(descriptor).toMatchObject({
						kind,
						mode: 'test',
						objectId: CANDIDATE.sessionId,
						environmentMatches: true
					});
					return evidence;
				})
			);

			await expect(
				retrieveReconciliationEvidence(stripe, CANDIDATE, {
					stripeMode: 'test',
					retrieveCheckoutEvidence
				})
			).resolves.toBe(evidence);
			expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith(CANDIDATE.sessionId);
			expect(retrieveCheckoutEvidence).toHaveBeenCalledTimes(1);
		}
	);

	it('leaves a still-open unpaid Session for a later run', async () => {
		const retrieveCheckoutEvidence = vi.fn();
		await expect(
			retrieveReconciliationEvidence(stripeWithStatus('open', 'unpaid'), CANDIDATE, {
				stripeMode: 'test',
				retrieveCheckoutEvidence
			})
		).resolves.toBeNull();
		expect(retrieveCheckoutEvidence).not.toHaveBeenCalled();
	});

	it.each([
		[
			'invalid candidate',
			{ ...CANDIDATE, sessionId: 'bad' },
			stripeWithStatus('expired', 'unpaid')
		],
		['invalid mode', CANDIDATE, stripeWithStatus('expired', 'unpaid'), 'preview'],
		['invalid client', CANDIDATE, {}],
		[
			'mismatched preliminary Session',
			CANDIDATE,
			{
				checkout: {
					sessions: {
						retrieve: vi.fn(async () => ({
							id: 'cs_test_other',
							status: 'expired',
							payment_status: 'unpaid',
							livemode: false
						}))
					}
				}
			}
		],
		['invalid provider state', CANDIDATE, stripeWithStatus('complete', 'unpaid')]
	])('fails closed for %s', async (_label, candidate, stripe, stripeMode = 'test') => {
		await expect(
			retrieveReconciliationEvidence(stripe, candidate, {
				stripeMode,
				retrieveCheckoutEvidence: vi.fn()
			})
		).rejects.toBeInstanceOf(BookDeliveryProviderError);
	});

	it('maps provider retrieval and evidence failures to one bounded error', async () => {
		const stripe = stripeWithStatus('expired', 'unpaid');
		stripe.checkout.sessions.retrieve.mockRejectedValue(new Error('provider detail'));
		await expect(
			retrieveReconciliationEvidence(stripe, CANDIDATE, {
				stripeMode: 'test',
				retrieveCheckoutEvidence: vi.fn()
			})
		).rejects.toMatchObject({
			name: 'BookDeliveryProviderError',
			message: 'Book Delivery provider reconciliation is unavailable'
		});

		await expect(
			retrieveReconciliationEvidence(stripeWithStatus('expired', 'unpaid'), CANDIDATE, {
				stripeMode: 'test',
				retrieveCheckoutEvidence: vi.fn(async () => {
					throw new Error('secret provider detail');
				})
			})
		).rejects.toBeInstanceOf(BookDeliveryProviderError);
	});
});
