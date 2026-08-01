import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import SiteHeader from './SiteHeader.svelte';

afterEach(cleanup);

describe('SiteHeader', () => {
	it('provides one primary route set and a safe Discord action', () => {
		render(SiteHeader, { props: { pathname: '/about-us' } });

		expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).toHaveLength(1);
		expect(
			screen.getByRole('link', { name: 'Marianopolis Programming Club, home' })
		).toHaveAttribute('href', '/');
		expect(screen.getByRole('link', { name: 'Club' })).toHaveAttribute('href', '/about-us');
		expect(screen.getByRole('link', { name: 'Workshops' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/events');
		expect(screen.getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources');

		const discordLink = screen.getByRole('link', { name: 'Join Discord' });
		expect(discordLink).toHaveAttribute('href', clubContent.joinUrl);
		expect(discordLink).toHaveAttribute('target', '_blank');
		expect(discordLink).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('makes Book Delivery discoverable without leaking cart controls', () => {
		const { container } = render(SiteHeader, { props: { pathname: '/about-us' } });

		expect(screen.getByRole('link', { name: 'Book Delivery' })).toHaveAttribute('href', '/books');
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /cart/i })).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent(/cart/i);
	});

	it('marks the section owning the current nested route', () => {
		render(SiteHeader, { props: { pathname: '/books/teachers/marie-dupont' } });

		expect(screen.getByRole('link', { name: 'Book Delivery' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(screen.getByRole('link', { name: 'Club' })).not.toHaveAttribute('aria-current');
		expect(screen.getByRole('link', { name: 'Workshops' })).not.toHaveAttribute('aria-current');
	});

	it('does not mark a route with only a shared path prefix as current', () => {
		render(SiteHeader, { props: { pathname: '/bookstore' } });

		expect(screen.getByRole('link', { name: 'Book Delivery' })).not.toHaveAttribute('aria-current');
	});

	it('uses one native control for pointer and keyboard mobile-menu behavior', async () => {
		const user = userEvent.setup();
		const { container } = render(SiteHeader, { props: { pathname: '/events' } });
		const menuButton = screen.getByRole('button', { name: 'Open navigation' });
		const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });

		expect(menuButton).toHaveAttribute('aria-expanded', 'false');
		expect(menuButton).toHaveAttribute('aria-controls', navigation.id);
		expect(menuButton).not.toHaveAttribute('data-bs-toggle');

		await user.click(menuButton);
		expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		expect(navigation).toHaveAttribute('data-open', 'true');

		await user.keyboard('{Escape}');
		expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		expect(menuButton).toHaveFocus();

		await user.keyboard(' ');
		expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		expect(container.querySelectorAll('#site-navigation')).toHaveLength(1);

		const eventsLink = screen.getByRole('link', { name: 'Events' });
		eventsLink.addEventListener('click', (event) => event.preventDefault(), { once: true });
		await user.click(eventsLink);
		expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		expect(navigation).toHaveAttribute('data-open', 'false');
	});

	it('leaves focus and menu state unchanged when Escape is pressed while closed', async () => {
		const user = userEvent.setup();
		render(SiteHeader, { props: { pathname: '/events' } });
		const homeLink = screen.getByRole('link', {
			name: 'Marianopolis Programming Club, home'
		});

		homeLink.focus();
		await user.keyboard('{Escape}');

		expect(homeLink).toHaveFocus();
		expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
	});
});
