import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import AboutPage from './+page.svelte';

afterEach(cleanup);

describe('about route', () => {
	it('answers whether the club is for a first-time programmer with current club language', () => {
		const { container } = render(AboutPage);

		expect(
			screen.getByRole('heading', {
				level: 1,
				name: 'You can start before you know how to code.'
			})
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(screen.getByText(clubContent.mission)).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { level: 2, name: 'No experience required' })
		).toBeInTheDocument();
	});

	it('grounds its two learning paths in the current workshop and resource catalogue', () => {
		render(AboutPage);

		expect(
			screen.getByRole('heading', {
				level: 2,
				name: 'Use the path that matches your starting point'
			})
		).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { level: 3, name: clubContent.workshops[0].title })
		).toBeInTheDocument();
		expect(screen.getByText(clubContent.workshops[0].description)).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { level: 3, name: clubContent.resources[0].title })
		).toBeInTheDocument();
		expect(screen.getByText(clubContent.resources[0].description)).toBeInTheDocument();
	});

	it('offers the current community action before a lower-pressure local learning path', () => {
		render(AboutPage);

		const links = screen.getAllByRole('link');
		const communityLink = screen.getByRole('link', {
			name: clubContent.communityAction.label
		});
		const workshopLink = screen.getByRole('link', { name: 'Browse beginner workshops' });

		expect(links).toHaveLength(2);
		expect(links[0]).toBe(communityLink);
		expect(links[1]).toBe(workshopLink);
		expect(communityLink).toHaveAttribute('href', clubContent.communityAction.url);
		expect(communityLink).toHaveAttribute('target', '_blank');
		expect(communityLink).toHaveAttribute('rel', 'noopener noreferrer');
		expect(workshopLink).toHaveAttribute('href', '/our-workshops');
	});

	it('uses current metadata without exposing commerce or legacy joining content', () => {
		const { container } = render(AboutPage);

		expect(document.title).toBe(`About | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			clubContent.mission
		);
		expect(container).not.toHaveTextContent(/discord|fall 2024|coming soon|exec applications/i);
		expect(container).not.toHaveTextContent(/\bcart\b|checkout|pickup/i);
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
	});
});
