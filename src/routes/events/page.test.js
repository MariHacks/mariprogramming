import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import EventsPage from './+page.svelte';

const events =
	/** @type {Array<{
	 * id: string,
	 * startsAt: string,
	 * title: string,
	 * description?: string
	 * }>} */ (clubContent.events);

afterEach(() => {
	cleanup();
	events.splice(0);
});

describe('events route', () => {
	it('introduces a confirmed-only schedule without repeated framing', () => {
		const { container } = render(EventsPage);

		expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(screen.getByRole('heading', { level: 2, name: 'Upcoming' })).toBeInTheDocument();
		expect(container).not.toHaveTextContent('Confirmed club events are listed here.');
		expect(document.title).toBe(`Events | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			'Confirmed Marianopolis Programming Club event dates.'
		);
	});

	it('lets the shared event list own the current empty schedule and community action', () => {
		render(EventsPage);

		expect(screen.getByText('No upcoming events are listed.')).toBeInTheDocument();
		const communityLink = screen.getByRole('link', {
			name: clubContent.communityAction.label
		});

		expect(communityLink).toHaveAttribute('href', clubContent.communityAction.url);
		expect(communityLink).toHaveAttribute('target', '_blank');
		expect(communityLink).toHaveAttribute('rel', 'external noopener noreferrer');
		expect(screen.getAllByRole('region', { name: 'Event schedule status' })).toHaveLength(1);
	});

	it('renders a future confirmed event from the centralized model without route changes', () => {
		events.push({
			id: 'fall-build-session',
			startsAt: '2099-09-18T21:30:00Z',
			title: 'Fall build session',
			description: 'Bring an idea or join a project team.'
		});

		render(EventsPage);

		expect(screen.getByRole('list', { name: 'Confirmed events' })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { level: 3, name: 'Fall build session' })
		).toBeInTheDocument();
		expect(screen.getByText('Bring an idea or join a project team.')).toBeInTheDocument();
		expect(
			screen.queryByRole('heading', { level: 3, name: 'No upcoming events are listed' })
		).not.toBeInTheDocument();
	});

	it('offers useful workshop and Discord alternatives without stale schedule leakage', () => {
		const { container } = render(EventsPage);

		expect(screen.getByRole('link', { name: 'Browse workshop archive' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		expect(screen.getByRole('link', { name: 'Browse resources' })).toHaveAttribute(
			'href',
			'/resources'
		);
		expect(screen.getByRole('link', { name: 'Join Discord' })).toHaveAttribute(
			'href',
			'https://discord.gg/c6JJw9d'
		);
		expect(
			screen.queryByRole('heading', { level: 2, name: 'Workshop archive' })
		).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent(/fall 2024|winter 2024|coming soon/i);
		expect(container).not.toHaveTextContent(
			/\bcart\b|checkout|pickup|service fee|book delivery|\$[0-9]/i
		);
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
	});
});
