import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CatalogPage from './+page.svelte';

afterEach(cleanup);

describe('catalog page', () => {
	it('explains that browsing does not need an account', () => {
		render(CatalogPage, { props: { data: { entries: [], termId: '', query: '' } } });
		expect(screen.getByRole('heading', { name: 'Course catalog' })).toBeInTheDocument();
		expect(screen.getByText(/without an account/)).toBeInTheDocument();
		expect(screen.getByText('No published catalog entries yet.')).toBeInTheDocument();
	});

	it('lists published assessments and books without a student number', () => {
		render(CatalogPage, {
			props: {
				data: {
					termId: 'fall-2026',
					query: '',
					entries: [
						{
							id: 'c1',
							termId: 'fall-2026',
							courseCode: '203-SN3-RE',
							title: 'Modern Physics',
							section: '00021',
							teacherName: 'Baharak Fatholahzadeh',
							status: 'published',
							structured: {
								assessments: [{ title: 'Midterm', weight: 30, date: '2026-10-20' }],
								books: [{ title: 'University Physics', author: 'Young', isbn: '9780', required: true }]
							}
						}
					]
				}
			}
		});
		expect(screen.getByText('Modern Physics')).toBeInTheDocument();
		expect(screen.getByText(/Midterm/)).toBeInTheDocument();
		expect(screen.getByText(/University Physics/)).toBeInTheDocument();
		expect(screen.queryByText(/2530622/)).not.toBeInTheDocument();
	});

	it('explains when the catalog cannot be read', () => {
		render(CatalogPage, {
			props: { data: { entries: [], termId: '', query: '', unavailable: true } }
		});
		expect(screen.getByText('The catalog is unavailable right now. Try again.')).toBeInTheDocument();
	});
});
