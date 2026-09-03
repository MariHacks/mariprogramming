// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createStaffMemberDetailHandlers } from './+page.server.js';

describe('staff member detail route', () => {
	it('authorizes before loading the parsed, raw-paste-free detail DTO', async () => {
		const getStaffClubMember = vi.fn(async () => ({
			userId: 'member-1',
			displayName: 'Ada',
			courses: [],
			scheduleSharedAt: null
		}));
		const handlers = _createStaffMemberDetailHandlers({
			authorize: vi.fn(),
			createStore: () => ({ getStaffClubMember })
		});
		const data = await handlers.load({
			locals: { staff: { userId: 'staff' } },
			params: { userId: 'member-1' }
		});
		expect(data.member).toMatchObject({ userId: 'member-1', displayName: 'Ada' });
		expect(JSON.stringify(data)).not.toContain('paste');
		expect(getStaffClubMember).toHaveBeenCalledWith('member-1');
	});
});
