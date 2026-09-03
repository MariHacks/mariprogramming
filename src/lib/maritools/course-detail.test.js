import { describe, expect, it } from 'vitest';
import { buildCourseDetailPage } from './course-detail.js';

const COURSE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OFFERING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('buildCourseDetailPage', () => {
	it('returns null when the course has no published or conflict rows', () => {
		expect(
			buildCourseDetailPage({
				courseId: COURSE,
				published: [],
				conflicts: [],
				threads: []
			})
		).toBeNull();
	});

	it('inlines conflict peers next to differing assessment and book fields', () => {
		const page = buildCourseDetailPage({
			courseId: COURSE,
			published: [
				{
					id: 'pub-1',
					offeringId: OFFERING,
					courseId: COURSE,
					courseCode: '201-NYB-05',
					title: 'Calculus II',
					section: '00001',
					teacherName: 'Ada',
					termId: 'fall-2026',
					status: 'published',
					structured: {
						assessments: [{ title: 'Midterm', weight: '30%', date: '2026-10-01' }],
						books: [{ title: 'Stewart', author: 'Stewart', isbn: '1', required: true }]
					}
				}
			],
			conflicts: [
				{
					id: 'conf-1',
					offeringId: OFFERING,
					courseId: COURSE,
					courseCode: '201-NYB-05',
					title: 'Calculus II',
					section: '00001',
					teacherName: 'Ada',
					termId: 'fall-2026',
					status: 'conflict',
					structured: {
						assessments: [{ title: 'Midterm', weight: '40%', date: '2026-10-01' }],
						books: [{ title: 'Stewart', author: 'Stewart', isbn: '1', required: false }]
					}
				}
			],
			threads: [{ id: 't1', title: 'Midterm tips', authorDisplayName: 'Sam' }]
		});

		expect(page).toMatchObject({
			courseId: COURSE,
			courseCode: '201-NYB-05',
			title: 'Calculus II'
		});
		expect(page.offerings).toHaveLength(1);
		expect(page.offerings[0].hasConflicts).toBe(true);
		expect(page.offerings[0].assessments[0].conflicts).toEqual([
			expect.objectContaining({ weight: '40%', fromStatus: 'conflict' })
		]);
		expect(page.offerings[0].books[0].conflicts).toEqual([
			expect.objectContaining({ required: false, fromStatus: 'conflict' })
		]);
		expect(page.threads).toEqual([
			expect.objectContaining({ id: 't1', title: 'Midterm tips', authorDisplayName: 'Sam' })
		]);
	});
});
