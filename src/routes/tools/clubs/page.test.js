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
		expect(screen.getByRole('heading', { name: 'Clubs' })).toBeInTheDocument();
		expect(screen.getByText(/Campus clubs and how to reach them/)).toBeInTheDocument();
		expect(screen.getByText('No published clubs yet.')).toBeInTheDocument();
		expect(screen.getByText(/Browse stays open while we review listings/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
	});

	it('offers one clear listing entry point without inline fields', () => {
		render(ClubsPage, {
			props: {
				data: {
					clubs: [],
					pending: [],
					query: '',
					category: '',
					categories: [],
					signedIn: true,
					staff: false
				}
			}
		});
		expect(screen.getByText('No published clubs yet.')).toBeInTheDocument();
		expect(
			screen.getByText('Create a listing and we’ll review it before it goes live.')
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Create listing' })).toHaveAttribute(
			'href',
			'/tools/clubs/new'
		);
		expect(screen.queryByRole('textbox', { name: /Club name/ })).not.toBeInTheDocument();
		expect(screen.queryByTestId('submitter-role')).not.toBeInTheDocument();
	});

	it('explains when filters match nothing', () => {
		render(ClubsPage, {
			props: {
				data: {
					clubs: [],
					pending: [],
					query: 'zzzz',
					category: '',
					categories: ['stem'],
					signedIn: false,
					staff: false
				}
			}
		});
		expect(screen.getByText('No clubs match those filters.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Reset filters' })).toHaveAttribute(
			'href',
			'/tools/clubs'
		);
	});

	it('lists published clubs and the short intake when signed in', () => {
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
		expect(screen.getByRole('link', { name: 'Create listing' })).toHaveAttribute(
			'href',
			'/tools/clubs/new'
		);
		expect(screen.queryByText(/2530622/)).not.toBeInTheDocument();
	});

	it('links staff pending rows into the shared review surface', () => {
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
				}
			}
		});
		expect(screen.getByText('Chess')).toBeInTheDocument();
		expect(screen.getByTestId('review-submission')).toHaveAttribute(
			'href',
			'/tools/clubs/submissions/sub-1'
		);
		expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
		const pending = screen.getByTestId('staff-pending-clubs');
		const robotics = screen.getByRole('heading', { name: 'Robotics' });
		expect(
			pending.compareDocumentPosition(robotics) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
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
				form: { error: 'Check the club details and try again.' }
			}
		});
		expect(screen.getByText('Clubs are unavailable right now. Try again.')).toBeInTheDocument();
		expect(
			screen.getByText('Club submissions are unavailable right now. Try again later.')
		).toBeInTheDocument();
	});
});
