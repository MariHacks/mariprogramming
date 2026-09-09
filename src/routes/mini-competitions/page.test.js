import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import MiniCompetitionsPage from './+page.svelte';

afterEach(cleanup);

describe('mini-competitions route', () => {
	it('publishes a concise and truthful launch status', () => {
		const { container } = render(MiniCompetitionsPage);

		expect(
			screen.getByRole('heading', { level: 1, name: 'Mini-Competitions' })
		).toBeInTheDocument();
		expect(screen.getByText('Coming Soon')).toBeInTheDocument();
		expect(screen.getByText(/short programming challenges/i)).toBeInTheDocument();
		expect(container).not.toHaveTextContent(
			/leaderboard|register|countdown|current challenge|starts? on/i
		);
		expect(container.querySelector('button')).not.toBeInTheDocument();
		expect(document.title).toBe(`Mini-Competitions | ${clubContent.name}`);
	});

	it('offers only working destinations while students wait', () => {
		render(MiniCompetitionsPage);

		expect(screen.getByRole('link', { name: 'Open the current workshop' })).toHaveAttribute(
			'href',
			'/pbl'
		);
		expect(screen.getByRole('link', { name: 'Browse workshop archive' })).toHaveAttribute(
			'href',
			'/our-workshops'
		);
		const discordLink = screen.getByRole('link', { name: 'Join Discord' });
		expect(discordLink).toHaveAttribute('href', 'https://discord.gg/c6JJw9d');
		expect(discordLink).toHaveAttribute('target', '_blank');
		expect(discordLink).toHaveAttribute('rel', 'external noopener noreferrer');
	});

	it('contains no forbidden punctuation or commerce controls', () => {
		const { container } = render(MiniCompetitionsPage);
		const copy = container.textContent ?? '';

		expect(copy).not.toMatch(/[\u2013\u2014\u00b7\u2022]/);
		expect(copy).not.toMatch(/\bcart\b|checkout|pickup|service fee|\$[0-9]/i);
	});
});
