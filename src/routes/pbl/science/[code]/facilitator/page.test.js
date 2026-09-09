import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			params: { code: 'AB23JK' },
			url: new URL('http://localhost/pbl/science/AB23JK/facilitator')
		})
	};
});

import FacilitatorPage from './+page.svelte';

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('facilitator view', () => {
	it('shows the team snapshot', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						code: 'AB23JK',
						teamName: 'Lab table 3',
						currentStep: 2,
						stepEnteredAt: new Date().toISOString(),
						lastCheck: { passed: true, message: 'First, last, and length are correct.' },
						openedHints: { '1': 2 },
						memberCount: 3
					})
				)
			)
		);
		render(FacilitatorPage);
		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Team Lab table 3' })).toBeInTheDocument();
		});
		expect(screen.getByText(/Collections, indexing/)).toBeInTheDocument();
		expect(screen.getByText(/passed/)).toBeInTheDocument();
		expect(screen.getByText(/step 1 hint 2/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Student page' })).toHaveAttribute(
			'href',
			'/pbl/science/AB23JK'
		);
	});

	it('shows a room error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ error: 'Room not found.' }), { status: 404 }))
		);
		render(FacilitatorPage);
		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Room not found.');
		});
	});
});
