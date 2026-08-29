import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asOfDate, explicitTermId } from '$lib/maritools/term/session.js';

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');

	return {
		page: writable({
			url: { pathname: '/tools', searchParams: new URLSearchParams() }
		})
	};
});

import { page } from '$app/stores';
import ToolsLayout from './+layout.svelte';

const testPage = /** @type {{ set: (value: { url: { pathname: string, searchParams?: URLSearchParams } }) => void }} */ (
	/** @type {unknown} */ (page)
);

afterEach(() => {
	cleanup();
	explicitTermId.set(null);
	asOfDate.set(null);
});

describe('tools layout', () => {
	beforeEach(() => {
		testPage.set({ url: { pathname: '/tools', searchParams: new URLSearchParams() } });
		explicitTermId.set(null);
		asOfDate.set(null);
	});

	it('exposes a lean term picker without club initiative copy', () => {
		const { container } = render(ToolsLayout);

		expect(screen.getByLabelText('Term')).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Term' })).toBeInTheDocument();
		expect(container).not.toHaveTextContent('Made by the Programming Club.');
		expect(container).not.toHaveTextContent('A Programming Club initiative.');
	});

	it('on a gap date shows unavailable and still accepts Fall 2026', async () => {
		asOfDate.set('2027-01-05');
		render(ToolsLayout);

		expect(screen.getByRole('status')).toHaveTextContent(
			'Current-term data is unavailable.'
		);

		await fireEvent.change(screen.getByRole('combobox', { name: 'Term' }), {
			target: { value: 'fall-2026' }
		});

		expect(screen.getByRole('status')).toHaveTextContent('Showing Fall 2026.');
		expect(screen.getByRole('combobox', { name: 'Term' })).toHaveValue('fall-2026');
	});

	it('honors an asOf search param for gap-date proofs', () => {
		testPage.set({
			url: {
				pathname: '/tools',
				searchParams: new URLSearchParams('asOf=2027-01-05')
			}
		});
		render(ToolsLayout);

		expect(screen.getByRole('status')).toHaveTextContent(
			'Current-term data is unavailable.'
		);
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
		testPage.set({
			url: { pathname: '/tools/forum/abc', searchParams: new URLSearchParams() }
		});
		render(ToolsLayout);
		const nav = screen.getByRole('navigation', { name: 'MariTools' });

		expect(within(nav).getByRole('link', { name: 'Forum' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(within(nav).getByRole('link', { name: 'Schedule' })).not.toHaveAttribute('aria-current');
	});
});
