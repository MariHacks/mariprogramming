// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { buildStaffReportQueue } from './staff-reports.js';

const THREAD = '20000000-0000-4000-8000-000000000001';
const REPLY = '30000000-0000-4000-8000-000000000001';
const REPORT = '40000000-0000-4000-8000-000000000001';
const USER = 'reporter-1';

describe('buildStaffReportQueue', () => {
	it('maps thread reports to forum hrefs', async () => {
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
						status: 'open',
						resolvedAt: null,
						createdAt
					}
				],
				vi.fn()
			)
		).resolves.toEqual([
			{
				id: REPORT,
				targetKind: 'thread',
				targetId: THREAD,
				threadId: THREAD,
				reporterUserId: USER,
				reason: 'spam',
				status: 'open',
				resolvedAt: null,
				createdAt: '2026-08-28T16:00:00.000Z',
				href: `/tools/forum/${THREAD}`
			}
		]);
	});

	it('resolves reply reports through getReply', async () => {
		const getReply = vi.fn(async () => ({ id: REPLY, threadId: THREAD }));
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
				getReply
			)
		).resolves.toEqual([
			expect.objectContaining({
				targetKind: 'reply',
				targetId: REPLY,
				threadId: THREAD,
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
						createdAt: '2026-08-28T18:00:00.000Z'
					}
				],
				vi.fn(async () => null)
			)
		).resolves.toEqual([
			expect.objectContaining({
				threadId: null,
				href: null
			})
		]);
	});
});
