import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BooksLayout from './+layout.svelte';
import layoutSource from './+layout.svelte?raw';

afterEach(() => {
	cleanup();
});

describe('Book Delivery local layout', () => {
	it('owns one empty cart and mounts the Book Delivery navigation', () => {
		render(BooksLayout, { props: { data: { launchState: 'live' } } });

		expect(screen.getByRole('navigation', { name: 'Book Delivery navigation' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Cart, 0 items' })).toBeVisible();
	});

	it('does not mount or hydrate a cart while Book Delivery is coming soon', () => {
		render(BooksLayout, { props: { data: { launchState: 'coming-soon' } } });

		expect(
			screen.queryByRole('navigation', { name: 'Book Delivery navigation' })
		).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
	});

	it('hydrates that cart only from the client mount callback', () => {
		const mountHydration =
			/async function hydrateCart\(\) \{[\s\S]*?await cart\.hydrate\(\);[\s\S]*?\}\s*onMount\(\(\) => \{\s*if \(isLive\) void hydrateCart\(\);\s*\}\);/;

		expect(layoutSource).toMatch(mountHydration);
		expect(layoutSource.replace(mountHydration, '')).not.toMatch(/cart\.hydrate\(/);
	});
});
