import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import EventList from './EventList.svelte';

afterEach(cleanup);

describe('EventList', () => {
	it('turns an unconfirmed schedule into a useful community action', () => {
		const { container } = render(EventList, { props: { events: [] } });

		const emptyHeading = screen.getByRole('heading', {
			level: 3,
			name: 'No upcoming events are listed.'
		});
		expect(emptyHeading).not.toHaveAttribute('aria-label');
		expect(emptyHeading).toHaveTextContent('No upcoming events are listed.');
		const communityLink = screen.getByRole('link', {
			name: clubContent.communityAction.label
		});

		expect(communityLink).toHaveAttribute('href', clubContent.communityAction.url);
		expect(communityLink).toHaveAttribute('target', '_blank');
		expect(communityLink).toHaveAttribute('rel', 'external noopener noreferrer');
		expect(container.querySelector('ul, ol')).not.toBeInTheDocument();
		expect(screen.queryByText('Planning')).not.toBeInTheDocument();
	});

	it('renders supplied events as an accessible list', () => {
		const { container } = render(EventList, {
			props: {
				events: [
					{
						id: 'python-lab',
						startsAt: '2026-09-18T17:30:00Z',
						title: 'Python lab <script>alert(1)</script>',
						description: 'Build a small project with <strong>club mentors</strong>.'
					},
					{
						id: 'contest-practice',
						startsAt: '2026-09-25T20:00:00Z',
						title: 'Contest practice'
					}
				]
			}
		});

		const list = screen.getByRole('list', { name: 'Confirmed events' });
		const articles = within(list).getAllByRole('article');

		expect(articles).toHaveLength(2);
		expect(within(articles[0]).getByRole('heading', { level: 3 })).toHaveTextContent(
			'Python lab <script>alert(1)</script>'
		);
		expect(
			within(articles[0]).getByText('Build a small project with <strong>club mentors</strong>.')
		).toBeInTheDocument();
		expect(container.querySelector('script, strong')).not.toBeInTheDocument();

		const firstDate = articles[0].querySelector('time');
		expect(firstDate).toHaveAttribute('datetime', '2026-09-18T17:30:00Z');
		expect(firstDate).toHaveTextContent('September 18, 2026 at 1:30 p.m.');

		expect(within(articles[1]).getByRole('heading', { level: 3 })).toHaveTextContent(
			'Contest practice'
		);
		expect(articles[1].querySelector('.event-description')).not.toBeInTheDocument();
		expect(
			screen.queryByRole('heading', { level: 3, name: 'No upcoming events are listed.' })
		).not.toBeInTheDocument();
	});
});
