// @ts-nocheck

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CatalogConflictsPage from './+page.svelte';

const OFFERING = '10000000-0000-4000-8000-000000000001';
const CONTRIB_A = '70000000-0000-4000-8000-000000000001';
const CONTRIB_B = '70000000-0000-4000-8000-000000000002';

afterEach(() => {
	cleanup();
});

describe('staff catalog conflicts page', () => {
	it('renders peer facts side by side for one offering', () => {
		render(CatalogConflictsPage, {
			data: {
				unavailable: false,
				groups: [
					{
						offeringId: OFFERING,
						courseCode: '420-NYA-05',
						title: 'Programming',
						section: '00003',
						teacherName: 'Ada',
						termId: 'fall-2026',
						contributions: [
							{
								id: CONTRIB_A,
								documentSha256: 'a'.repeat(64),
								structured: { books: [{ title: 'Left book' }] },
								contributorUserId: 'user-a',
								status: 'conflict',
								createdAt: '2026-08-28T10:00:00.000Z',
								updatedAt: '2026-08-28T10:00:00.000Z'
							},
							{
								id: CONTRIB_B,
								documentSha256: 'b'.repeat(64),
								structured: { books: [{ title: 'Right book' }] },
								contributorUserId: 'user-b',
								status: 'conflict',
								createdAt: '2026-08-28T11:00:00.000Z',
								updatedAt: '2026-08-28T11:00:00.000Z'
							}
						]
					}
				]
			}
		});
		expect(screen.getByRole('heading', { name: 'Catalog conflicts' })).toBeInTheDocument();
		expect(screen.getByText('420-NYA-05')).toBeInTheDocument();
		expect(screen.getByText('Programming')).toBeInTheDocument();
		expect(screen.getByText(/Left book/)).toBeInTheDocument();
		expect(screen.getByText(/Right book/)).toBeInTheDocument();
		expect(screen.getByText('2 peers')).toBeInTheDocument();
		expect(screen.getByText(/published rows only/i)).toBeInTheDocument();
	});

	it('shows an empty state when there are no conflicts', () => {
		render(CatalogConflictsPage, {
			data: { unavailable: false, groups: [] }
		});
		expect(screen.getByRole('status')).toHaveTextContent('No catalog conflicts.');
	});

	it('shows an unavailable alert when the store is down', () => {
		render(CatalogConflictsPage, {
			data: { unavailable: true, groups: [] }
		});
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Catalog conflicts are unavailable right now.'
		);
	});
});
