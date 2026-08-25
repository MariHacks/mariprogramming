// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { publicReplyView, publicThreadView, createCommunityStore } from './community-store.js';
import { MariToolsValidationError } from './repository.js';

describe('community-store views', () => {
	it('omits author ids from public thread and reply views', () => {
		const thread = publicThreadView({
			id: 't1',
			authorUserId: 'secret',
			title: 'Tips',
			body: 'Bring a calculator',
			category: 'courses',
			createdAt: new Date()
		});
		expect(thread).not.toHaveProperty('authorUserId');
		expect(JSON.stringify(thread)).not.toContain('secret');

		const reply = publicReplyView({
			id: 'r1',
			threadId: 't1',
			authorUserId: 'secret',
			body: 'Thanks',
			createdAt: new Date()
		});
		expect(reply).not.toHaveProperty('authorUserId');
	});
});

describe('createCommunityStore', () => {
	it('maps repository validation errors', async () => {
		const store = createCommunityStore({
			listPublishedClubs: vi.fn(async () => {
				throw new MariToolsValidationError();
			})
		});
		await expect(store.listClubs()).rejects.toMatchObject({ name: 'MaritoolsInputError' });
	});
});
