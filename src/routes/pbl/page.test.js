import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import PblPage from './+page.svelte';

afterEach(cleanup);

describe('PBL hub', () => {
	it('lists PBL 1 ahead of the workshop archive', () => {
		render(PblPage);
		expect(
			screen.getByRole('heading', { level: 1, name: 'Workshops' })
		).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { level: 2, name: 'Speedrun Programming in Science' })
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open PBL 1' })).toHaveAttribute('href', '/pbl/science');
		expect(screen.getByRole('link', { name: 'Workshop archive' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		expect(document.title).toBe(`Workshops | ${clubContent.name}`);
	});
});
