// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createStaffMembersHandlers } from './+page.server.js';

const STAFF = { userId: 'staff-1', email: 'team@marihacks.com' };

describe('staff members route', () => {
	it('authorizes staff before loading roster and availability', async () => {
		const authorize = vi.fn(() => STAFF);
		const store = {
			listStaffClubMembers: vi.fn(async () => ({
				rows: [{ userId: 'u1', displayName: 'Ada' }],
				totalCount: 1
			})),
			getStaffMeetingAvailability: vi.fn(async () => ({
				denominator: 1,
				invalidScheduleCount: 0,
				cells: []
			}))
		};
		const handlers = _createStaffMembersHandlers({ authorize, createStore: () => store });
		await expect(
			handlers.load({
				locals: { staff: STAFF },
				url: new URL('https://club.test/staff/members?q=ada')
			})
		).resolves.toMatchObject({
			unavailable: false,
			listing: { totalCount: 1 },
			availability: { denominator: 1 }
		});
		expect(authorize).toHaveBeenCalledWith({ staff: STAFF });
		expect(store.listStaffClubMembers).toHaveBeenCalledWith({ query: 'ada', page: '1' });
	});

	it('does not convert non-staff denial into an empty roster', async () => {
		const denied = new Error('Staff access is required');
		const handlers = _createStaffMembersHandlers({
			authorize: () => {
				throw denied;
			},
			createStore: vi.fn()
		});
		await expect(
			handlers.load({ locals: {}, url: new URL('https://club.test/staff/members') })
		).rejects.toBe(denied);
	});
});
