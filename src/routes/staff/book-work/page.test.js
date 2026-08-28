import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BookWorkPage from './+page.svelte';

afterEach(cleanup);

describe('staff book work board', () => {
	it('groups unassigned requests separately from bookstore pickup rows', () => {
		render(BookWorkPage, {
			props: {
				data: /** @type {any} */ ({
					board: {
						totalRows: 2,
						bookstores: [{ id: 'store-1', name: 'Campus Books' }],
						groups: [
							{
								bookstore: null,
								rows: [
									{
										ref: {
											kind: 'request_item',
											requestId: '10000000-0000-4000-8000-000000000001',
											itemId: '20000000-0000-4000-8000-000000000001'
										},
										version: 1,
										reference: 'REQ-ABCDEFGH2345',
										title: 'Calculus',
										author: 'Stewart',
										requested: 1,
										pickedUp: 0,
										remaining: 1,
										source: { teacher: 'Mme Tremblay', course: 'FRE-101' },
										age: { label: '2 hours old', band: 'fresh', tone: 'var(--color-muted)' },
										commandId: '30000000-0000-4000-8000-000000000001'
									}
								]
							},
							{
								bookstore: { id: 'store-1', name: 'Campus Books' },
								rows: [
									{
										ref: {
											kind: 'order_line',
											orderId: '40000000-0000-4000-8000-000000000001',
											lineId: '50000000-0000-4000-8000-000000000001'
										},
										version: 4,
										reference: 'MPC-ABCDEFGH2345',
										title: 'Le Petit Prince',
										author: null,
										requested: 2,
										pickedUp: 0,
										remaining: 2,
										source: { teacher: 'Mme Tremblay', course: 'FRE-101' },
										age: { label: '1 day old', band: 'aging', tone: 'var(--coral)' },
										commandId: '60000000-0000-4000-8000-000000000001'
									}
								]
							}
						]
					}
				}),
				form: /** @type {any} */ ({})
			}
		});
		expect(screen.getByRole('heading', { name: 'Unassigned' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Campus Books' })).toBeVisible();
		expect(screen.getByRole('button', { name: 'Assign' })).toBeVisible();
		expect(screen.getByRole('button', { name: 'Record pickup' })).toBeVisible();
		expect(screen.getByText('2 hours old')).toHaveClass('age-fresh');
		expect(screen.getByText('1 day old')).toHaveClass('age-aging');
		expect(document.body).not.toHaveTextContent('Mark picked up');
	});

	it('explains an empty board and surfaces a form status', () => {
		render(BookWorkPage, {
			props: {
				data: /** @type {any} */ ({
					board: { totalRows: 0, bookstores: [], groups: [] }
				}),
				form: /** @type {any} */ ({ message: 'Request assigned.' })
			}
		});
		expect(screen.getByText('There is no outstanding book work.')).toBeVisible();
		expect(screen.getByRole('link', { name: 'Open orders ledger' })).toHaveAttribute(
			'href',
			'/staff'
		);
		expect(screen.getByRole('status')).toHaveTextContent('Request assigned.');
	});

	it('announces unavailability without leaking query internals', () => {
		render(BookWorkPage, {
			props: {
				data: /** @type {any} */ ({
					board: { totalRows: 0, bookstores: [], groups: [] },
					unavailable: true
				}),
				form: /** @type {any} */ ({})
			}
		});
		expect(screen.getByRole('alert')).toHaveTextContent('Book work is unavailable right now.');
		expect(screen.getByRole('link', { name: 'Reload book work' })).toHaveAttribute(
			'href',
			'/staff/book-work'
		);
		expect(document.body).not.toHaveTextContent(/Failed query|book_pickups|postgres|secret/i);
	});
});
