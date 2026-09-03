import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FreeTimePage from './+page.svelte';

afterEach(cleanup);

describe('free-time boards page', () => {
	it('creates a board without requiring an account', () => {
		render(FreeTimePage, { props: { data: { boards: [] } } });
		expect(screen.getByRole('heading', { name: 'Your boards' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Create board' })).toBeInTheDocument();
		expect(screen.getByText('No boards yet')).toBeInTheDocument();
		expect(screen.getByText(/No account needed/)).toBeInTheDocument();
	});

	it('lists boards with member counts', () => {
		render(FreeTimePage, {
			props: {
				data: {
					boards: [
						{
							slug: 'study-group',
							title: 'Study group',
							createdAt: '2026-01-01T00:00:00.000Z',
							members: [{ availability: { free: ['Mon-09:00'] } }]
						},
						{
							slug: 'lab',
							title: 'Lab partners',
							createdAt: 'not-a-date',
							members: []
						}
					]
				}
			}
		});
		expect(screen.getByRole('link', { name: /Study group/ })).toHaveAttribute(
			'href',
			'/tools/free-time/study-group'
		);
		expect(screen.getByText('Saved')).toBeInTheDocument();
		expect(screen.getByText('Add availability')).toBeInTheDocument();
		const index = screen.getByRole('region', { name: 'Free-time boards' });
		expect(index).toHaveAttribute('tabindex', '0');
		expect(index).toHaveAttribute('aria-describedby', 'boards-scroll-cue');
		expect(screen.getByText('Swipe sideways to see all board details.')).toHaveAttribute(
			'id',
			'boards-scroll-cue'
		);
	});

	it('marks a mixed board as still needing availability', () => {
		render(FreeTimePage, {
			props: {
				data: {
					boards: [
						{
							slug: 'mixed',
							title: 'Mixed board',
							members: [
								{ availability: { free: ['Mon-09:00'] } },
								{ availability: { free: [] } }
							]
						}
					]
				}
			}
		});
		expect(screen.getByText('Add availability')).toBeInTheDocument();
	});

	it('explains create errors and unavailable boards', () => {
		render(FreeTimePage, {
			props: {
				data: { boards: [], unavailable: true },
				form: { createError: 'Enter a board title and term.' }
			}
		});
		expect(screen.getByText('Enter a board title and term.')).toBeInTheDocument();
		expect(screen.getByText(/Boards are unavailable/)).toBeInTheDocument();
	});
});
