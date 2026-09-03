import { cleanup, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asOfDate, explicitTermId } from '$lib/maritools/term/session.js';

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');

	return {
		page: writable({
			url: { pathname: '/tools', searchParams: new URLSearchParams() },
			data: {}
		})
	};
});

import { page } from '$app/stores';
import ToolsLayout from './+layout.svelte';

const testPage = /** @type {{ set: (value: { url: { pathname: string, searchParams?: URLSearchParams }, data?: Record<string, unknown> }) => void }} */ (
	/** @type {unknown} */ (page)
);

afterEach(() => {
	cleanup();
	explicitTermId.set(null);
	asOfDate.set(null);
});

describe('tools layout', () => {
	beforeEach(() => {
		window.matchMedia = vi.fn().mockImplementation((query) => ({
			matches: false,
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		}));
		testPage.set({ url: { pathname: '/tools', searchParams: new URLSearchParams() }, data: {} });
		explicitTermId.set(null);
		asOfDate.set(null);
	});

	it('keeps term selection out of the global tools navigation', () => {
		const { container } = render(ToolsLayout);

		expect(screen.queryByLabelText('Term')).not.toBeInTheDocument();
		expect(screen.queryByRole('combobox', { name: 'Term' })).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent('Made by the Programming Club.');
		expect(container).not.toHaveTextContent('A Programming Club initiative.');
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
			url: { pathname: '/tools/forum/abc', searchParams: new URLSearchParams() },
			data: {}
		});
		render(ToolsLayout);
		const nav = screen.getByRole('navigation', { name: 'MariTools' });

		expect(within(nav).getByRole('link', { name: 'Forum' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(within(nav).getByRole('link', { name: 'Schedule' })).not.toHaveAttribute('aria-current');
	});

	it('collapses the sidebar while signup is incomplete', () => {
		testPage.set({
			url: { pathname: '/tools/account', searchParams: new URLSearchParams() },
			data: { onboardingPending: true }
		});
		const { container } = render(ToolsLayout);

		expect(container.querySelector('.tools-shell')).toHaveClass('tools-shell--onboarding');
		expect(screen.queryByRole('navigation', { name: 'MariTools' })).not.toBeInTheDocument();
	});

	it('treats the closed mobile sidebar as hidden and inert', () => {
		window.matchMedia = vi.fn().mockImplementation((query) => ({
			matches: query.includes('max-width'),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		}));
		const { container } = render(ToolsLayout);
		const sidebar = container.querySelector('#tools-sidebar');

		expect(sidebar).toHaveAttribute('aria-hidden', 'true');
		expect((/** @type {HTMLElement & { inert: boolean }} */ (sidebar)).inert).toBe(true);
	});

	it('moves focus into the drawer and restores it after Escape', async () => {
		window.matchMedia = vi.fn().mockImplementation((query) => ({
			matches: query.includes('max-width'),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		}));
		const user = userEvent.setup();
		render(ToolsLayout);
		const trigger = screen.getByRole('button', { name: 'Tools' });

		await user.click(trigger);
		expect(screen.getByText('Close')).toHaveFocus();
		expect(document.body.style.overflow).toBe('hidden');

		await user.keyboard('{Escape}');
		expect(trigger).toHaveFocus();
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(document.body.style.overflow).toBe('');
	});

	it('closes the drawer on navigation and restores body overflow on teardown', async () => {
		window.matchMedia = vi.fn().mockImplementation((query) => ({
			matches: query.includes('max-width'),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		}));
		const user = userEvent.setup();
		const { unmount } = render(ToolsLayout);
		const trigger = screen.getByRole('button', { name: 'Tools' });

		await user.click(trigger);
		expect(document.body.style.overflow).toBe('hidden');

		testPage.set({ url: { pathname: '/tools/forum', searchParams: new URLSearchParams() }, data: {} });
		await Promise.resolve();
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(document.body.style.overflow).toBe('');

		await user.click(trigger);
		unmount();
		expect(document.body.style.overflow).toBe('');
	});
});
