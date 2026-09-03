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
		expect(
			Reflect.apply(buildCourseDetailPage, undefined, [
				{ courseId: COURSE, published: [], threads: [] }
			])
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

	it('normalizes fallback row shapes and preserves matching peer facts', () => {
		const base = {
			courseId: COURSE,
			termId: 'fall-2026',
			section: '1',
			teacherName: 'Ada'
		};
		const page = buildCourseDetailPage({
			courseId: COURSE,
			published: [
				{ courseId: 'other', offeringId: 'ignored' },
				{
					...base,
					structured: {
						assessments: [
							{ title: 'A', weight: 1, date: 'one' },
							{ title: 'B', weight: 2, date: 'two' },
							{ title: 'C', weight: 3, date: 'three' },
							{ title: 'D', weight: 4, date: 'four' },
							{ title: 'E', weight: 5, date: 'five' }
						],
						books: [
							{ title: 'A', author: 'a', isbn: '1', required: false },
							{ title: 'B', author: 'b', isbn: '2', required: false },
							{ title: 'C', author: 'c', isbn: '3', required: false },
							{ title: 'D', author: 'd', isbn: '4', required: false },
							{ title: 'E', author: 'e', isbn: '5', required: false }
						]
					}
				}
			],
			conflicts: [
				{
					...base,
					status: 'conflict',
					structured: {
						assessments: [
							{ title: 'A', weight: 1, date: 'one' },
							{ title: 'changed', weight: 2, date: 'two' },
							{ title: 'C', weight: 9, date: 'three' },
							{ title: 'D', weight: 4, date: 'changed' }
						],
						books: [
							{ title: 'A', author: 'a', isbn: '1', required: false },
							{ title: 'changed', author: 'b', isbn: '2', required: false },
							{ title: 'C', author: 'changed', isbn: '3', required: false },
							{ title: 'D', author: 'd', isbn: 'changed', required: false }
						]
					}
				},
				{
					courseId: COURSE,
					offeringId: 'conflict-only',
					status: 'conflict',
					structured: null
				}
			],
			threads: [{}, { id: 3, title: 4, createdAt: null, authorDisplayName: null }]
		});

		expect(page).toMatchObject({ courseCode: '', title: '' });
		if (!page) throw new Error('Expected a course detail page');
		expect(page.offerings[0]).toMatchObject({
			offeringId: 'fall-2026|1|Ada',
			section: '1',
			teacherName: 'Ada',
			termId: 'fall-2026'
		});
		expect(page.offerings[0].assessments[0].conflicts).toEqual([]);
		expect(page.offerings[0].books[0].conflicts).toEqual([]);
		expect(page.offerings[0].assessments[4].conflicts).toEqual([]);
		expect(page.offerings[0].books[4].conflicts).toEqual([]);
		expect(page.offerings[1]).toMatchObject({
			offeringId: 'conflict-only',
			hasConflicts: true,
			assessments: [],
			books: []
		});
		expect(page.threads[0]).toEqual({
			id: '',
			title: '',
			createdAt: null,
			authorDisplayName: null
		});
	});

	it('uses a published conflict row as the primary fallback and skips empty rows', () => {
		const page = Reflect.apply(buildCourseDetailPage, undefined, [
			{
				courseId: null,
				published: null,
				conflicts: [
					{ courseId: '', status: 'conflict' },
					{ courseId: '', status: 'published', id: 'row-id', structured: null }
				],
				threads: null
			}
		]);
		expect(page).toEqual({
			courseId: '',
			courseCode: '',
			title: '',
			offerings: [
				{
					offeringId: 'undefined|undefined|undefined',
					section: '',
					teacherName: '',
					termId: '',
					hasConflicts: false,
					assessments: [],
					books: []
				}
			],
			threads: []
		});
	});
});
