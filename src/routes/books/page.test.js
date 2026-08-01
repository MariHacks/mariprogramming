import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import BooksPage from './+page.svelte';

afterEach(cleanup);

describe('book delivery route', () => {
	it('sets an honest next step while teacher book lists are prepared', () => {
		const { container } = render(BooksPage);

		expect(
			screen.getByRole('heading', { level: 1, name: 'Course books, organized by teacher' })
		).toBeInTheDocument();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(
			screen.getByRole('heading', { level: 2, name: 'Teacher lists are being prepared' })
		).toBeInTheDocument();
		expect(screen.getByText(/return when your course list is available/i)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Explore the club' })).toHaveAttribute('href', '/');
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent(/cart|checkout|payment|pick[ -]?up|\$\s*\d/i);
	});

	it('describes the book delivery entry in document metadata', () => {
		render(BooksPage);

		expect(document.title).toBe(`Book Delivery | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			'Learn when teacher course-book lists will be available through the Marianopolis Programming Club.'
		);
	});
});
