// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createStaffPblDetailHandlers } from './+page.server.js';

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});

describe('staff PBL team detail load', () => {
	it('requires staff and returns getStaffRoom payload', async () => {
		const authorize = vi.fn(() => STAFF);
		const room = { code: 'AB23JK', teamName: 'Lab', stepSources: {}, submissions: [] };
		const handlers = _createStaffPblDetailHandlers({
			authorize,
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async (operation) =>
				operation({
					getStaffRoom: async () => room
				}),
			createRepository: (transaction) => transaction,
			createStore: (repository) => repository
		});
		const result = await handlers.load({
			locals: { staff: STAFF },
			params: { code: 'AB23JK' }
		});
		expect(authorize).toHaveBeenCalledWith({ staff: STAFF });
		expect(result).toEqual({ room, unavailable: false });
	});
});
