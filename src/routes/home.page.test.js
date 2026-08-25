import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SiteHeader from '$lib/components/site/SiteHeader.svelte';
import { clubContent } from '$lib/content/club';
import HomePage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('home route', () => {
	it('keeps one Sign up action in the complete page shell', () => {
		render(SiteHeader, { props: { pathname: '/' } });
		render(HomePage);

		const signupLinks = screen.getAllByRole('link', { name: 'Sign up' });
		const heroSignup = screen.getByRole('link', { name: 'Join the club' });

		expect(signupLinks).toHaveLength(1);
		expect(signupLinks[0]).toHaveAttribute('href', clubContent.signupUrl);
		expect(signupLinks[0]).not.toHaveAttribute('target');
		expect(heroSignup).toHaveAttribute('href', clubContent.signupUrl);
	});

	it('states that beginners can join', () => {
		render(HomePage);

		expect(
			screen.getByText('Open to all Marianopolis students. No experience required.')
		).toBeInTheDocument();
	});

	it('reproduces the reference homepage structure in reading order', () => {
		const { container } = render(HomePage);
		const regions = [...container.querySelectorAll('[data-home-section]')].map((node) =>
			node.getAttribute('data-home-section')
		);

		expect(regions).toEqual(['hero', 'activities', 'archive-delivery', 'programming-hub']);
		expect(
			screen.getByRole('heading', { level: 1, name: 'Come build something with us.' })
		).toBeVisible();
		expect(
			screen.getByRole('img', {
				name: 'Two MariHacks organizers working side by side on laptops.'
			})
		).toHaveAttribute('src', '/images/marihacks/organizers-working-1600.webp');
	});

	it('indexes the documented club activities with useful destinations', () => {
		render(HomePage);

		expect(screen.getByRole('heading', { level: 2, name: 'Peer Help' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Workshops' })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { level: 2, name: 'Mini-Competitions' })
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'MariHacks' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Visit MariHacks' })).toHaveAttribute(
			'href',
			'https://www.marihacks.com/'
		);
		expect(screen.getAllByText('Coming Soon')).toHaveLength(1);
		expect(screen.queryByRole('link', { name: /current challenge/i })).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Mini-Competitions status' })).toHaveAttribute(
			'href',
			'/mini-competitions'
		);
	});

	it('uses real workshop material as evidence', () => {
		render(HomePage);

		expect(screen.getByRole('link', { name: 'Intro to Python' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		expect(screen.getByRole('link', { name: 'Functions and lists' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		expect(
			screen.getByRole('link', { name: 'Working with lists and dictionaries' })
		).toHaveAttribute('href', '/our-workshops');
		expect(screen.getByRole('heading', { level: 2, name: 'Workshop archive' })).toBeVisible();
	});

	it('keeps Book Delivery on the homepage as a closed next-semester preview', () => {
		const { container } = render(HomePage);
		const delivery = screen.getByRole('region', { name: 'Book Delivery' });

		expect(
			within(delivery).getByRole('heading', { level: 2, name: 'Book Delivery' })
		).toBeVisible();
		expect(within(delivery).getByText('coming next semester')).toBeVisible();
		expect(delivery).toHaveTextContent('required French and English course books');
		expect(within(delivery).queryByRole('link')).not.toBeInTheDocument();
		expect(container.querySelectorAll('a[href^="/books"]')).toHaveLength(0);
	});

	it('keeps the programming hub useful without adding card filler', () => {
		const { container } = render(HomePage);
		const hub = screen.getByRole('region', { name: 'Programming Hub' });

		expect(screen.getByRole('heading', { level: 2, name: 'Programming Hub' })).toBeVisible();
		expect(within(hub).getByRole('link', { name: 'Ask in Discord' })).toHaveAttribute(
			'href',
			clubContent.socialLinks.find(({ label }) => label === 'Discord')?.url
		);
		expect(screen.getByRole('link', { name: 'Browse resources' })).toHaveAttribute(
			'href',
			'/resources'
		);
		expect(container.querySelectorAll('.card')).toHaveLength(0);
	});

	it('does not present lesson counts, event dates, or unsupported metrics', () => {
		const { container } = render(HomePage);
		const copy = container.textContent ?? '';

		expect(copy).not.toMatch(/Lesson\s+\d+\s+of\s+\d+/i);
		expect(copy).not.toMatch(
			/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\b/i
		);
		expect(copy).not.toMatch(/\b\d+\+?\s+(?:members|projects|events)\b/i);
		expect(copy).not.toMatch(/Open Lab Hours|Project Showcases|Study Buddies|Past Winners/i);
		expect(copy).not.toMatch(/[\u2013\u2014\u00b7\u2022]/);
	});

	it('describes the club in document metadata', () => {
		render(HomePage);

		expect(document.title).toBe(clubContent.name);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			clubContent.mission
		);
	});
});
