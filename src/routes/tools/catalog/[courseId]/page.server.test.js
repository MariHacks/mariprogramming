import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _createHandlers } from './+page.server.js';

const COURSE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('catalog course detail load', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('builds the course page from catalog rows and tagged threads', async () => {
		const listCatalogForCourse = vi.fn(async () => [
			{
				id: 'pub-1',
				offeringId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
				courseId: COURSE,
				courseCode: '201-NYB-05',
				title: 'Calculus II',
				section: '00001',
				teacherName: 'Ada',
				termId: 'fall-2026',
				status: 'published',
				structured: {
					assessments: [{ title: 'Midterm', weight: '30%', date: '2026-10-01' }],
					books: []
				}
			}
		]);
		const listThreads = vi.fn(async () => [{ id: 't1', title: 'Midterm tips' }]);
		const { load } = _createHandlers({
			createStudentStore: () => ({ listCatalogForCourse }),
			createCommunityStore: () => ({ listThreads })
		});
		const result = await load({ params: { courseId: COURSE } });
		expect(result.page.courseCode).toBe('201-NYB-05');
		expect(result.page.threads).toEqual([
			expect.objectContaining({ id: 't1', title: 'Midterm tips' })
		]);
		expect(listCatalogForCourse).toHaveBeenCalledWith(COURSE);
		expect(listThreads).toHaveBeenCalledWith({ courseId: COURSE });
	});
});
