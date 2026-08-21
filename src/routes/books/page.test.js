import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { clubContent } from '$lib/content/club';
import BooksPage from './+page.svelte';

afterEach(cleanup);

const course = {
	id: '20000000-0000-4000-8000-000000000001',
	code: 'FRE-101',
	title: 'French 101',
	teacher: { slug: 'mme-tremblay', name: 'Mme Tremblay' },
	books: [
		{
			id: '40000000-0000-4000-8000-000000000001',
			title: 'Le Petit Prince',
			author: 'Antoine de Saint-Exupéry',
			isbn: null,
			storefrontUrl: 'https://bookstore.example/book',
			priceCents: 1895,
			coverUrl: null,
			bookstore: { id: 'store', name: 'Bookstore', serviceFeeCents: 500 }
		}
	]
};

describe('book delivery catalogue route', () => {
	it('renders a factual launch notice without catalogue or purchase controls while closed', () => {
		const { container } = render(BooksPage, {
			props: { data: { launchState: 'coming-soon', courseSummaries: [] } }
		});

		expect(
			screen.getByRole('heading', { level: 1, name: 'Book Delivery is coming next semester' })
		).toBeVisible();
		expect(screen.getByText('coming next semester', { exact: true })).toBeVisible();
		expect(screen.getByText('We are preparing course book lists and campus pickup.')).toBeVisible();
		expect(screen.queryByRole('article')).not.toBeInTheDocument();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent(/cart|checkout|payment|price|service fee|tax/i);
	});

	it('renders one live entry per repository-backed teacher-course pair', () => {
		render(BooksPage, { props: { data: { launchState: 'live', courseSummaries: [course] } } });

		expect(screen.getByRole('heading', { level: 1, name: 'Choose your course' })).toBeVisible();
		expect(screen.getByRole('link', { name: /FRE-101 French 101/i })).toHaveAttribute(
			'href',
			'/books/mme-tremblay/20000000-0000-4000-8000-000000000001'
		);
		expect(screen.getByRole('link', { name: "Can't find a book?" })).toHaveAttribute(
			'href',
			'/books/request'
		);
		expect(document.title).toBe(`Book Delivery | ${clubContent.name}`);
	});

	it('explains when the live catalogue has no active course lists', () => {
		render(BooksPage, { props: { data: { launchState: 'live', courseSummaries: [] } } });
		expect(screen.getByText('No course lists are available.')).toBeVisible();
		expect(screen.getByRole('link', { name: 'Request a book' })).toHaveAttribute(
			'href',
			'/books/request'
		);
	});
});
