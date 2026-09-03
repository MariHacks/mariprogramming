import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ToolsHome from './+page.svelte';

afterEach(cleanup);

describe('tools home', () => {
	it('names MariTools and the six tools', () => {
		render(ToolsHome);
		expect(screen.getByRole('heading', { level: 1, name: 'MariTools' })).toBeInTheDocument();
		expect(
			screen.getByText(
				'Plan your schedule, compare free time, browse course outlines, and connect with clubs and classmates.'
			)
		).toBeInTheDocument();
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
