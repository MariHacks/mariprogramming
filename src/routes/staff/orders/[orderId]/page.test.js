// @ts-nocheck

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OrderDetailPage from './+page.svelte';

const formMocks = vi.hoisted(() => {
	const state = { result: null };
	const enhance = vi.fn((formElement, submitCallback) => {
		const handleSubmit = async (event) => {
			event.preventDefault();
			const callback = await submitCallback({
				action: new URL(
					event.submitter?.getAttribute('formaction') ?? formElement.getAttribute('action') ?? '',
					document.baseURI
				),
				cancel: vi.fn(),
				controller: new AbortController(),
				formData: new FormData(formElement, event.submitter),
				formElement,
				submitter: event.submitter
			});
			if (!callback) return;
			await callback({
				action: new URL(document.baseURI),
				formData: new FormData(formElement, event.submitter),
				formElement,
				result: await state.result,
				update: vi.fn(async () => {})
			});
		};
		formElement.addEventListener('submit', handleSubmit);
		return { destroy: () => formElement.removeEventListener('submit', handleSubmit) };
	});
	return { applyAction: vi.fn(async () => {}), enhance, state };
});
const navigationMocks = vi.hoisted(() => ({ invalidateAll: vi.fn(async () => {}) }));

vi.mock('$app/forms', () => ({ enhance: formMocks.enhance, applyAction: formMocks.applyAction }));
vi.mock('$app/navigation', () => ({ invalidateAll: navigationMocks.invalidateAll }));

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ORDER = Object.freeze({
	id: ORDER_ID,
	publicReference: 'MPC-ABCDEFGH2345',
	customer: { name: 'Student Name', email: 'student@example.com' },
	currency: 'cad',
	paymentStatus: 'paid',
	fulfillmentStatus: 'unstarted',
	version: 4,
	subtotalCents: 4200,
	serviceFeeCents: 500,
	taxCents: 704,
	totalCents: 5404,
	refundedAmountCents: 0,
	createdAt: '2026-08-13T14:00:00.000Z',
	updatedAt: '2026-08-13T15:00:00.000Z',
	ageSeconds: 7200,
	provider: {
		checkoutSessionId: 'cs_test_staff_order',
		paymentIntentId: 'pi_staff_order',
		chargeId: 'ch_staff_order'
	},
	bookstores: [
		{
			id: '50000000-0000-4000-8000-000000000001',
			name: 'Campus Books',
			lines: [
				{
					id: '40000000-0000-4000-8000-000000000001',
					kind: 'book',
					label: 'The C Programming Language',
					isbn: '9780131103627',
					teacherName: 'Ada Lovelace',
					courseCode: 'CSC 205',
					courseTitle: 'Data Structures',
					quantity: 1,
					unitAmountCents: 4200,
					lineAmountCents: 4200,
					currentRetailerUrl: 'https://shop.example.com/books/c-programming'
				},
				{
					id: '40000000-0000-4000-8000-000000000002',
					kind: 'service_fee',
					label: 'Campus Books pickup service',
					isbn: null,
					teacherName: null,
					courseCode: null,
					courseTitle: null,
					quantity: 1,
					unitAmountCents: 500,
					lineAmountCents: 500,
					currentRetailerUrl: null
				}
			]
		}
	],
	history: [
		{
			id: '70000000-0000-4000-8000-000000000001',
			actorKind: 'stripe',
			action: 'stripe_completed_applied',
			previousPaymentStatus: 'pending',
			nextPaymentStatus: 'paid',
			previousFulfillmentStatus: 'unstarted',
			nextFulfillmentStatus: 'unstarted',
			createdAt: '2026-08-13T14:10:00.000Z'
		}
	],
	nextFulfillmentStatus: 'purchasing',
	canCancel: false
});

function data(overrides = {}) {
	return { order: { ...ORDER, ...overrides }, unavailable: false };
}

async function submit(button) {
	await fireEvent(
		button.closest('form'),
		new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button })
	);
}

afterEach(() => {
	cleanup();
	formMocks.applyAction.mockClear();
	formMocks.enhance.mockClear();
	formMocks.state.result = null;
	navigationMocks.invalidateAll.mockClear();
});

describe('staff order detail', () => {
	it('renders the protected customer, provider lookup, immutable receipt, and current retailer link', () => {
		const { container } = render(OrderDetailPage, { props: { data: data() } });
		expect(screen.getByRole('link', { name: 'Back to orders' })).toHaveAttribute('href', '/staff');
		expect(screen.getByRole('heading', { level: 1, name: ORDER.publicReference })).toBeVisible();
		expect(screen.getByText('Student Name')).toBeVisible();
		expect(screen.getByText('student@example.com')).toBeVisible();
		expect(screen.getByText('cs_test_staff_order')).toBeVisible();
		expect(screen.getByText('pi_staff_order')).toBeVisible();
		expect(screen.getByText('ch_staff_order')).toBeVisible();
		expect(screen.getByRole('heading', { level: 2, name: 'Receipt snapshot' })).toBeVisible();
		expect(screen.getByRole('heading', { level: 3, name: 'Campus Books' })).toBeVisible();
		expect(screen.getByText('The C Programming Language')).toBeVisible();
		expect(screen.getByText('CSC 205, Data Structures')).toBeVisible();
		expect(screen.getByText('ISBN 9780131103627')).toBeVisible();
		expect(
			screen.getByRole('link', {
				name: 'View current retailer listing for The C Programming Language'
			})
		).toHaveAttribute('href', 'https://shop.example.com/books/c-programming');
		expect(screen.getByText('$54.04')).toBeVisible();
		expect(container.querySelector('.detail-layout')).not.toHaveClass('cards');
		expect(document.body).not.toHaveTextContent(/confirmation token|capability/i);
	});

	it('makes the one valid next transition the clear primary action', () => {
		render(OrderDetailPage, { props: { data: data() } });
		const action = screen.getByRole('button', { name: 'Start purchasing' });
		expect(action).toHaveAttribute('formaction', '?/advance');
		expect(action.closest('form')).toHaveAttribute('method', 'post');
		expect(screen.getByDisplayValue('4')).toHaveAttribute('type', 'hidden');
		expect(screen.queryByRole('button', { name: /refund/i })).not.toBeInTheDocument();
	});

	it.each([
		['purchasing', 'received', 'Mark books received'],
		['received', 'ready_for_pickup', 'Mark ready for pickup']
	])('labels %s to %s plainly', (fulfillmentStatus, nextFulfillmentStatus, buttonName) => {
		render(OrderDetailPage, {
			props: { data: data({ fulfillmentStatus, nextFulfillmentStatus }) }
		});
		expect(screen.getByRole('button', { name: buttonName })).toBeVisible();
	});

	it('requires a deliberate confirmation for unpaid cancellation and states that it is not a refund', () => {
		render(OrderDetailPage, {
			props: {
				data: data({
					paymentStatus: 'pending',
					nextFulfillmentStatus: null,
					canCancel: true,
					provider: {
						checkoutSessionId: 'cs_test_staff_order',
						paymentIntentId: null,
						chargeId: null
					}
				})
			}
		});
		expect(screen.getByText('Cancel unpaid order')).toBeVisible();
		expect(
			screen.getByText('This closes the unpaid checkout. It does not issue a Stripe refund.')
		).toBeVisible();
		const confirm = screen.getByRole('button', { name: 'Confirm cancellation' });
		expect(confirm).toHaveAttribute('formaction', '?/cancel');
		expect(confirm.closest('form')).toHaveAttribute('method', 'post');
	});

	it('halts actions after a refund while preserving the receipt and history', () => {
		render(OrderDetailPage, {
			props: {
				data: data({
					paymentStatus: 'partially_refunded',
					refundedAmountCents: 500,
					nextFulfillmentStatus: null,
					canCancel: false
				})
			}
		});
		expect(screen.getByText('Partially refunded')).toBeVisible();
		const refunded = screen.getByText('Refunded');
		expect(refunded).toBeVisible();
		expect(refunded.nextElementSibling).toHaveTextContent('$5.00');
		expect(
			screen.queryByRole('button', { name: /mark|start|cancel|refund/i })
		).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Receipt snapshot' })).toBeVisible();
	});

	it('shows a readable, allowlisted operations history in Toronto time', () => {
		render(OrderDetailPage, { props: { data: data() } });
		expect(screen.getByRole('heading', { level: 2, name: 'Order history' })).toBeVisible();
		expect(screen.getByText('Payment confirmed')).toBeVisible();
		expect(screen.getByText('Stripe')).toBeVisible();
		const historyTime = screen.getAllByRole('time').at(-1);
		expect(historyTime).toHaveAttribute('datetime', '2026-08-13T14:10:00.000Z');
	});

	it('renders a bounded unavailable state without protected details', () => {
		render(OrderDetailPage, {
			props: { data: { order: null, unavailable: true } }
		});
		expect(screen.getByRole('alert')).toHaveTextContent(
			'This order is unavailable right now. Return to orders and try again.'
		);
		expect(screen.queryByText('student@example.com')).not.toBeInTheDocument();
		expect(document.body).not.toHaveTextContent(/database|postgres|secret/i);
	});

	it('focuses a bounded action error', async () => {
		render(OrderDetailPage, {
			props: {
				data: data(),
				form: { errorSummary: 'This order changed. Reload it before trying again.' }
			}
		});
		const alert = screen.getByRole('alert');
		await waitFor(() => expect(alert).toHaveFocus());
		expect(alert).toHaveTextContent('This order changed. Reload it before trying again.');
	});

	it('announces enhanced progress, applies success, and reloads the order', async () => {
		let finish;
		formMocks.state.result = new Promise((resolve) => {
			finish = resolve;
		});
		render(OrderDetailPage, { props: { data: data() } });
		const button = screen.getByRole('button', { name: 'Start purchasing' });
		await submit(button);
		expect(screen.getByRole('status')).toHaveTextContent('Updating order');
		expect(button).toBeDisabled();
		finish({
			type: 'success',
			status: 200,
			data: {
				success: true,
				message: 'Order moved to purchasing.',
				order: {
					id: ORDER_ID,
					paymentStatus: 'paid',
					fulfillmentStatus: 'purchasing',
					version: 5
				}
			}
		});
		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent('Order moved to purchasing.')
		);
		expect(formMocks.applyAction).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'success', status: 200 })
		);
		expect(navigationMocks.invalidateAll).toHaveBeenCalledOnce();
		const statuses = screen.getByLabelText('Current order status');
		expect(statuses).toHaveTextContent('Purchasing');
		expect(statuses).not.toHaveTextContent('Unstarted');
		expect(screen.queryByRole('button', { name: 'Start purchasing' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Mark books received' })).toBeVisible();
	});

	it('contains an enhanced transport error and restores actions', async () => {
		formMocks.state.result = {
			type: 'error',
			status: 500,
			error: new Error('private network detail')
		};
		render(OrderDetailPage, { props: { data: data() } });
		const button = screen.getByRole('button', { name: 'Start purchasing' });
		await submit(button);
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('The order could not be updated. Try again.');
		expect(alert).not.toHaveTextContent('private network detail');
		expect(button).toBeEnabled();
	});
});
