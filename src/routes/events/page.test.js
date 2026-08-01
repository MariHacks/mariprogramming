import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import EventsPage from './+page.svelte';

const events = /** @type {Array<{
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
	it('introduces a durable confirmed-events schedule with useful metadata', () => {
		const { container } = render(EventsPage);

		expect(
			screen.getByRole('heading', { level: 1, name: 'Events, once they’re confirmed' })
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(screen.getByText(/every confirmed club event will appear here/i)).toBeInTheDocument();
		expect(document.title).toBe(`Events | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			'Find confirmed Marianopolis Programming Club event dates and use the workshop archive between sessions.'
		);
	});

	it('lets the shared event list own the current empty schedule and community action', () => {
		render(EventsPage);

		expect(
			screen.getByRole('heading', { level: 3, name: 'New events are being planned' })
		).toBeInTheDocument();
		expect(
			screen.getByText('Dates will appear here after they are confirmed.')
		).toBeInTheDocument();

		const communityLink = screen.getByRole('link', {
			name: clubContent.communityAction.label
		});

		expect(communityLink).toHaveAttribute('href', clubContent.communityAction.url);
		expect(communityLink).toHaveAttribute('target', '_blank');
		expect(communityLink).toHaveAttribute('rel', 'noopener noreferrer');
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
			screen.queryByRole('heading', { level: 3, name: 'New events are being planned' })
		).not.toBeInTheDocument();
	});

	it('offers one useful local alternative without commerce or stale schedule leakage', () => {
		const { container } = render(EventsPage);

		expect(screen.getByRole('link', { name: 'Browse workshop archive' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		expect(container).not.toHaveTextContent(/discord|fall 2024|winter 2024|coming soon/i);
		expect(container).not.toHaveTextContent(
			/\bcart\b|checkout|pickup|service fee|book delivery|\$[0-9]/i
		);
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
	});
});
