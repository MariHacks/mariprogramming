// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MaritoolsUnavailableError } from '$lib/server/maritools/student-store.js';
import { prerender, _createHandlers } from './+page.server.js';

const CLUB = {
	id: 'club-1',
	name: 'Robotics',
	slug: 'robotics',
	category: 'stem',
	description: 'Builds robots',
	links: [{ label: 'Discord', url: 'https://example.com' }]
};

function handlers(overrides = {}) {
	const store = {
		getPublishedClubBySlug: vi.fn(async () => CLUB),
		...overrides.store
	};
	return {
		..._createHandlers({
			createStore: vi.fn(() => store),
			...overrides
		}),
		store
	};
}

function event({ params = { slug: 'robotics' } } = {}) {
	return { params };
}

describe('club detail page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('loads a published club for anonymous visitors', async () => {
		const data = await handlers().load(event());
		expect(data.club).toEqual(CLUB);
		expect(JSON.stringify(data)).not.toMatch(/2530622/);
	});

	it('returns not found for missing clubs', async () => {
		const missing = handlers({ store: { getPublishedClubBySlug: vi.fn(async () => null) } });
		await expect(missing.load(event())).resolves.toMatchObject({ notFound: true, club: null });
	});

	it('returns unavailable and rethrows unexpected errors', async () => {
		const down = handlers({
			store: {
				getPublishedClubBySlug: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(down.load(event())).resolves.toMatchObject({ unavailable: true });
		const closed = handlers({
			createStore: vi.fn(() => {
				throw new MaritoolsUnavailableError();
			})
		});
		await expect(closed.load(event())).resolves.toMatchObject({ unavailable: true });
		const boom = handlers({
			store: {
				getPublishedClubBySlug: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(boom.load(event())).rejects.toThrow('boom');
	});
});
