// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MaritoolsUnavailableError } from '$lib/server/maritools/community-store.js';
import { _createStaffCatalogConflictsHandlers } from './+page.server.js';

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});
const OFFERING = '10000000-0000-4000-8000-000000000001';
const CONTRIB_A = '70000000-0000-4000-8000-000000000001';
const CONTRIB_B = '70000000-0000-4000-8000-000000000002';

function setup(overrides = {}) {
	const store = {
		listConflictCatalog: vi.fn(async () => [
			{
				id: CONTRIB_A,
				offeringId: OFFERING,
				courseCode: '420-NYA-05',
				title: 'Programming',
				section: '00003',
				teacherName: 'Ada',
				termId: 'fall-2026',
				documentSha256: 'a'.repeat(64),
				structured: { books: [{ title: 'Left' }] },
				contributorUserId: 'user-a',
				status: 'conflict',
				createdAt: '2026-08-28T10:00:00.000Z',
				updatedAt: '2026-08-28T10:00:00.000Z'
			},
			{
				id: CONTRIB_B,
				offeringId: OFFERING,
				courseCode: '420-NYA-05',
				title: 'Programming',
				section: '00003',
				teacherName: 'Ada',
				termId: 'fall-2026',
				documentSha256: 'b'.repeat(64),
				structured: { books: [{ title: 'Right' }] },
				contributorUserId: 'user-b',
				status: 'conflict',
				createdAt: '2026-08-28T11:00:00.000Z',
				updatedAt: '2026-08-28T11:00:00.000Z'
			}
		]),
		...overrides.store
	};
	const handlers = _createStaffCatalogConflictsHandlers({
		authorize: vi.fn(() => STAFF),
		createStore: vi.fn(() => store),
		...overrides
	});
	return { handlers, store };
}

describe('staff catalog conflicts load', () => {
	it('authorizes staff and groups conflict peers by offering', async () => {
		const { handlers, store } = setup();
		const result = await handlers.load({ locals: { staff: STAFF } });
		expect(store.listConflictCatalog).toHaveBeenCalledOnce();
		expect(result.unavailable).toBe(false);
		expect(result.groups).toHaveLength(1);
		expect(result.groups[0].offeringId).toBe(OFFERING);
		expect(result.groups[0].contributions).toHaveLength(2);
		expect(result.groups[0].contributions.map((row) => row.structured)).toEqual([
			{ books: [{ title: 'Left' }] },
			{ books: [{ title: 'Right' }] }
		]);
	});

	it('returns an empty unavailable queue when the store is down', async () => {
		const { handlers } = setup({
			store: {
				listConflictCatalog: vi.fn(async () => {
					throw new MaritoolsUnavailableError('down');
				})
			}
		});
		await expect(handlers.load({ locals: { staff: STAFF } })).resolves.toEqual({
			groups: [],
			unavailable: true
		});
	});
});
