import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import SiteHeader from './SiteHeader.svelte';
import siteHeaderSource from './SiteHeader.svelte?raw';

afterEach(cleanup);

describe('SiteHeader', () => {
	it('provides one primary route set', () => {
		render(SiteHeader, { props: { pathname: '/about-us' } });
		const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });

		expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).toHaveLength(1);
		expect(
			screen.getByRole('link', { name: 'Marianopolis Programming Club, home' })
		).toHaveAttribute('href', '/');
		expect(within(navigation).getByRole('link', { name: 'About' })).toHaveAttribute(
			'href',
			'/about-us'
		);
		expect(within(navigation).getByRole('link', { name: 'Events' })).toHaveAttribute(
			'href',
			'/events'
		);
		expect(within(navigation).getByRole('link', { name: 'Workshops' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		expect(within(navigation).getByRole('link', { name: 'MariTools' })).toHaveAttribute(
			'href',
			'/tools'
		);
		expect(
			within(navigation).queryByRole('link', { name: 'Mini-Competitions' })
		).not.toBeInTheDocument();
		expect(within(navigation).queryByRole('link', { name: 'Resources' })).not.toBeInTheDocument();
	});

	it('renders the verified Sign up action once', () => {
		render(SiteHeader, { props: { pathname: '/' } });

		const signUpLinks = screen.getAllByRole('link', { name: 'Sign up' });

		expect(signUpLinks).toHaveLength(1);
		expect(signUpLinks[0]).toHaveAttribute('href', clubContent.signupUrl);
		expect(signUpLinks[0]).not.toHaveAttribute('target');
	});

	it('places Sign up in the top-right actions when signed out', () => {
		const { container } = render(SiteHeader, {
			props: { pathname: '/', headerAccount: { kind: 'signed-out' } }
		});
		const actions = container.querySelector('.header-actions');
		if (!(actions instanceof HTMLElement)) throw new Error('Header actions are required');

		expect(within(actions).getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
		expect(within(actions).queryByRole('link', { name: 'Account' })).not.toBeInTheDocument();
		expect(within(actions).queryByRole('button', { name: /Maya/i })).not.toBeInTheDocument();
	});

	it('shows an identity menu instead of Sign up when signed in', async () => {
		const user = userEvent.setup();
		const { container } = render(SiteHeader, {
			props: {
				pathname: '/tools/account',
				headerAccount: {
					kind: 'signed-in',
					displayName: 'Maya Singh',
					initials: 'MS'
				}
			}
		});
		const actions = container.querySelector('.header-actions');
		if (!(actions instanceof HTMLElement)) throw new Error('Header actions are required');

		expect(within(actions).queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
		const identity = within(actions).getByRole('button', { name: /Maya Singh/i });
		expect(identity).toHaveTextContent('MS');

		await user.click(identity);
		expect(screen.getByRole('link', { name: 'Your account' })).toHaveAttribute(
			'href',
			'/tools/account'
		);
		expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
	});

	it('shows the saved profile picture in the signed-in identity chip', () => {
		const { container } = render(SiteHeader, {
			props: {
				pathname: '/tools/account',
				headerAccount: {
					kind: 'signed-in',
					displayName: 'Maya Singh',
					initials: 'MS',
					profileImageDataUrl: 'data:image/png;base64,YXZhdGFy'
				}
			}
		});

		const identity = container.querySelector('.identity-button');
		expect(identity?.querySelector('img')).toHaveAttribute(
			'src',
			'data:image/png;base64,YXZhdGFy'
		);
		expect(identity).not.toHaveTextContent('MS');
	});

	it('keeps the utility cluster on one header row so Sign up cannot wrap under the bar', () => {
		expect(siteHeaderSource).toMatch(
			/\.header-frame\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/u
		);
		expect(siteHeaderSource).not.toMatch(
			/\.header-frame\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto auto/u
		);
		expect(siteHeaderSource).toMatch(/\.header-actions\s*\{[^}]*flex-wrap:\s*nowrap/u);
		expect(siteHeaderSource).toMatch(/\.signup-link\s*\{[^}]*white-space:\s*nowrap/u);
		expect(siteHeaderSource).not.toMatch(/\.header-contact\s*\{[^}]*max-width:\s*12\.5rem/u);
	});

	it('places the mailbox with Instagram and Discord after Report a bug', () => {
		const { container } = render(SiteHeader, { props: { pathname: '/' } });
		const actions = container.querySelector('.header-actions');
		const socials = actions?.querySelector('.header-socials');

		expect(actions?.querySelector('.header-contact')).not.toBeNull();
		expect(actions?.querySelector('.signup-link')).not.toBeNull();
		expect(
			[...(socials?.querySelectorAll('a') ?? [])].map((link) => link.getAttribute('aria-label'))
		).toEqual(['Email the team', 'Instagram', 'Discord']);
	});

	it('provides full, compact, and mobile navigation structures for the three responsive modes', () => {
		const { container } = render(SiteHeader, { props: { pathname: '/tools' } });

		const wide = screen.getByRole('navigation', { name: 'Primary navigation' });
		const compact = screen.getByRole('navigation', { name: 'Compact navigation' });
		const mobile = container.querySelector('#mobile-navigation');

		expect(wide).toHaveAttribute('data-navigation-mode', 'wide');
		expect(compact).toHaveAttribute('data-navigation-mode', 'compact');
		expect(mobile).toHaveAttribute('data-navigation-mode', 'mobile');
		expect(within(compact).getByRole('button', { name: 'More' })).toHaveAttribute(
			'aria-controls',
			'compact-more-menu'
		);
		expect(container.querySelector('#compact-more-menu a[href="/tools"]')).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(container.querySelector('.site-header')).toHaveAttribute(
			'data-shell-version',
			'editorial'
		);
	});

	it('keeps closed disclosure links out of the accessibility and tab trees', () => {
		const { container } = render(SiteHeader, { props: { pathname: '/' } });
		const compact = screen.getByRole('navigation', { name: 'Compact navigation' });
		const moreMenu = container.querySelector('#compact-more-menu');
		const mobileNavigation = container.querySelector('#mobile-navigation');

		expect(within(compact).queryByRole('link', { name: 'MariTools' })).not.toBeInTheDocument();
		expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
		expect(moreMenu).toHaveAttribute('aria-hidden', 'true');
		expect(mobileNavigation).toHaveAttribute('aria-hidden', 'true');
		for (const link of container.querySelectorAll('#compact-more-menu a, #mobile-navigation a')) {
			expect(link).toHaveAttribute('tabindex', '-1');
		}
	});

	it('uses the original light-bulb asset alongside a visible club name', () => {
		const { container } = render(SiteHeader, { props: { pathname: '/' } });
		const brand = screen.getByRole('link', { name: 'Marianopolis Programming Club, home' });

		expect(brand.querySelector('img')).toHaveAttribute('src', '/logo-icon.svg');
		expect(within(brand).getByText('Marianopolis')).toBeInTheDocument();
		expect(within(brand).getByText('Programming Club')).toBeInTheDocument();
		expect(container.querySelector('.brand-name')).not.toHaveClass('compact-hidden');
	});

	it('keeps the full club identity visible in the narrow-width CSS contract', () => {
		expect(siteHeaderSource).not.toMatch(
			/@media \(max-width: 23\.5rem\)[\s\S]*?\.brand-name\s*\{\s*display:\s*none/u
		);
	});

	it('gives the Instagram and Discord icon links accessible names', () => {
		render(SiteHeader, { props: { pathname: '/' } });

		for (const [label, url] of [
			['Instagram', 'https://www.instagram.com/mari_programming_club/'],
			['Discord', 'https://discord.gg/c6JJw9d']
		]) {
			const link = screen.getByRole('link', { name: label });

			expect(link).toHaveAttribute('href', url);
			expect(link).toHaveAttribute('target', '_blank');
			expect(link).toHaveAttribute('rel', 'external noopener noreferrer');
			expect(link.querySelector('img, svg')).not.toBeNull();
			expect(within(link).queryByText(label)).not.toBeInTheDocument();
		}
	});

	it('uses system-color pictograms instead of fixed-color image assets', () => {
		render(SiteHeader, { props: { pathname: '/' } });

		for (const label of ['Instagram', 'Discord']) {
			const link = screen.getByRole('link', { name: label });
			const pictogram = link.querySelector('svg');

			expect(pictogram).not.toBeNull();
			expect(
				pictogram?.getAttribute('fill') === 'currentColor' ||
					pictogram?.getAttribute('stroke') === 'currentColor'
			).toBe(true);
			expect(link.querySelector('img')).toBeNull();
		}
	});

	it('does not expose Book Delivery while the public service is closed', () => {
		const { container } = render(SiteHeader, { props: { pathname: '/about-us' } });

		expect(screen.queryByRole('link', { name: 'Book Delivery' })).not.toBeInTheDocument();
		expect(container.querySelectorAll('a[href^="/books"]')).toHaveLength(0);
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /cart/i })).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent(/book delivery|cart/i);
	});

	it('does not add a hidden Book Delivery item for a closed nested route', () => {
		render(SiteHeader, { props: { pathname: '/books/teachers/marie-dupont' } });
		const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });

		expect(
			within(navigation).queryByRole('link', { name: 'Book Delivery' })
		).not.toBeInTheDocument();
		expect(within(navigation).getByRole('link', { name: 'About' })).not.toHaveAttribute(
			'aria-current'
		);
		expect(within(navigation).getByRole('link', { name: 'Events' })).not.toHaveAttribute(
			'aria-current'
		);
	});

	it('keeps Mini-Competitions reachable from compact and mobile disclosure menus', () => {
		const { container } = render(SiteHeader, { props: { pathname: '/mini-competitions' } });

		expect(container.querySelector('#compact-more-menu a[href="/mini-competitions"]')).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(container.querySelector('#mobile-navigation a[href="/mini-competitions"]')).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(
			within(screen.getByRole('navigation', { name: 'Primary navigation' })).queryByRole(
				'link',
				{ name: 'Mini-Competitions' }
			)
		).not.toBeInTheDocument();
		expect(container.querySelectorAll('a[href="/mini-competitions"]')).toHaveLength(2);
	});

	it('marks Workshops current in every responsive navigation mode', () => {
		const { container } = render(SiteHeader, { props: { pathname: '/our-workshops' } });

		for (const link of container.querySelectorAll('a[href="/our-workshops"]')) {
			expect(link).toHaveAttribute('aria-current', 'page');
		}
		expect(container.querySelectorAll('a[href="/our-workshops"]')).toHaveLength(3);
	});

	it('does not expose Book Delivery for a route with a shared path prefix', () => {
		render(SiteHeader, { props: { pathname: '/bookstore' } });
		const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });

		expect(
			within(navigation).queryByRole('link', { name: 'Book Delivery' })
		).not.toBeInTheDocument();
	});

	it('uses native controls for pointer and keyboard mobile-menu behavior', async () => {
		const user = userEvent.setup();
		const { container } = render(SiteHeader, { props: { pathname: '/events' } });
		const menuButton = screen.getByRole('button', { name: 'Open navigation' });
		const navigation = container.querySelector('#mobile-navigation');
		if (!(navigation instanceof HTMLElement)) throw new Error('Mobile navigation is required');

		expect(menuButton).toHaveAttribute('aria-expanded', 'false');
		expect(menuButton).toHaveAttribute('aria-controls', navigation.id);
		expect(menuButton).not.toHaveAttribute('data-bs-toggle');

		await user.click(menuButton);
		expect(navigation).not.toHaveAttribute('aria-hidden');
		expect(navigation?.querySelector('a')).not.toHaveAttribute('tabindex');
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
		expect(navigation).toHaveAttribute('aria-hidden', 'true');
		expect(navigation?.querySelector('a')).toHaveAttribute('tabindex', '-1');

		await user.keyboard(' ');
		expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		expect(container.querySelectorAll('#mobile-navigation')).toHaveLength(1);

		const eventsLink = within(navigation).getByRole('link', { name: 'Events' });
		eventsLink.addEventListener('click', (event) => event.preventDefault(), { once: true });
		await user.click(eventsLink);
		expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		expect(navigation).toHaveAttribute('data-open', 'false');
	});

	it('closes each disclosure after an outside pointer interaction', async () => {
		const user = userEvent.setup();
		render(SiteHeader, { props: { pathname: '/events' } });
		const moreButton = within(
			screen.getByRole('navigation', { name: 'Compact navigation' })
		).getByRole('button', { name: 'More' });

		await user.click(moreButton);
		expect(moreButton).toHaveAttribute('aria-expanded', 'true');

		await fireEvent.pointerDown(document.body);
		expect(moreButton).toHaveAttribute('aria-expanded', 'false');
	});

	it('closes open disclosures when the active route changes', async () => {
		const user = userEvent.setup();
		const { component } = render(SiteHeader, { props: { pathname: '/events' } });
		/** @type {{ $set: (props: { pathname: string }) => void }} */
		const mutableComponent = component;
		const moreButton = within(
			screen.getByRole('navigation', { name: 'Compact navigation' })
		).getByRole('button', { name: 'More' });

		await user.click(moreButton);
		expect(moreButton).toHaveAttribute('aria-expanded', 'true');

		mutableComponent.$set({ pathname: '/resources' });
		await Promise.resolve();
		expect(moreButton).toHaveAttribute('aria-expanded', 'false');
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

	it('exposes inquiry and bug mailto links in public chrome', () => {
		render(SiteHeader, { props: { pathname: '/' } });
		expect(
			within(screen.getByRole('navigation', { name: 'Club contact' }))
				.getAllByRole('link')
				.map((link) => link.getAttribute('aria-label') || link.textContent?.trim())
		).toEqual(['Report a bug']);
		const contactLinks = screen.getAllByRole('link', { name: 'Email the team' });
		expect(contactLinks.length).toBeGreaterThan(0);
		for (const link of contactLinks) {
			expect(link).toHaveAttribute(
				'href',
				'mailto:team@marihacks.com?subject=Programming%20Club%20inquiry'
			);
			expect(link).toHaveAttribute('rel', 'external');
			expect(link.querySelector('svg')).not.toBeNull();
			expect(within(link).queryByText('Email the team')).not.toBeInTheDocument();
		}
		for (const link of screen.getAllByRole('link', { name: 'Report a bug' })) {
			expect(link).toHaveAttribute(
				'href',
				'mailto:team@marihacks.com?subject=Programming%20Club%20bug%20report'
			);
			expect(link).toHaveAttribute('rel', 'external');
		}
	});
});
