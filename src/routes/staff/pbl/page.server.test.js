// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createStaffPblHandlers } from './+page.server.js';

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});

describe('staff PBL teams load', () => {
	it('requires staff and returns rooms from the store', async () => {
		const authorize = vi.fn(() => STAFF);
		const rooms = [
			{
				code: 'AB23JK',
				teamName: 'Lab table 3',
				members: [{ userId: 'u1', email: 'lab@marihacks.com' }]
			}
		];
		const handlers = _createStaffPblHandlers({
			authorize,
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async (operation) =>
				operation({
					listStaffRooms: async () => rooms
				}),
			createRepository: (transaction) => transaction,
			createStore: (repository) => repository
		});
		const result = await handlers.load({ locals: { staff: STAFF } });
		expect(authorize).toHaveBeenCalledWith({ staff: STAFF });
		expect(result).toEqual({ rooms, unavailable: false });
	});

	it('returns an empty unavailable view when the room service is down', async () => {
		const handlers = _createStaffPblHandlers({
			authorize: vi.fn(() => STAFF),
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async () => {
				throw new Error('db down');
			}
		});
		const result = await handlers.load({ locals: { staff: STAFF } });
		expect(result).toEqual({ rooms: [], unavailable: true });
	});
});
