import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CatalogPage from './+page.svelte';

afterEach(cleanup);

describe('catalog page', () => {
	it('explains that browsing does not need an account', () => {
		render(CatalogPage, { props: { data: { entries: [], termId: '', query: '', discipline: '', disciplines: [] } } });
		expect(screen.getByRole('heading', { name: 'Course catalog' })).toBeInTheDocument();
		expect(screen.getByText(/Books are reference only/)).toBeInTheDocument();
		expect(screen.getByText('No published courses yet')).toBeInTheDocument();
		expect(screen.getByText(/Shared outlines will show up here/)).toBeInTheDocument();
		expect(screen.getByLabelText('Discipline')).toBeInTheDocument();
	});

	it('explains when filters match nothing and offers a clear action', () => {
		render(CatalogPage, {
			props: { data: { entries: [], termId: 'fall-2026', query: 'ZZZ', discipline: 'Physics', disciplines: ['Physics'] } }
		});
		expect(screen.getByText('No courses match these filters')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/tools/catalog');
	});

	it('lists published assessments and books without a student number', () => {
		render(CatalogPage, {
			props: {
				data: {
					termId: 'fall-2026',
					query: '',
					discipline: '',
					disciplines: ['Physics'],
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
								assessments: [
									{ title: 'Midterm', weight: 30, date: '2026-10-20' },
									{ title: 'Quiz', weight: null }
								],
								books: [
									{ title: 'University Physics', author: 'Young', isbn: '9780', required: true },
									{ title: 'Notes' }
								]
							}
						}
					]
				}
			}
		});
		expect(screen.getByText('Modern Physics')).toBeInTheDocument();
		expect(screen.getAllByText('Physics').length).toBeGreaterThan(0);
		expect(screen.getByText(/Midterm/)).toBeInTheDocument();
		expect(screen.getByText(/University Physics/)).toBeInTheDocument();
		expect(screen.queryByText(/2530622/)).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Sort by course code/ }));
		fireEvent.click(screen.getByRole('button', { name: /Collapse 203-SN3-RE/ }));
	});

	it('shows empty structured details', () => {
		render(CatalogPage, {
			props: {
				data: {
					termId: '',
					query: '',
					discipline: '',
					disciplines: ['Mathematics'],
					entries: [
						{
							id: 'c2',
							termId: 'winter-2026',
							courseCode: '201-NYA-05',
							title: 'Calculus',
							section: '00001',
							teacherName: 'Ada',
							structured: {}
						}
					]
				}
			}
		});
		expect(screen.getByText('No structured details yet')).toBeInTheDocument();
		expect(screen.getByText('No assessments were shared for this section.')).toBeInTheDocument();
		expect(screen.getByText('No book reference was shared for this section.')).toBeInTheDocument();
	});

	it('summarizes assessments when no book was listed', () => {
		render(CatalogPage, {
			props: {
				data: {
					termId: '',
					query: '',
					discipline: '',
					disciplines: ['Physics'],
					entries: [
						{
							id: 'c3',
							termId: 'winter-2026',
							courseCode: '203-NYA-05',
							title: 'Mechanics',
							section: '00004',
							teacherName: 'Elena',
							structured: {
								assessments: [{ title: 'Labs', weight: 30 }]
							}
						}
					]
				}
			}
		});
		expect(screen.getByText('1 assessment, no book listed')).toBeInTheDocument();
	});

	it('explains when the catalog cannot be read', () => {
		render(CatalogPage, {
			props: { data: { entries: [], termId: '', query: '', discipline: '', disciplines: [], unavailable: true } }
		});
		expect(screen.getByText('Catalog data is not loading right now')).toBeInTheDocument();
		expect(screen.getByText(/Try again in a moment/)).toBeInTheDocument();
	});
});
