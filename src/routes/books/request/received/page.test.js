import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => ({
	page: {
		url: new URL('https://club.example.com/books/request/received?reference=REQ-ABCDEFGH2345')
	}
}));

import ReceivedPage from './+page.svelte';

afterEach(cleanup);

describe('book request received page', () => {
	it('shows the public request number and a team mailbox', () => {
		render(ReceivedPage);
		expect(screen.getByRole('heading', { name: 'We received your request' })).toBeVisible();
		expect(screen.getByText('REQ-ABCDEFGH2345')).toBeVisible();
		expect(screen.getByRole('link', { name: 'Email the team' })).toHaveAttribute(
			'href',
			'mailto:team@marihacks.com?subject=Programming%20Club%20inquiry'
		);
		expect(screen.getByRole('link', { name: 'Back to the book catalogue' })).toHaveAttribute(
			'href',
			'/books'
		);
	});
});
