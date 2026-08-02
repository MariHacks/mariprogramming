import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BooksLayout from './+layout.svelte';
import layoutSource from './+layout.svelte?raw';

afterEach(() => {
	cleanup();
});

describe('Book Delivery local layout', () => {
	it('owns one empty cart and mounts the Book Delivery navigation', () => {
		render(BooksLayout);

		expect(screen.getByRole('navigation', { name: 'Book Delivery navigation' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Cart, 0 items' })).toBeVisible();
	});

	it('hydrates that cart only from the client mount callback', () => {
		const mountHydration = /onMount\(\(\) => \{\s*cart\.hydrate\(\);\s*\}\);/;

		expect(layoutSource).toMatch(mountHydration);
		expect(layoutSource.replace(mountHydration, '')).not.toMatch(/cart\.hydrate\(/);
	});
});
