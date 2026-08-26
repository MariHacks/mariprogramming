import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');

	return {
		page: writable({
			url: { pathname: '/tools' }
		})
	};
});

import { page } from '$app/stores';
import ToolsLayout from './+layout.svelte';

const testPage = /** @type {{ set: (value: { url: { pathname: string } }) => void }} */ (
	/** @type {unknown} */ (page)
);

afterEach(cleanup);

describe('tools layout', () => {
	beforeEach(() => {
		testPage.set({ url: { pathname: '/tools' } });
	});

	it('does not expose a term picker or club initiative line', () => {
		const { container } = render(ToolsLayout);

		expect(screen.queryByLabelText('Term')).not.toBeInTheDocument();
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent('Made by the Programming Club.');
		expect(container).not.toHaveTextContent('A Programming Club initiative.');
		expect(container).not.toHaveTextContent(/Showing Fall 2026/i);
	});

	it('groups MariTools destinations by section in the sidebar', () => {
		render(ToolsLayout);
		const nav = screen.getByRole('navigation', { name: 'MariTools' });

		expect(within(nav).getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
		expect(within(nav).getByRole('heading', { name: 'Courses' })).toBeInTheDocument();
		expect(within(nav).getByRole('heading', { name: 'Student life' })).toBeInTheDocument();
		expect(within(nav).getByRole('link', { name: 'Schedule' })).toHaveAttribute(
			'href',
			'/tools/schedule'
		);
		expect(within(nav).getByRole('link', { name: 'Free time' })).toHaveAttribute(
			'href',
			'/tools/free-time'
		);
		expect(within(nav).getByRole('link', { name: 'Semester' })).toHaveAttribute(
			'href',
			'/tools/semester'
		);
		expect(within(nav).getByRole('link', { name: 'Catalog' })).toHaveAttribute(
			'href',
			'/tools/catalog'
		);
		expect(within(nav).getByRole('link', { name: 'Clubs' })).toHaveAttribute(
			'href',
			'/tools/clubs'
		);
		expect(within(nav).getByRole('link', { name: 'Forum' })).toHaveAttribute(
			'href',
			'/tools/forum'
		);
		expect(within(nav).queryByRole('link', { name: 'Account' })).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Back to club home' })).toHaveAttribute('href', '/');
	});

	it('marks the active tool in the sidebar', () => {
		testPage.set({ url: { pathname: '/tools/forum/abc' } });
		render(ToolsLayout);
		const nav = screen.getByRole('navigation', { name: 'MariTools' });

		expect(within(nav).getByRole('link', { name: 'Forum' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(within(nav).getByRole('link', { name: 'Schedule' })).not.toHaveAttribute('aria-current');
	});
});
