import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ClubDetailPage from './+page.svelte';

afterEach(cleanup);

const CLUB = {
	id: 'club-1',
	name: 'Robotics',
	slug: 'robotics',
	category: 'stem',
	description: 'Builds robots',
	links: [{ label: 'Discord', url: 'https://example.com' }]
};

describe('club detail page', () => {
	it('shows a missing club', () => {
		render(ClubDetailPage, { props: { data: { club: null, notFound: true } } });
		expect(screen.getByText('That club is not available.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'All clubs' })).toHaveAttribute('href', '/tools/clubs');
	});

	it('shows an unavailable club', () => {
		render(ClubDetailPage, {
			props: { data: { club: null, unavailable: true } }
		});
		expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
	});

	it('renders club details without leaking student numbers', () => {
		render(ClubDetailPage, { props: { data: { club: CLUB } } });
		expect(screen.getByRole('heading', { name: 'Robotics' })).toBeInTheDocument();
		expect(screen.getByText('Builds robots')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Discord/ })).toHaveAttribute('href', 'https://example.com');
		expect(screen.queryByText(/2530622/)).not.toBeInTheDocument();
	});

	it('renders links without labels', () => {
		render(ClubDetailPage, {
			props: {
				data: {
					club: {
						...CLUB,
						links: [{ url: 'https://example.com/join' }]
					}
				}
			}
		});
		expect(screen.getByRole('link', { name: /example.com\/join/ })).toHaveAttribute(
			'href',
			'https://example.com/join'
		);
	});

	it('shows empty states for clubs without description or links', () => {
		render(ClubDetailPage, {
			props: {
				data: {
					club: { ...CLUB, description: null, links: [] }
				}
			}
		});
		expect(screen.getByText('No description published yet.')).toBeInTheDocument();
		expect(screen.getByText('No links published yet.')).toBeInTheDocument();
	});
});
