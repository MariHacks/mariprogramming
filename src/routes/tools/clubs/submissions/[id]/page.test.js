import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SubmissionPage from './+page.svelte';

afterEach(cleanup);

const SUBMISSION = {
	id: 'sub-1',
	status: 'pending',
	submitterRole: 'officer',
	name: 'Chess',
	category: 'games',
	description: 'Play',
	links: [{ label: 'Site', url: 'https://example.com' }]
};

describe('club submission page', () => {
	it('shows editable detail and submitter role for the creator', () => {
		render(SubmissionPage, {
			props: {
				data: {
					submission: SUBMISSION,
					canEdit: true,
					canPublish: false,
					staff: false,
					isOwner: true
				}
			}
		});
		expect(screen.getByTestId('submitter-role')).toHaveTextContent('Officer or organizer');
		expect(screen.getByTestId('club-edit-name')).toHaveValue('Chess');
		expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
	});

	it('lets staff publish from the same surface', () => {
		render(SubmissionPage, {
			props: {
				data: {
					submission: SUBMISSION,
					canEdit: true,
					canPublish: true,
					staff: true,
					isOwner: false
				},
				form: { saved: true }
			}
		});
		expect(screen.getByText('Review')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Reject' })).toHaveAttribute(
			'formaction',
			'?/reject'
		);
		expect(screen.getByText('Saved.')).toBeInTheDocument();
	});

	it('lets staff reject from the read-only review surface', () => {
		render(SubmissionPage, {
			props: {
				data: {
					submission: SUBMISSION,
					canEdit: false,
					canPublish: true,
					staff: true,
					isOwner: false
				}
			}
		});
		expect(screen.getByRole('button', { name: 'Reject' })).toHaveAttribute(
			'formaction',
			'?/reject'
		);
	});

	it('shows a missing submission', () => {
		render(SubmissionPage, {
			props: { data: { submission: null, notFound: true, canEdit: false, canPublish: false } }
		});
		expect(screen.getByText('That club submission is not available.')).toBeInTheDocument();
	});
});
