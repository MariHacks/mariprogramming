// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { buildStaffReportQueue } from './staff-reports.js';

const THREAD = '20000000-0000-4000-8000-000000000001';
const REPLY = '30000000-0000-4000-8000-000000000001';
const REPORT = '40000000-0000-4000-8000-000000000001';
const USER = 'reporter-1';
const AUTHOR = 'author-1';

describe('buildStaffReportQueue', () => {
	it('maps thread reports to forum hrefs and human labels', async () => {
		const createdAt = new Date('2026-08-28T16:00:00.000Z');
		await expect(
			buildStaffReportQueue(
				[
					{
						id: REPORT,
						targetKind: 'thread',
						targetId: THREAD,
						reporterUserId: USER,
						reason: 'spam',
						status: 'resolved',
						resolvedAt: '2026-08-28T19:00:00.000Z',
						createdAt
					}
				],
				{
					getReply: vi.fn(),
					getThread: vi.fn(async () => ({
						title: 'Quiet study hall',
						authorUserId: AUTHOR,
						authorDisplayName: 'Ada'
					})),
					getProfile: vi.fn(async () => ({ displayName: 'Blake' }))
				}
			)
		).resolves.toEqual([
			expect.objectContaining({
				id: REPORT,
				targetKind: 'thread',
				targetId: THREAD,
				threadId: THREAD,
				targetTitle: 'Quiet study hall',
				reporterUserId: USER,
				reporterDisplayName: 'Blake',
				subjectUserId: AUTHOR,
				subjectDisplayName: 'Ada',
				reason: 'spam',
				status: 'resolved',
				href: `/tools/forum/${THREAD}`,
				subjectProfileHref: `/tools/people/${AUTHOR}`,
				reporterProfileHref: `/tools/people/${USER}`
			})
		]);
	});

	it('resolves reply reports through getReply', async () => {
		const getReply = vi.fn(async () => ({
			id: REPLY,
			threadId: THREAD,
			authorUserId: AUTHOR,
			authorDisplayName: 'Ada'
		}));
		await expect(
			buildStaffReportQueue(
				[
					{
						id: REPORT,
						targetKind: 'reply',
						targetId: REPLY,
						reporterUserId: USER,
						reason: 'harassment',
						status: 'open',
						resolvedAt: null,
						createdAt: '2026-08-28T17:00:00.000Z'
					}
				],
				{
					getReply,
					getThread: vi.fn(async () => ({ title: 'Campus tips' })),
					getProfile: vi.fn(async () => ({ displayName: null }))
				}
			)
		).resolves.toEqual([
			expect.objectContaining({
				targetKind: 'reply',
				targetId: REPLY,
				threadId: THREAD,
				targetTitle: 'Reply in “Campus tips”',
				subjectDisplayName: 'Ada',
				reporterDisplayName: 'Student',
				href: `/tools/forum/${THREAD}`
			})
		]);
		expect(getReply).toHaveBeenCalledWith(REPLY);
	});

	it('keeps reply reports linkable when the reply is missing', async () => {
		await expect(
			buildStaffReportQueue(
				[
					{
						id: REPORT,
						targetKind: 'reply',
						targetId: REPLY,
						reporterUserId: USER,
						reason: 'gone',
						status: 'open',
						resolvedAt: null,
						createdAt: null
					}
				],
				{
					getReply: vi.fn(async () => null),
					getThread: vi.fn(),
					getProfile: vi.fn(async () => null)
				}
			)
		).resolves.toEqual([
			expect.objectContaining({
				threadId: null,
				href: null,
				createdAt: '',
				reporterDisplayName: 'Student'
			})
		]);
	});

	it('still accepts a bare getReply function for older callers', async () => {
		await expect(
			buildStaffReportQueue(
				[
					{
						id: REPORT,
						targetKind: 'thread',
						targetId: THREAD,
						reporterUserId: USER,
						reason: 'legacy',
						status: 'open',
						resolvedAt: null,
						createdAt: '2026-08-28T16:00:00.000Z'
					}
				],
				vi.fn()
			)
		).resolves.toEqual([
			expect.objectContaining({
				threadId: THREAD,
				targetTitle: 'Thread',
				reporterDisplayName: 'Student',
				href: `/tools/forum/${THREAD}`
			})
		]);
	});
});
