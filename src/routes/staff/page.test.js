// @ts-nocheck

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OrdersPage from './+page.svelte';

const formMocks = vi.hoisted(() => {
	const state = { result: null };
	const enhance = vi.fn((formElement, submitCallback) => {
		const handleSubmit = async (event) => {
			event.preventDefault();
			const callback = await submitCallback({
				action: new URL(formElement.getAttribute('action') ?? '', document.baseURI),
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

vi.mock('$app/forms', () => ({ enhance: formMocks.enhance, applyAction: formMocks.applyAction }));

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ORDER = Object.freeze({
	id: ORDER_ID,
	publicReference: 'MPC-ABCDEFGH2345',
	maskedEmail: 's*****t@example.com',
	paymentStatus: 'paid',
	fulfillmentStatus: 'unstarted',
	totalCents: 5404,
	version: 4,
	createdAt: '2026-08-13T14:00:00.000Z',
	ageSeconds: 7200
});

function listing(overrides = {}) {
	return {
		orders: [ORDER],
		totalCount: 1,
		page: 1,
		pageSize: 25,
		hasPrevious: false,
		hasNext: false,
		filters: { payment: 'actionable', fulfillment: 'all' },
		...overrides
	};
}

function data(overrides = {}) {
	return { listing: listing(), unavailable: false, ...overrides };
}

async function submit(button) {
	const form = button.closest('form');
	await fireEvent(
		form,
		new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button })
	);
}

afterEach(() => {
	cleanup();
	formMocks.applyAction.mockClear();
	formMocks.enhance.mockClear();
	formMocks.state.result = null;
});

describe('staff order ledger', () => {
	it('renders a flat actionable ledger with bounded filters and Toronto-local time', () => {
		const { container } = render(OrdersPage, { props: { data: data() } });
		expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
		expect(screen.getByText('1 order')).toBeVisible();
		expect(screen.getByRole('combobox', { name: 'Payment' })).toHaveValue('actionable');
		expect(screen.getByRole('combobox', { name: 'Fulfillment' })).toHaveValue('all');
		expect(screen.getByRole('button', { name: 'Apply filters' }).closest('form')).toHaveAttribute(
			'method',
			'get'
		);
		expect(screen.getByRole('link', { name: /Open MPC-ABCDEFGH2345/i })).toHaveAttribute(
			'href',
			`/staff/orders/${ORDER_ID}`
		);
		expect(screen.getByText('s*****t@example.com')).toBeVisible();
		expect(screen.getByText('$54.04')).toBeVisible();
		expect(screen.getByText('2 hours old')).toBeVisible();
		expect(screen.getByText('2 hours old')).toHaveClass('age-fresh');
		const timestamp = container.querySelector('time');
		expect(timestamp).toHaveAttribute('datetime', ORDER.createdAt);
		expect(timestamp).toHaveTextContent(/Aug|août/u);
		expect(container.querySelector('.order-list')).not.toHaveClass('cards');
	});

	it('keeps exact search and purchase export POST-backed with native form fallbacks', () => {
		render(OrdersPage, { props: { data: data() } });
		const search = screen.getByRole('searchbox', {
			name: 'Order reference or customer email'
		});
		expect(search.closest('form')).toHaveAttribute('method', 'post');
		expect(search.closest('form')).toHaveAttribute('action', '?/search');
		expect(screen.getByRole('button', { name: 'Find order' })).toHaveAttribute('type', 'submit');
		const exportButton = screen.getByRole('button', { name: 'Download purchase list' });
		expect(exportButton.closest('form')).toHaveAttribute('method', 'post');
		expect(exportButton.closest('form')).toHaveAttribute('action', '/staff/orders/export');
		expect(screen.getByDisplayValue('purchase_list')).toHaveAttribute('type', 'hidden');
	});

	it('renders one exact POST search result without moving the email into a link', () => {
		render(OrdersPage, {
			props: {
				data: data(),
				form: {
					success: true,
					search: {
						...listing({ filters: { payment: 'all', fulfillment: 'all' } }),
						query: 'student@example.com',
						queryKind: 'email'
					}
				}
			}
		});
		expect(screen.getByRole('searchbox')).toHaveValue('student@example.com');
		expect(screen.getByRole('heading', { level: 2, name: 'Exact match' })).toBeVisible();
		expect(screen.getByText('1 result')).toBeVisible();
		for (const link of screen.getAllByRole('link')) {
			expect(link.getAttribute('href') ?? '').not.toContain('student@example.com');
		}
	});

	it('uses POST forms for exact-search pagination while ledger pagination stays non-PII', () => {
		const { rerender } = render(OrdersPage, {
			props: {
				data: data({
					listing: listing({ page: 2, hasPrevious: true, hasNext: true, totalCount: 80 })
				})
			}
		});
		expect(screen.getByRole('link', { name: 'Previous page' })).toHaveAttribute(
			'href',
			expect.stringContaining('page=1')
		);
		expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute(
			'href',
			expect.stringContaining('page=3')
		);

		rerender({
			data: data(),
			form: {
				success: true,
				search: {
					...listing({ page: 2, hasPrevious: true, hasNext: true, totalCount: 80 }),
					query: 'student@example.com',
					queryKind: 'email'
				}
			}
		});
		for (const button of screen.getAllByRole('button', { name: /search page/i })) {
			expect(button.closest('form')).toHaveAttribute('method', 'post');
			expect(button.closest('form')).toHaveAttribute('action', '?/search');
		}
	});

	it('shows useful empty, no-match, and unavailable states', () => {
		const { rerender } = render(OrdersPage, {
			props: { data: data({ listing: listing({ orders: [], totalCount: 0 }) }) }
		});
		expect(screen.getByText('No orders match these filters.')).toBeVisible();

		rerender({
			data: data(),
			form: {
				success: true,
				search: {
					...listing({
						orders: [],
						totalCount: 0,
						filters: { payment: 'all', fulfillment: 'all' }
					}),
					query: 'missing@example.com',
					queryKind: 'email'
				}
			}
		});
		expect(screen.getByText('No exact match found.')).toBeVisible();

		rerender({ data: data({ unavailable: true }), form: null });
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Orders are unavailable right now. Reload this page to try again.'
		);
		expect(document.body).not.toHaveTextContent(/database|postgres|secret/i);
	});

	it('focuses a bounded search error without exposing submitted customer data', async () => {
		render(OrdersPage, {
			props: {
				data: data(),
				form: { errorSummary: 'Enter a complete order reference or email address.' }
			}
		});
		const alert = screen.getByRole('alert');
		await waitFor(() => expect(alert).toHaveFocus());
		expect(alert).toHaveTextContent('Enter a complete order reference or email address.');
		expect(alert).not.toHaveTextContent('student@example.com');
	});

	it('announces enhanced search progress and applies a bounded success', async () => {
		let finish;
		formMocks.state.result = new Promise((resolve) => {
			finish = resolve;
		});
		render(OrdersPage, { props: { data: data() } });
		const button = screen.getByRole('button', { name: 'Find order' });
		await submit(button);
		expect(screen.getByRole('status')).toHaveTextContent('Searching');
		expect(button).toBeDisabled();
		finish({
			type: 'success',
			status: 200,
			data: {
				success: true,
				search: {
					...listing(),
					query: 'student@example.com',
					queryKind: 'email'
				}
			}
		});
		await screen.findByRole('heading', { level: 2, name: 'Exact match' });
		expect(formMocks.applyAction).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'success', status: 200 })
		);
		expect(screen.queryByText('Searching')).not.toBeInTheDocument();
	});

	it('contains an enhanced transport error and restores the search', async () => {
		formMocks.state.result = {
			type: 'error',
			status: 500,
			error: new Error('private network detail')
		};
		render(OrdersPage, { props: { data: data() } });
		const button = screen.getByRole('button', { name: 'Find order' });
		await submit(button);
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('The search could not be completed. Try again.');
		expect(alert).not.toHaveTextContent('private network detail');
		expect(button).toBeEnabled();
	});
});
