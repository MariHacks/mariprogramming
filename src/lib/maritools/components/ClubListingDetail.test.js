import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ClubListingDetail from './ClubListingDetail.svelte';

afterEach(cleanup);

const CLUB = {
	name: 'Robotics',
	category: 'stem',
	description: 'Builds robots',
	links: [
		{ type: 'discord', label: 'Discord', url: 'https://example.com' },
		{ type: 'email', label: 'Email', url: 'mailto:robotics@example.com' }
	]
};

describe('ClubListingDetail', () => {
	it('renders the published layout in view mode', () => {
		render(ClubListingDetail, { props: { mode: 'view', club: CLUB } });
		expect(screen.getByRole('heading', { name: 'Robotics' })).toBeInTheDocument();
		expect(screen.getByText('Builds robots')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Discord/ })).toHaveAttribute(
			'href',
			'https://example.com'
		);
		expect(screen.getByTestId('club-listing-detail')).toHaveAttribute('data-mode', 'view');
		expect(screen.queryByTestId('club-edit-name')).not.toBeInTheDocument();
	});

	it('exposes editable fields in edit mode', () => {
		render(ClubListingDetail, { props: { mode: 'edit', club: CLUB } });
		expect(screen.getByTestId('club-edit-name')).toHaveValue('Robotics');
		expect(screen.getByTestId('club-edit-category')).toHaveValue('stem');
		expect(screen.getByTestId('club-edit-description')).toHaveValue('Builds robots');
		expect(screen.getByRole('combobox', { name: 'Your role' })).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('stem');
		expect(screen.getAllByRole('combobox', { name: 'Contact type' })).toHaveLength(2);
		expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
		expect(screen.getByDisplayValue('robotics@example.com')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add contact method' })).toBeInTheDocument();
		expect(screen.getByTestId('club-listing-detail')).toHaveAttribute('data-mode', 'edit');
	});

	it('shows empty copy when a listing has no description or links', () => {
		render(ClubListingDetail, {
			props: { mode: 'view', club: { name: 'Chess', links: [] } }
		});
		expect(screen.getByText('No description published yet.')).toBeInTheDocument();
		expect(screen.getByText('No links published yet.')).toBeInTheDocument();
	});

	it('shows a join CTA when a signup link exists', () => {
		render(ClubListingDetail, {
			props: {
				mode: 'view',
				club: {
					name: 'Chess',
					links: [{ label: 'Join form', url: 'https://example.com/join' }]
				}
			}
		});
		expect(screen.getByRole('link', { name: 'Sign up for the club' })).toHaveAttribute(
			'href',
			'https://example.com/join'
		);
	});

	it('does not ship fake contact values as input placeholders', () => {
		render(ClubListingDetail, { props: { mode: 'edit', club: { name: 'Chess', links: [] } } });
		const contactInput = screen.getByRole('textbox', { name: 'Link' });
		expect(contactInput).not.toHaveAttribute('placeholder');
	});
});
