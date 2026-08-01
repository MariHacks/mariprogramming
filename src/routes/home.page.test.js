import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import HomePage from './+page.svelte';

afterEach(cleanup);

describe('home route', () => {
	it('introduces the club, then gives students an ordered path through its current work', () => {
		const { container } = render(HomePage);

		expect(
			screen.getByRole('heading', { level: 1, name: 'Learn programming. Build together.' })
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(screen.getByText(clubContent.mission)).toBeInTheDocument();

		expect(
			screen.getAllByRole('heading', { level: 2 }).map(({ textContent }) => textContent)
		).toEqual(['Start with Python foundations', 'Upcoming events', 'Book Delivery']);
		expect(screen.getByRole('heading', { level: 3, name: 'Intro to Python' })).toBeInTheDocument();
		expect(
			screen.getByText('Variables, data types, operations, conditions, and loops.')
		).toBeInTheDocument();
	});

	it('turns the empty event schedule into a useful current community path', () => {
		render(HomePage);

		expect(
			screen.getByRole('heading', { level: 3, name: 'New events are being planned' })
		).toBeInTheDocument();

		const communityLinks = screen.getAllByRole('link', {
			name: clubContent.communityAction.label
		});

		expect(communityLinks.length).toBeGreaterThan(0);
		for (const link of communityLinks) {
			expect(link).toHaveAttribute('href', clubContent.communityAction.url);
			expect(link).toHaveAttribute('target', '_blank');
			expect(link).toHaveAttribute('rel', 'noopener noreferrer');
		}
	});

	it('introduces Book Delivery without exposing commerce controls on the club home page', () => {
		const { container } = render(HomePage);

		expect(screen.getByRole('link', { name: 'Explore Book Delivery' })).toHaveAttribute(
			'href',
			'/books'
		);
		expect(container).toHaveTextContent(/course books organized by teacher/i);
		expect(container).not.toHaveTextContent(/\bcart\b|checkout|pickup/i);
	});

	it('describes the redesigned club home page in document metadata', () => {
		render(HomePage);

		expect(document.title).toBe(clubContent.name);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			clubContent.mission
		);
	});
});
