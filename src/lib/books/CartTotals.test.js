import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CartTotals from './CartTotals.svelte';

const summary = {
	bookSubtotalCents: 4890,
	fees: [
		{ bookstoreId: 'renaud-bray', label: 'Renaud-Bray service fee', amountCents: 500 },
		{ bookstoreId: 'archambault', label: 'Archambault service fee', amountCents: 700 }
	],
	taxCents: 911,
	totalCents: 7001
};

afterEach(cleanup);

describe('CartTotals', () => {
	it('renders the supplied ledger labels and CAD amounts', () => {
		render(CartTotals, { props: { summary } });

		expect(screen.getByText('Book subtotal')).toBeVisible();
		expect(screen.getByText('$48.90')).toBeVisible();
		expect(screen.getByText('Renaud-Bray service fee')).toBeVisible();
		expect(screen.getByText('$5.00')).toBeVisible();
		expect(screen.getByText('Archambault service fee')).toBeVisible();
		expect(screen.getByText('$7.00')).toBeVisible();
		expect(screen.getByText('Taxes')).toBeVisible();
		expect(screen.getByText('$9.11')).toBeVisible();
		expect(screen.getByText('Order total')).toBeVisible();
		expect(screen.getByText('$70.01')).toBeVisible();
	});

	it('keeps supplied fee labels in order and renders each one once', () => {
		render(CartTotals, { props: { summary } });

		expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
			'Book subtotal',
			'Renaud-Bray service fee',
			'Archambault service fee',
			'Taxes',
			'Order total'
		]);
		expect(screen.getAllByText('Renaud-Bray service fee')).toHaveLength(1);
		expect(screen.getAllByText('Archambault service fee')).toHaveLength(1);
	});

	it('keeps the canonical subtotal, taxes, and total when fees are empty or null', () => {
		const { rerender } = render(CartTotals, {
			props: {
				summary: {
					bookSubtotalCents: 0,
					fees: [],
					taxCents: 0,
					totalCents: 0
				}
			}
		});

		expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
			'Book subtotal',
			'Taxes',
			'Order total'
		]);
		expect(screen.getAllByText('$0.00')).toHaveLength(3);

		rerender({
			summary: {
				bookSubtotalCents: 0,
				fees: null,
				taxCents: 0,
				totalCents: 0
			}
		});

		expect(screen.getAllByRole('term')).toHaveLength(3);
		expect(screen.getAllByText('$0.00')).toHaveLength(3);
	});

	it('provides one named summary without adding interactive checkout or payment controls', () => {
		const { container } = render(CartTotals, { props: { summary } });

		expect(screen.getByRole('complementary', { name: 'Order summary' })).toBeInTheDocument();
		expect(screen.getAllByText('Order total')).toHaveLength(1);
		expect(container.querySelectorAll('a, button, input, select, textarea')).toHaveLength(0);
		expect(container).not.toHaveTextContent(/checkout|payment|map/i);
	});
});
