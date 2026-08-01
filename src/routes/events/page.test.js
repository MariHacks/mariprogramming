import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import EventsPage from './+page.svelte';

afterEach(cleanup);

describe('events route', () => {
	it('gives students one honest route to confirmed event announcements', () => {
		const { container } = render(EventsPage);

		expect(
			screen.getByRole('heading', { level: 1, name: 'New club events are in the works' })
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(
			screen.getByRole('heading', { level: 2, name: 'Follow the next announcement' })
		).toBeInTheDocument();

		const communityLink = screen.getByRole('link', {
			name: clubContent.communityAction.label
		});

		expect(communityLink).toHaveAttribute('href', clubContent.communityAction.url);
		expect(communityLink).toHaveAttribute('target', '_blank');
		expect(communityLink).toHaveAttribute('rel', 'noopener noreferrer');
		expect(container).not.toHaveTextContent(/coming soon|fall 2024|winter 2024/i);
	});

	it('describes the current events page in document metadata', () => {
		render(EventsPage);

		expect(document.title).toBe(`Events | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			'Find the next Marianopolis Programming Club event announcement and stay connected with the club.'
		);
	});
});
