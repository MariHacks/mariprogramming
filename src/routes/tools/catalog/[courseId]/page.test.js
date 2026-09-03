import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CourseDetailPage from './+page.svelte';

afterEach(cleanup);

const data = {
	page: {
		courseId: 'a1111111-1111-4111-8111-111111111111',
		courseCode: '420-CFP-01',
		title: 'Conflict Proof Programming',
		offerings: [
			{
				offeringId: 'offering-1',
				section: '00099',
				teacherName: 'Conflict Proof Teacher',
				termId: 'fall-2026',
				hasConflicts: false,
				assessments: [{ title: 'Midterm', weight: '30%', date: '2026-10-20' }],
				books: [{ title: 'Reference Book', author: 'Ada', isbn: '9780', required: true }]
			}
		],
		threads: []
	}
};

describe('course detail page', () => {
	it('keeps detail sections inside a restrained responsive layout', () => {
		const { container } = render(CourseDetailPage, { props: { data } });

		expect(screen.getByRole('heading', { name: 'Conflict Proof Programming' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '/tools/catalog');
		expect(screen.getByRole('heading', { name: 'Assessments' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Books (reference only)' })).toBeInTheDocument();
		expect(container.querySelector('.course-detail-body')).toBeInTheDocument();
		expect(container).not.toHaveTextContent('·');

		const source = readFileSync(
			path.join(process.cwd(), 'src/routes/tools/catalog/[courseId]/+page.svelte'),
			'utf8'
		);
		expect(source).toMatch(
			/\.course-panels h2,[\s\S]*\.course-forum h2\s*\{[^}]*font-size:\s*1\.5rem;/u
		);
		expect(source).toMatch(
			/@media \(max-width: 44rem\)[\s\S]*\.course-panels\s*\{[^}]*grid-template-columns:\s*1fr;/u
		);
	});
});
