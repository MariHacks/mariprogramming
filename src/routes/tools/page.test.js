import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
import ToolsHome from './+page.svelte';

afterEach(cleanup);

describe('tools home', () => {
	it('names MariTools and the six tools', () => {
		render(ToolsHome);
		expect(screen.getByRole('heading', { level: 1, name: MARITOOLS_NAME })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Courses' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Student life' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /My schedule/ })).toHaveAttribute(
			'href',
			'/tools/schedule'
		);
		expect(screen.getByRole('link', { name: /Course catalog/ })).toHaveAttribute(
			'href',
			'/tools/catalog'
		);
		expect(screen.queryByText(/marketplace/i)).not.toBeInTheDocument();
	});
});
