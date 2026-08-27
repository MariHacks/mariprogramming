import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ClubsPage from './+page.svelte';

afterEach(cleanup);

const CLUB = {
	id: 'club-1',
	name: 'Robotics',
	slug: 'robotics',
	category: 'stem',
	description: 'Builds robots',
	links: [{ label: 'Discord', url: 'https://example.com' }]
};

describe('clubs page', () => {
	it('explains browsing without an account', () => {
		render(ClubsPage, {
			props: {
				data: {
					clubs: [],
					pending: [],
					query: '',
					category: '',
					categories: [],
					signedIn: false,
					staff: false
				}
			}
		});
		expect(screen.getByRole('heading', { name: 'Clubs at Marianopolis' })).toBeInTheDocument();
		expect(screen.getByText(/Verified student groups/)).toBeInTheDocument();
		expect(screen.getByText('No published clubs yet.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
	});

	it('lists published clubs and the submit form when signed in', () => {
		render(ClubsPage, {
			props: {
				data: {
					clubs: [CLUB],
					pending: [],
					query: '',
					category: '',
					categories: ['stem'],
					signedIn: true,
					staff: false
				}
			}
		});
		expect(screen.getByText('Robotics')).toBeInTheDocument();
		expect(screen.getByText('Builds robots')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Open listing/ })).toHaveAttribute(
			'href',
			'/tools/clubs/robotics'
		);
		expect(screen.getByText('See listing')).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /Discord/ })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Send for review' })).toBeInTheDocument();
		expect(screen.queryByText(/2530622/)).not.toBeInTheDocument();
	});

	it('lets staff publish pending listings', () => {
		render(ClubsPage, {
			props: {
				data: {
					clubs: [CLUB],
					pending: [
						{
							id: 'sub-1',
							name: 'Chess',
							category: 'games',
							description: 'Play weekly'
						}
					],
					query: 'robot',
					category: 'stem',
					categories: ['stem'],
					signedIn: true,
					staff: true
				},
				form: { published: true }
			}
		});
		expect(screen.getByText('Chess')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
		expect(screen.getByText('Published.')).toBeInTheDocument();
	});

	it('links clubs without external URLs to their detail page', () => {
		render(ClubsPage, {
			props: {
				data: {
					clubs: [{ ...CLUB, links: [] }],
					pending: [],
					query: '',
					category: '',
					categories: ['stem'],
					signedIn: false,
					staff: false
				}
			}
		});
		expect(screen.getByRole('link', { name: /Open listing/ })).toHaveAttribute(
			'href',
			'/tools/clubs/robotics'
		);
	});

	it('shows empty pending states', () => {
		render(ClubsPage, {
			props: {
				data: {
					clubs: [],
					pending: [],
					query: '',
					category: '',
					categories: [],
					signedIn: true,
					staff: true,
					unavailable: true
				},
				form: { submitted: true, error: 'Check the club details and try again.' }
			}
		});
		expect(screen.getByText('Clubs are unavailable right now. Try again.')).toBeInTheDocument();
		expect(screen.getByText('No pending submissions.')).toBeInTheDocument();
		expect(screen.getByText('Sent for review.')).toBeInTheDocument();
	});
});
