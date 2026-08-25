import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import AboutPage from './+page.svelte';

afterEach(cleanup);

describe('about route', () => {
	it('explains the club purpose, beginner access, and real activities without filler', () => {
		const { container } = render(AboutPage);

		expect(
			screen.getByRole('heading', {
				level: 1,
				name: 'About the club'
			})
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(
			screen.getByText(/peer learning community for Marianopolis students/i)
		).toBeInTheDocument();
		expect(
			screen.getByText('Members can get help while they build and use original workshop material.')
		).toBeInTheDocument();
		expect(screen.getByText(/mini-competitions are being prepared/i)).toBeInTheDocument();
		expect(screen.getByText(/do not need programming experience/i)).toBeInTheDocument();
		expect(container).not.toHaveTextContent(
			/your next move|before you begin|how we learn together/i
		);
	});

	it('offers the verified registration form and direct learning destinations', () => {
		render(AboutPage);

		const links = screen.getAllByRole('link');
		const signupLink = screen.getByRole('link', { name: 'Join the club' });
		const workshopLink = screen.getByRole('link', { name: 'Browse workshops' });
		const resourceLink = screen.getByRole('link', { name: 'Browse resources' });

		const discordLink = screen.getByRole('link', { name: 'Join Discord' });

		expect(links).toHaveLength(4);
		expect(links[0]).toBe(signupLink);
		expect(links[1]).toBe(workshopLink);
		expect(links[2]).toBe(resourceLink);
		expect(signupLink).toHaveAttribute('href', clubContent.signupUrl);
		expect(signupLink).not.toHaveAttribute('target');
		expect(workshopLink).toHaveAttribute('href', '/our-workshops');
		expect(resourceLink).toHaveAttribute('href', '/resources');
		expect(discordLink).toHaveAttribute('href', 'https://discord.gg/c6JJw9d');
		expect(discordLink).toHaveAttribute('target', '_blank');
	});

	it('uses current metadata without exposing commerce or legacy joining content', () => {
		const { container } = render(AboutPage);

		expect(document.title).toBe(`About | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			clubContent.mission
		);
		expect(container).not.toHaveTextContent(/fall 2024|winter 2024|coming soon|exec applications/i);
		expect(container).not.toHaveTextContent(/\bcart\b|checkout|pickup/i);
		expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
	});
});
