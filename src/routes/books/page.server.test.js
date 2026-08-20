// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createBooksPageLoad } from './+page.server';

const courses = [
	{
		id: 'course-id',
		code: 'ENG-101',
		title: 'English',
		teacher: { slug: 'teacher', name: 'Teacher' },
		books: []
	}
];

describe('Book Delivery root server load', () => {
	it('returns the closed state without constructing or querying the repository', async () => {
		const createRepository = vi.fn();
		const load = _createBooksPageLoad({ createRepository });

		await expect(
			load({ parent: vi.fn().mockResolvedValue({ launchState: 'coming-soon' }) })
		).resolves.toEqual({
			launchState: 'coming-soon',
			courseSummaries: []
		});
		expect(createRepository).not.toHaveBeenCalled();
	});

	it('queries active course summaries only after the parent confirms live', async () => {
		/** @type {string[]} */
		const order = [];
		const parent = vi.fn(async () => {
			order.push('parent');
			return { launchState: 'live' };
		});
		const listActiveCourseSummaries = vi.fn(async () => {
			order.push('repository');
			return courses;
		});
		const load = _createBooksPageLoad({ createRepository: () => ({ listActiveCourseSummaries }) });

		await expect(load({ parent })).resolves.toEqual({
			launchState: 'live',
			courseSummaries: courses
		});
		expect(order).toEqual(['parent', 'repository']);
	});
});
