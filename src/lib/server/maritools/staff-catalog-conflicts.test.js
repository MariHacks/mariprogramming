// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildCatalogConflictGroups, structuredFactsView } from './staff-catalog-conflicts.js';

const OFFERING_A = '10000000-0000-4000-8000-000000000001';
const OFFERING_B = '10000000-0000-4000-8000-000000000002';
const CONTRIB_A = '70000000-0000-4000-8000-000000000001';
const CONTRIB_B = '70000000-0000-4000-8000-000000000002';
const CONTRIB_C = '70000000-0000-4000-8000-000000000003';

describe('structuredFactsView', () => {
	it('maps assessments and books into plain labels', () => {
		expect(
			structuredFactsView({
				assessments: [{ title: 'Midterm', weight: 30, date: null }],
				books: [{ title: 'SICP', author: 'Abelson', isbn: null, required: true }]
			})
		).toEqual({
			assessments: [{ title: 'Midterm', weight: '30', date: '' }],
			books: [{ title: 'SICP', author: 'Abelson', isbn: '', required: true }]
		});
	});

	it('normalizes malformed facts without leaking source values', () => {
		expect(
			structuredFactsView({
				assessments: [null, { title: '  Quiz  ', weight: false, date: '' }],
				books: [42, { title: null, author: 7, isbn: '  123  ', required: 0 }]
			})
		).toEqual({
			assessments: [
				{ title: '', weight: '', date: '' },
				{ title: 'Quiz', weight: 'false', date: '' }
			],
			books: [
				{ title: '', author: '', isbn: '', required: false },
				{ title: '', author: '7', isbn: '123', required: false }
			]
		});
		expect(structuredFactsView(null)).toEqual({ assessments: [], books: [] });
		expect(structuredFactsView([])).toEqual({ assessments: [], books: [] });
		expect(structuredFactsView({ assessments: 'none', books: 'none' })).toEqual({
			assessments: [],
			books: []
		});
	});
});

describe('buildCatalogConflictGroups', () => {
	it('groups live peers by offering with human contributor labels', () => {
		const groups = buildCatalogConflictGroups(
			[
				{
					id: CONTRIB_A,
					offeringId: OFFERING_A,
					courseCode: '420-NYA-05',
					title: 'Programming',
					section: '00003',
					teacherName: 'Ada',
					termId: 'fall-2026',
					documentSha256: 'a'.repeat(64),
					structured: { books: [{ title: 'Left' }] },
					contributorUserId: 'user-a',
					status: 'published',
					createdAt: new Date('2026-08-28T10:00:00.000Z'),
					updatedAt: new Date('2026-08-28T11:00:00.000Z')
				},
				{
					id: CONTRIB_B,
					offeringId: OFFERING_A,
					courseCode: '420-NYA-05',
					title: 'Programming',
					section: '00003',
					teacherName: 'Ada',
					termId: 'fall-2026',
					documentSha256: 'b'.repeat(64),
					structured: { books: [{ title: 'Right' }] },
					contributorUserId: 'user-b',
					status: 'conflict',
					createdAt: new Date('2026-08-28T12:00:00.000Z'),
					updatedAt: new Date('2026-08-28T12:00:00.000Z')
				},
				{
					id: CONTRIB_C,
					offeringId: OFFERING_B,
					courseCode: '201-NYC-05',
					title: 'Linear Algebra',
					section: '00007',
					teacherName: 'Emmy',
					termId: 'fall-2026',
					documentSha256: 'c'.repeat(64),
					structured: { assessments: [{ title: 'Midterm' }] },
					contributorUserId: null,
					status: 'conflict',
					createdAt: '2026-08-28T13:00:00.000Z',
					updatedAt: '2026-08-28T13:00:00.000Z'
				}
			],
			{ 'user-a': 'Ada', 'user-b': 'Blake' }
		);

		expect(groups).toHaveLength(2);
		expect(groups[0].contributions).toEqual([
			expect.objectContaining({
				id: CONTRIB_A,
				status: 'published',
				contributorDisplayName: 'Ada',
				books: [expect.objectContaining({ title: 'Left' })]
			}),
			expect.objectContaining({
				id: CONTRIB_B,
				status: 'conflict',
				contributorDisplayName: 'Blake',
				books: [expect.objectContaining({ title: 'Right' })]
			})
		]);
		expect(groups[1].contributions[0].contributorDisplayName).toBe('Student');
	});

	it('hides offerings that only have published rows', () => {
		expect(
			buildCatalogConflictGroups([
				{
					id: CONTRIB_A,
					offeringId: OFFERING_A,
					courseCode: '420-NYA-05',
					title: 'Programming',
					section: '00003',
					teacherName: 'Ada',
					termId: 'fall-2026',
					structured: {},
					contributorUserId: 'user-a',
					status: 'published',
					createdAt: '2026-08-28T10:00:00.000Z',
					updatedAt: '2026-08-28T10:00:00.000Z'
				}
			])
		).toEqual([]);
	});

	it('returns an empty list when there are no conflict rows', () => {
		expect(buildCatalogConflictGroups([])).toEqual([]);
	});

	it('skips rows without an offering and defaults missing fields', () => {
		const groups = buildCatalogConflictGroups(
			[
				{ offeringId: null },
				{
					offeringId: OFFERING_A,
					contributorUserId: 42,
					status: null,
					structured: null,
					createdAt: null,
					updatedAt: 17
				}
			],
			null
		);

		expect(groups).toEqual([
			expect.objectContaining({
				offeringId: OFFERING_A,
				courseCode: '',
				title: '',
				section: '',
				teacherName: '',
				termId: '',
				contributions: [
					expect.objectContaining({
						id: '',
						status: 'conflict',
						createdAt: '',
						updatedAt: '17',
						contributorDisplayName: 'Student'
					})
				]
			})
		]);
	});

	it('accepts a display-name map and falls back for blank names', () => {
		const groups = buildCatalogConflictGroups(
			[
				{
					id: CONTRIB_A,
					offeringId: OFFERING_A,
					contributorUserId: 'user-a',
					status: 'conflict',
					structured: {},
					createdAt: '',
					updatedAt: ''
				}
			],
			new Map([['user-a', '   ']])
		);

		expect(groups[0].contributions[0].contributorDisplayName).toBe('Student');
	});
});
