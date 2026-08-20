import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PickupMap from './PickupMap.svelte';

afterEach(cleanup);

describe('PickupMap', () => {
	it('renders an accessible Marianopolis map with textual pickup context', () => {
		const { container } = render(PickupMap);
		const frame = screen.getByTitle('Map to Marianopolis College');

		expect(screen.getByRole('region', { name: 'Pickup location' })).toBeVisible();
		expect(frame).toHaveAttribute('loading', 'lazy');
		expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
		expect(frame.getAttribute('src')).toContain('4873%20Westmount%20Ave');
		expect(screen.getByText("Wayne's Front Desk", { selector: '.pickup-spot' })).toBeVisible();
		expect(screen.getByText('Marianopolis College')).toBeVisible();
		expect(screen.getByText('4873 Westmount Ave, Westmount, QC H3Y 1X9')).toBeVisible();
		expect(container).not.toHaveTextContent(/Campus pickup|Pickup spot|Campus address/i);
		expect(container).not.toHaveTextContent(/checkout|payment|cart|fee|tax|stock|available/i);
	});

	it('provides a secure external campus-map link', () => {
		render(PickupMap);
		const link = screen.getByRole('link', { name: 'Open in Maps in a new tab' });

		expect(link).toHaveTextContent('Open in Maps');
		expect(link.getAttribute('href')).toContain('4873%20Westmount%20Ave');
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', 'noreferrer');
	});

	it('introduces location context without controls', () => {
		const { container } = render(PickupMap);

		expect(container.querySelectorAll('button, input, select, textarea')).toHaveLength(0);
		expect(screen.getAllByRole('link')).toHaveLength(1);
	});
});
