// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildCatalogConflictGroups } from './staff-catalog-conflicts.js';

const OFFERING_A = '10000000-0000-4000-8000-000000000001';
const OFFERING_B = '10000000-0000-4000-8000-000000000002';
const CONTRIB_A = '70000000-0000-4000-8000-000000000001';
const CONTRIB_B = '70000000-0000-4000-8000-000000000002';
const CONTRIB_C = '70000000-0000-4000-8000-000000000003';

describe('buildCatalogConflictGroups', () => {
	it('groups conflict rows by offering and keeps peer facts side by side', () => {
		const groups = buildCatalogConflictGroups([
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
				status: 'conflict',
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
				structured: { assessments: [{ name: 'Midterm' }] },
				contributorUserId: null,
				status: 'conflict',
				createdAt: '2026-08-28T13:00:00.000Z',
				updatedAt: '2026-08-28T13:00:00.000Z'
			}
		]);

		expect(groups).toHaveLength(2);
		expect(groups[0]).toEqual({
			offeringId: OFFERING_A,
			courseCode: '420-NYA-05',
			title: 'Programming',
			section: '00003',
			teacherName: 'Ada',
			termId: 'fall-2026',
			contributions: [
				{
					id: CONTRIB_A,
					documentSha256: 'a'.repeat(64),
					structured: { books: [{ title: 'Left' }] },
					contributorUserId: 'user-a',
					status: 'conflict',
					createdAt: '2026-08-28T10:00:00.000Z',
					updatedAt: '2026-08-28T11:00:00.000Z'
				},
				{
					id: CONTRIB_B,
					documentSha256: 'b'.repeat(64),
					structured: { books: [{ title: 'Right' }] },
					contributorUserId: 'user-b',
					status: 'conflict',
					createdAt: '2026-08-28T12:00:00.000Z',
					updatedAt: '2026-08-28T12:00:00.000Z'
				}
			]
		});
		expect(groups[1].offeringId).toBe(OFFERING_B);
		expect(groups[1].contributions).toHaveLength(1);
		expect(groups[1].contributions[0].contributorUserId).toBeNull();
	});

	it('returns an empty list when there are no conflict rows', () => {
		expect(buildCatalogConflictGroups([])).toEqual([]);
	});
});
