// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError
} from '$lib/server/maritools/community-store.js';
import { _createStaffReportsHandlers } from './+page.server.js';

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});
const THREAD = '20000000-0000-4000-8000-000000000001';
const REPLY = '30000000-0000-4000-8000-000000000001';
const REPORT = '40000000-0000-4000-8000-000000000001';
const AUTHOR = 'author-1';

function setup(overrides = {}) {
	const store = {
		listReports: vi.fn(async () => [
			{
				id: REPORT,
				targetKind: 'thread',
				targetId: THREAD,
				reporterUserId: 'reporter-1',
				reason: 'spam',
				status: 'open',
				resolvedAt: null,
				createdAt: new Date('2026-08-28T16:00:00.000Z')
			}
		]),
		getReply: vi.fn(async () => ({
			id: REPLY,
			threadId: THREAD,
			authorUserId: AUTHOR,
			authorDisplayName: 'Ada'
		})),
		getThread: vi.fn(async () => ({
			id: THREAD,
			title: 'Quiet study hall',
			authorUserId: AUTHOR,
			authorDisplayName: 'Ada'
		})),
		getProfile: vi.fn(async () => ({ displayName: 'Blake' })),
		setReportStatus: vi.fn(async (id, status) => ({
			id,
			status,
			resolvedAt: new Date('2026-08-28T19:00:00.000Z')
		})),
		lockThread: vi.fn(async (id) => ({ id, lockedAt: new Date() })),
		muteUser: vi.fn(async (id) => ({ userId: id, isMuted: true })),
		banUser: vi.fn(async (id) => ({ userId: id, isBanned: true })),
		...overrides.store
	};
	const handlers = _createStaffReportsHandlers({
		authorize: vi.fn(() => STAFF),
		createStore: vi.fn(() => store),
		...overrides
	});
	return { handlers, store };
}

function actionEvent({ locals = { staff: STAFF }, form = {} } = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(form)) data.set(key, String(value));
	return {
		locals,
		request: { formData: async () => data }
	};
}

describe('staff reports load', () => {
	it('authorizes staff and lists open reports by default', async () => {
		const { handlers, store } = setup();
		const result = await handlers.load({
			locals: { staff: STAFF },
			url: new URL('https://club.example.com/staff/reports')
		});
		expect(result).toMatchObject({
			statusFilter: 'open',
			unavailable: false
		});
		expect(result.reports[0]).toMatchObject({
			id: REPORT,
			targetTitle: 'Quiet study hall',
			reporterDisplayName: 'Blake',
			subjectDisplayName: 'Ada',
			subjectUserId: AUTHOR,
			href: `/tools/forum/${THREAD}`,
			subjectProfileHref: `/tools/people/${AUTHOR}`
		});
		expect(store.listReports).toHaveBeenCalledWith({ status: 'open' });
	});

	it('passes an allowed status filter through to the store', async () => {
		const { handlers, store } = setup({
			store: {
				listReports: vi.fn(async () => [])
			}
		});
		await expect(
			handlers.load({
				locals: { staff: STAFF },
				url: new URL('https://club.example.com/staff/reports?status=resolved')
			})
		).resolves.toMatchObject({ statusFilter: 'resolved', reports: [], unavailable: false });
		expect(store.listReports).toHaveBeenCalledWith({ status: 'resolved' });
	});

	it('lists every report when status=all', async () => {
		const { handlers, store } = setup({
			store: {
				listReports: vi.fn(async () => [])
			}
		});
		await handlers.load({
			locals: { staff: STAFF },
			url: new URL('https://club.example.com/staff/reports?status=all')
		});
		expect(store.listReports).toHaveBeenCalledWith({});
	});

	it('resolves reply targets for forum links', async () => {
		const { handlers, store } = setup({
			store: {
				listReports: vi.fn(async () => [
					{
						id: REPORT,
						targetKind: 'reply',
						targetId: REPLY,
						reporterUserId: 'reporter-1',
						reason: 'harassment',
						status: 'open',
						resolvedAt: null,
						createdAt: new Date('2026-08-28T17:00:00.000Z')
					}
				])
			}
		});
		const result = await handlers.load({
			locals: { staff: STAFF },
			url: new URL('https://club.example.com/staff/reports')
		});
		expect(result.reports[0]).toMatchObject({
			targetKind: 'reply',
			threadId: THREAD,
			href: `/tools/forum/${THREAD}`,
			subjectUserId: AUTHOR
		});
		expect(store.getReply).toHaveBeenCalledWith(REPLY);
	});

	it('returns an unavailable queue when the store cannot open', async () => {
		const { handlers } = setup({
			createStore: vi.fn(() => {
				throw new MaritoolsUnavailableError();
			})
		});
		await expect(
			handlers.load({ locals: { staff: STAFF }, url: new URL('https://club.example.com/staff/reports') })
		).resolves.toEqual({
			reports: [],
			statusFilter: 'open',
			unavailable: true
		});
	});

	it('returns an unavailable queue when listing fails', async () => {
		const { handlers } = setup({
			store: {
				listReports: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(
			handlers.load({ locals: { staff: STAFF }, url: new URL('https://club.example.com/staff/reports') })
		).resolves.toMatchObject({ unavailable: true, reports: [] });
	});

	it('rethrows unexpected load failures', async () => {
		const { handlers } = setup({
			store: {
				listReports: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			handlers.load({ locals: { staff: STAFF }, url: new URL('https://club.example.com/staff/reports') })
		).rejects.toThrow('boom');
	});
});

describe('staff reports actions', () => {
	it('resolves an open report', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.actions.resolve(actionEvent({ form: { reportId: REPORT } }))
		).resolves.toEqual({ updated: true, status: 'resolved' });
		expect(store.setReportStatus).toHaveBeenCalledWith(REPORT, 'resolved');
	});

	it('dismisses an open report', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.actions.dismiss(actionEvent({ form: { reportId: REPORT } }))
		).resolves.toEqual({ updated: true, status: 'dismissed' });
		expect(store.setReportStatus).toHaveBeenCalledWith(REPORT, 'dismissed');
	});

	it('locks the thread and leaves the report open', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.actions.lockThread(
				actionEvent({ form: { reportId: REPORT, threadId: THREAD, subjectUserId: AUTHOR } })
			)
		).resolves.toEqual({ updated: true, moderation: 'lock', reportOpen: true });
		expect(store.lockThread).toHaveBeenCalledWith(THREAD);
		expect(store.setReportStatus).not.toHaveBeenCalled();
	});

	it('mutes the author and leaves the report open', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.actions.muteAuthor(
				actionEvent({
					form: { reportId: REPORT, threadId: THREAD, subjectUserId: AUTHOR, mutePreset: '1h' }
				})
			)
		).resolves.toEqual({ updated: true, moderation: 'mute', reportOpen: true });
		expect(store.muteUser).toHaveBeenCalledWith(
			AUTHOR,
			expect.objectContaining({ until: expect.any(Date) })
		);
		expect(store.setReportStatus).not.toHaveBeenCalled();
	});

	it('bans the author for a timed window and leaves the report open', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.actions.banAuthor(
				actionEvent({
					form: { reportId: REPORT, threadId: THREAD, subjectUserId: AUTHOR, banPreset: '30d' }
				})
			)
		).resolves.toEqual({ updated: true, moderation: 'ban', reportOpen: true });
		expect(store.banUser).toHaveBeenCalledWith(
			AUTHOR,
			expect.objectContaining({ until: expect.any(Date) })
		);
		expect(store.setReportStatus).not.toHaveBeenCalled();
	});

	it('bans permanently by default without closing the report', async () => {
		const { handlers, store } = setup();
		await expect(
			handlers.actions.banAuthor(
				actionEvent({ form: { reportId: REPORT, threadId: THREAD, subjectUserId: AUTHOR } })
			)
		).resolves.toEqual({ updated: true, moderation: 'ban', reportOpen: true });
		expect(store.banUser).toHaveBeenCalledWith(AUTHOR, { permanent: true });
		expect(store.setReportStatus).not.toHaveBeenCalled();
	});

	it('rejects a missing report id', async () => {
		const { handlers, store } = setup();
		expect((await handlers.actions.resolve(actionEvent({ form: {} }))).status).toBe(400);
		expect(store.setReportStatus).not.toHaveBeenCalled();
	});

	it('maps store input errors to a bounded failure', async () => {
		const { handlers } = setup({
			store: {
				setReportStatus: vi.fn(async () => {
					throw new MaritoolsInputError('invalid');
				})
			}
		});
		expect(
			(await handlers.actions.dismiss(actionEvent({ form: { reportId: REPORT } }))).status
		).toBe(400);
	});

	it('maps store unavailability to a bounded failure', async () => {
		const { handlers } = setup({
			store: {
				setReportStatus: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(await handlers.actions.resolve(actionEvent({ form: { reportId: REPORT } }))).status
		).toBe(503);
	});

	it('rethrows unexpected store failures', async () => {
		const { handlers } = setup({
			store: {
				setReportStatus: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			handlers.actions.resolve(actionEvent({ form: { reportId: REPORT } }))
		).rejects.toThrow('boom');
	});
});
