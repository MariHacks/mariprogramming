import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { footer } from '$lib/content';
import { clubContent } from '$lib/content/club';
import SiteFooter from './SiteFooter.svelte';

afterEach(cleanup);

const expectedDestinations = [
	['GitHub', 'https://github.com/MariHacks'],
	['Instagram', 'https://www.instagram.com/mari_programming_club/'],
	['MariHacks', 'https://www.marihacks.com/']
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
				label: 'MariHacks',
				url: 'https://www.marihacks.com/',
				icon: '/socials/marihacks.png'
			}
		]);
	});

	it('keeps the legacy footer bridge aligned with every centralized social field', () => {
		expect(footer.brand).toBe(`<The ${clubContent.name}\u00a0/>`);
		expect(Object.keys(footer.socials)).toEqual(clubContent.socialLinks.map(({ label }) => label));

		for (const { label, url, icon } of clubContent.socialLinks) {
			expect(footer.socials[label]).toEqual({
				url,
				icon,
				iconAlt: `${label} logo`,
				height: 30
			});
		}
	});
});

describe('SiteFooter', () => {
	it('ends the page with one club landmark and a clear route home', () => {
		render(SiteFooter);

		const footer = screen.getByRole('contentinfo');

		expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
		expect(
			within(footer).getByRole('link', {
				name: `${clubContent.name} Home`
			})
		).toHaveAttribute('href', '/');
		expect(within(footer).getByText(clubContent.mission)).toBeInTheDocument();
	});

	it('renders every named community destination as a safe external link', () => {
		render(SiteFooter);

		const communityNavigation = screen.getByRole('navigation', { name: 'Club community' });

		for (const [label, url] of expectedDestinations) {
			const link = within(communityNavigation).getByRole('link', { name: label });

			expect(link).toHaveAttribute('href', url);
			expect(link).toHaveAttribute('target', '_blank');
			expect(link).toHaveAttribute('rel', 'noopener noreferrer');
			expect(within(link).getByText(label)).toBeVisible();
		}

		expect(communityNavigation.querySelectorAll('a')).toHaveLength(expectedDestinations.length);
	});

	it('keeps imagery supplementary and the closing line undated', () => {
		const { container } = render(SiteFooter);
		const footer = screen.getByRole('contentinfo');
		const copyright = within(footer).getByText(`© ${clubContent.name}`);

		for (const image of container.querySelectorAll('img')) {
			expect(image).toHaveAttribute('alt', '');
		}

		expect(copyright).not.toHaveTextContent(/20\d{2}/);
		expect(footer).not.toHaveTextContent(/cart|payment|executive/i);
	});
});
