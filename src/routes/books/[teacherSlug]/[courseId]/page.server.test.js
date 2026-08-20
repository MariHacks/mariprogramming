// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createCoursePageLoad } from './+page.server';

describe('course detail server load', () => {
	it('awaits the parent gate before repository construction or access', async () => {
		/** @type {string[]} */
		const order = [];
		const detail = {
			id: 'course-id',
			teacher: { slug: 'teacher', name: 'Teacher' },
			books: [{ id: 'book-id', bookstore: { name: 'Bookstore' } }]
		};
		const parent = vi.fn(async () => {
			order.push('parent');
			return { launchState: 'live' };
		});
		const getActiveCourseDetail = vi.fn(async () => {
			order.push('repository');
			return detail;
		});
		const load = _createCoursePageLoad({ createRepository: () => ({ getActiveCourseDetail }) });

		await expect(
			load({
				parent,
				params: { teacherSlug: 'teacher', courseId: '20000000-0000-4000-8000-000000000001' }
			})
		).resolves.toEqual({
			teacher: detail.teacher,
			course: { ...detail, books: [{ ...detail.books[0], bookstoreName: 'Bookstore' }] }
		});
		expect(order).toEqual(['parent', 'repository']);
	});

	it('returns a bounded 404 when no active teacher-course pair exists', async () => {
		const load = _createCoursePageLoad({
			createRepository: () => ({ getActiveCourseDetail: vi.fn().mockResolvedValue(null) })
		});

		await expect(
			load({
				parent: vi.fn().mockResolvedValue({ launchState: 'live' }),
				params: { teacherSlug: 'teacher', courseId: '20000000-0000-4000-8000-000000000001' }
			})
		).rejects.toMatchObject({ status: 404 });
	});
});
