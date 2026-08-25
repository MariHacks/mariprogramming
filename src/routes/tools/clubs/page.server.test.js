// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { prerender, _createHandlers } from './+page.server.js';

function handlers(overrides = {}) {
	const store = {
		listClubs: vi.fn(async () => [{ id: 'c1', name: 'Robotics', links: [] }]),
		getProfile: vi.fn(async () => ({ role: 'student' })),
		isStaff: vi.fn(() => false),
		listPendingClubSubmissions: vi.fn(async () => []),
		submitClub: vi.fn(async () => ({})),
		createClub: vi.fn(async () => ({})),
		setClubSubmissionStatus: vi.fn(async () => ({})),
		...overrides.store
	};
	return {
		..._createHandlers({ createStore: vi.fn(() => store) }),
		store
	};
}

describe('clubs page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('lists published clubs for guests', async () => {
		const current = handlers();
		const data = await current.load({ locals: {}, url: new URL('https://club.example/tools/clubs') });
		expect(data.clubs).toHaveLength(1);
		expect(data.signedIn).toBe(false);
	});
});
