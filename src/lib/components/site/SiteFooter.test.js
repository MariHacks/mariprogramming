import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import SiteFooter from './SiteFooter.svelte';
import siteFooterSource from './SiteFooter.svelte?raw';

afterEach(cleanup);

const expectedDestinations = [
	['Instagram', 'https://www.instagram.com/mari_programming_club/'],
	['Discord', 'https://discord.gg/c6JJw9d']
];

describe('club footer content', () => {
	it('keeps the club identity and community destinations in the current content model', () => {
		expect(clubContent.name).toBe('Marianopolis Programming Club');
		expect(clubContent.communityAction).toEqual({
			label: 'Follow on Instagram',
			url: 'https://www.instagram.com/mari_programming_club/',
			socialLabel: 'Instagram',
			icon: '/socials/instagram.svg'
		});
		expect(clubContent.socialLinks).toEqual([
			{
				label: 'GitHub',
				url: 'https://github.com/MariHacks',
				icon: '/socials/github.svg'
			},
			{
				label: 'Instagram',
				url: 'https://www.instagram.com/mari_programming_club/',
				icon: '/socials/instagram.svg'
			},
			{
				label: 'Discord',
				url: 'https://discord.gg/c6JJw9d',
				icon: '/socials/discord.svg'
			},
			{
				label: 'MariHacks',
				url: 'https://www.marihacks.com/',
				icon: '/socials/marihacks.png'
			}
		]);
	});
});

describe('SiteFooter', () => {
	it('ends the page with one club landmark and a clear route home', () => {
		render(SiteFooter);

		const footer = screen.getByRole('contentinfo');

		expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
		expect(
			within(footer).getByRole('link', {
				name: clubContent.name
			})
		).toHaveAttribute('href', '/');
		expect(within(footer).queryByText(clubContent.mission)).not.toBeInTheDocument();
		expect(footer).not.toHaveTextContent('mcgill.ca/marianopolis');
	});

	it('renders every community destination as a named icon link', () => {
		render(SiteFooter);

		const communityNavigation = screen.getByRole('navigation', { name: 'Club community' });

		for (const [label, url] of expectedDestinations) {
			const link = within(communityNavigation).getByRole('link', { name: label });

			expect(link).toHaveAttribute('href', url);
			expect(link).toHaveAttribute('target', '_blank');
			expect(link).toHaveAttribute('rel', 'external noopener noreferrer');
			expect(link.querySelector('img, svg')).not.toBeNull();
			expect(within(link).queryByText(label)).not.toBeInTheDocument();
		}

		expect(communityNavigation.querySelectorAll('a')).toHaveLength(expectedDestinations.length + 1);
		expect(
			[...communityNavigation.querySelectorAll('a')].map(
				(link) => link.getAttribute('aria-label') || link.textContent?.trim()
			)
		).toEqual(['Email the team', 'Instagram', 'Discord']);
	});

	it('exposes inquiry and bug mailto links without JavaScript', () => {
		render(SiteFooter);
		const contact = screen.getByRole('navigation', { name: 'Club contact' });
		expect(
			within(contact)
				.getAllByRole('link')
				.map((link) => link.getAttribute('aria-label') || link.textContent?.trim())
		).toEqual(['Report a bug']);
		const inquiry = screen.getByRole('link', { name: 'Email the team' });
		expect(inquiry).toHaveAttribute(
			'href',
			'mailto:team@marihacks.com?subject=Programming%20Club%20inquiry'
		);
		expect(inquiry).toHaveAttribute('rel', 'external');
		expect(inquiry.querySelector('svg')).not.toBeNull();
		expect(within(inquiry).queryByText('Email the team')).not.toBeInTheDocument();
		const bug = within(contact).getByRole('link', { name: 'Report a bug' });
		expect(bug).toHaveAttribute(
			'href',
			'mailto:team@marihacks.com?subject=Programming%20Club%20bug%20report'
		);
		expect(bug).toHaveAttribute('rel', 'external');
	});

	it('keeps footer community icons on the paper ink instead of browser link colors', () => {
		expect(siteFooterSource).toMatch(/\.social-link\s*\{[^}]*color:\s*inherit/u);
	});

	it('keeps imagery supplementary in a compact one-row desktop frame', () => {
		const { container } = render(SiteFooter);
		const footer = screen.getByRole('contentinfo');

		for (const image of container.querySelectorAll('img')) {
			expect(image).toHaveAttribute('alt', '');
		}

		expect(within(footer).queryByText(/©/)).not.toBeInTheDocument();
		expect(container.querySelector('.footer-frame')).toHaveAttribute('data-layout', 'compact-row');
		expect(footer).not.toHaveTextContent(/cart|payment|executive/i);
	});
});
