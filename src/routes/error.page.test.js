import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clubContent } from '$lib/content/club';

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');

	return {
		page: writable({
			status: 404,
			error: { message: 'Not Found' }
		})
	};
});

import { page } from '$app/stores';
import ErrorPage from './+error.svelte';

const testPage = /** @type {{ set: (value: { status: number, error: Error | null }) => void }} */ (
	/** @type {unknown} */ (page)
);

beforeEach(() => {
	testPage.set({ status: 404, error: new Error('Not Found') });
});

afterEach(cleanup);

describe('club error route', () => {
	it('turns a missing route into a calm, human-readable recovery page', () => {
		const { container } = render(ErrorPage);

		expect(
			screen.getByRole('heading', { level: 1, name: 'We couldn’t find that page.' })
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(screen.getByText('Status 404')).toBeInTheDocument();
		expect(screen.getByText('Not Found')).toBeInTheDocument();
		expect(document.title).toBe(`Page not found | ${clubContent.name}`);
	});

	it('offers an obvious home action and a compact local club index', () => {
		render(ErrorPage);

		expect(screen.getByRole('link', { name: 'Return to club home' })).toHaveAttribute('href', '/');
		expect(screen.getByRole('link', { name: 'Browse workshops' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		expect(screen.getByRole('link', { name: 'Check events' })).toHaveAttribute('href', '/events');
		expect(screen.getByRole('link', { name: 'Open resources' })).toHaveAttribute(
			'href',
			'/resources'
		);
	});

	it('keeps the current centralized community path secure', () => {
		render(ErrorPage);

		const communityLink = screen.getByRole('link', {
			name: clubContent.communityAction.label
		});

		expect(communityLink).toHaveAttribute('href', clubContent.communityAction.url);
		expect(communityLink).toHaveAttribute('target', '_blank');
		expect(communityLink).toHaveAttribute('rel', 'external noopener noreferrer');
	});

	it('handles an unavailable page without interpreting an error message as markup', () => {
		testPage.set({ status: 500, error: new Error('<img src=x onerror=alert(1)>') });
		const { container } = render(ErrorPage);

		expect(
			screen.getByRole('heading', { level: 1, name: 'This page is unavailable.' })
		).toBeInTheDocument();
		expect(screen.getByText('Status 500')).toBeInTheDocument();
		expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
		expect(container.querySelector('img')).not.toBeInTheDocument();
		expect(document.title).toBe(`Page unavailable | ${clubContent.name}`);
	});

	it('does not leak legacy or Book Delivery recovery content into the club page', () => {
		const { container } = render(ErrorPage);

		expect(container).not.toHaveTextContent(/discord|fall 2024|coming soon/i);
		expect(container).not.toHaveTextContent(
			/\bcart\b|checkout|pickup|service fee|book delivery|wayne|\$[0-9]/i
		);
		expect(container.querySelector('.alert')).not.toBeInTheDocument();
		expect(
			screen.queryByRole('link', { name: /cart|checkout|book delivery/i })
		).not.toBeInTheDocument();
	});

	it('keeps inquiry and bug mailto links visible without JavaScript', () => {
		render(ErrorPage);
		const contact = screen.getByRole('navigation', { name: 'Club contact' });
		expect(within(contact).getByRole('link', { name: 'Email the team' })).toHaveAttribute(
			'href',
			'mailto:team@marihacks.com?subject=Programming%20Club%20inquiry'
		);
		expect(within(contact).getByRole('link', { name: 'Report a bug' })).toHaveAttribute(
			'href',
			'mailto:team@marihacks.com?subject=Programming%20Club%20bug%20report'
		);
	});
});
