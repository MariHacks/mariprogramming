import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import BooksPage from './+page.svelte';
import { load } from './+page.js';

afterEach(cleanup);

describe('book delivery catalogue route', () => {
	it('loads serializable teacher summaries without cart or view state', () => {
		const data = load();

		expect(Object.keys(data)).toEqual(['teacherSummaries']);
		expect(data.teacherSummaries).toHaveLength(2);
		expect(data.teacherSummaries.map((summary) => Object.keys(summary))).toEqual([
			['teacher', 'courses', 'books'],
			['teacher', 'courses', 'books']
		]);
		expect(data.teacherSummaries[0]).toMatchObject({
			teacher: { slug: 'mme-tremblay', name: 'Mme Tremblay' },
			courses: [
				{ code: 'FRE-101', title: 'French 101' },
				{ code: 'FRE-102', title: 'French 102' }
			],
			books: [{ title: 'Le Petit Prince' }, { title: 'Bescherelle' }, { title: 'Antigone' }]
		});
		expect(data.teacherSummaries[1]).toMatchObject({
			teacher: { slug: 'mr-bennett', name: 'Mr Bennett' },
			courses: [{ code: 'ENG-101', title: 'English 101' }],
			books: [{ title: 'The Great Gatsby' }]
		});
		expect(JSON.parse(JSON.stringify(data))).toEqual(data);
	});

	it('starts with one teacher-first heading and accurate document metadata', () => {
		const data = load();
		const { container } = render(BooksPage, { props: { data } });

		expect(
			screen.getByRole('heading', { level: 1, name: 'Start with your teacher' })
		).toBeVisible();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(document.title).toBe(`Book Delivery | ${clubContent.name}`);
		expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
			'content',
			'Browse teacher-organized French and English course book lists from the Marianopolis Programming Club.'
		);
	});

	it('renders every teacher as one course-specific path into the catalogue', () => {
		const data = load();
		render(BooksPage, { props: { data } });

		const frenchList = screen.getByRole('link', {
			name: /Mme Tremblay[\s\S]*French 101[\s\S]*French 102/i
		});
		const englishList = screen.getByRole('link', {
			name: /Mr Bennett[\s\S]*English 101/i
		});

		expect(frenchList).toHaveAttribute('href', '/books/mme-tremblay');
		expect(englishList).toHaveAttribute('href', '/books/mr-bennett');
		expect(screen.getByText('FRE-101')).toBeVisible();
		expect(screen.getByText('FRE-102')).toBeVisible();
		expect(screen.getByText('ENG-101')).toBeVisible();
	});

	it('removes the temporary gateway without leaking later commerce details', () => {
		const data = load();
		const { container } = render(BooksPage, { props: { data } });

		expect(container).not.toHaveTextContent(/lists are being prepared|return when/i);
		expect(container).not.toHaveTextContent(
			/cart|checkout|payment|pick[ -]?up|service fee|tax|Renaud-Bray|Archambault|in stock/i
		);
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});
