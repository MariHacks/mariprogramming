// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { prerender, _createHandlers } from './+page.server.js';

function handlers(overrides = {}) {
	const store = {
		listThreads: vi.fn(async () => [
			{ id: 't1', title: 'Tips', category: 'courses', body: 'Hi', createdAt: new Date() }
		]),
		getProfile: vi.fn(async () => null),
		createThread: vi.fn(async () => ({ id: 't2', title: 'New', category: 'courses', body: 'x' }))
	};
	return _createHandlers({
		createStore: vi.fn(() => ({ ...store, ...overrides.store }))
	});
}

describe('forum page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('lists threads without author ids', async () => {
		const data = await handlers().load({
			locals: {},
			url: new URL('https://club.example/tools/forum')
		});
		expect(data.threads[0].title).toBe('Tips');
		expect(JSON.stringify(data)).not.toContain('authorUserId');
	});
});
