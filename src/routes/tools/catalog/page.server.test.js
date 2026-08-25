// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MaritoolsUnavailableError } from '$lib/server/maritools/student-store.js';
import { prerender, _createHandlers } from './+page.server.js';

const ENTRY = {
	id: 'c1',
	termId: 'fall-2026',
	courseCode: '203-SN3-RE',
	title: 'Modern Physics',
	section: '00021',
	teacherName: 'Baharak Fatholahzadeh',
	structured: {
		assessments: [{ title: 'Midterm', weight: 30, date: '2026-10-20' }],
		books: [{ title: 'University Physics', author: 'Young', isbn: null, required: true }]
	},
	status: 'published'
};

function handlers(overrides = {}) {
	const repository = {
		listPublishedCatalog: vi.fn(async () => [ENTRY]),
		...overrides.repository
	};
	return {
		..._createHandlers({
			createRepository: vi.fn(() => repository),
			...overrides
		}),
		repository
	};
}

function event(search = '') {
	return { url: new URL(`https://club.example.com/tools/catalog${search}`) };
}

describe('catalog page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('lists published entries for anonymous visitors', async () => {
		const current = handlers();
		const data = await current.load(event());
		expect(data.entries).toEqual([ENTRY]);
		expect(JSON.stringify(data)).not.toMatch(/student/i);
		expect(current.repository.listPublishedCatalog).toHaveBeenCalledWith({
			termId: '',
			query: ''
		});
	});

	it('forwards term and query filters', async () => {
		const current = handlers();
		await current.load(event('?term=fall-2026&q=203-SN3-RE'));
		expect(current.repository.listPublishedCatalog).toHaveBeenCalledWith({
			termId: 'fall-2026',
			query: '203-SN3-RE'
		});
	});

	it('returns an empty list when the catalog cannot be read', async () => {
		const current = handlers({
			repository: {
				listPublishedCatalog: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(current.load(event())).resolves.toEqual({
			entries: [],
			termId: '',
			query: '',
			unavailable: true
		});
	});

	it('rethrows unexpected load failures', async () => {
		const current = handlers({
			repository: {
				listPublishedCatalog: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(current.load(event())).rejects.toThrow('boom');
	});
});
