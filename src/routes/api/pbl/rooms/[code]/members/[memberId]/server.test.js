// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { DELETE, _createPblEjectMemberEndpoint } from './+server.js';

const MEMBER = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function runtime(store) {
	return _createPblEjectMemberEndpoint({
		ensureSchema: vi.fn(async () => undefined),
		readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
		withTransaction: async (operation) => operation(store),
		createRepository: (transaction) => transaction,
		createStore: (repository) => repository
	});
}

describe('DELETE /api/pbl/rooms/[code]/members/[memberId]', () => {
	it('lets the leader eject a teammate and returns the refreshed room', async () => {
		const ejectMember = vi.fn(async () => ({ code: 'AB23JK', memberCount: 1 }));
		const getRoom = vi.fn(async () => ({
			code: 'AB23JK',
			memberCount: 1,
			driverMemberId: MEMBER,
			isDriver: true,
			members: [{ memberId: MEMBER, email: 'lead@marihacks.com', name: 'Lead' }]
		}));
		const { DELETE } = runtime({ ejectMember, getRoom });
		const response = await DELETE({
			params: { code: 'AB23JK', memberId: OTHER },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK/members/' + OTHER, {
				method: 'DELETE',
				headers: { cookie: `pbl_member=${MEMBER}` }
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK/members/' + OTHER)
		});
		expect(response.status).toBe(200);
		expect(ejectMember).toHaveBeenCalledWith({
			code: 'AB23JK',
			actorMemberId: MEMBER,
			targetMemberId: OTHER
		});
		expect(getRoom).toHaveBeenCalledWith('AB23JK', MEMBER);
		expect(await response.json()).toMatchObject({
			code: 'AB23JK',
			memberCount: 1,
			isDriver: true
		});
	});

	it('maps store failures for non-leaders', async () => {
		const { PblInputError } = await import('$lib/server/pbl/store.js');
		const { DELETE } = runtime({
			ejectMember: async () => {
				throw new PblInputError('Only the team leader can remove teammates.', 403);
			},
			getRoom: async () => ({})
		});
		const forbidden = await DELETE({
			params: { code: 'AB23JK', memberId: OTHER },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK/members/' + OTHER, {
				method: 'DELETE',
				headers: { cookie: `pbl_member=${MEMBER}` }
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK/members/' + OTHER)
		});
		expect(forbidden.status).toBe(403);
		expect(await forbidden.json()).toMatchObject({
			error: 'Only the team leader can remove teammates.'
		});
	});
});
