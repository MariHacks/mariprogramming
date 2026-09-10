// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createStaffPblDetailHandlers } from './+page.server.js';

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});

const MEMBER_A = 'a'.repeat(32);
const MEMBER_B = 'b'.repeat(32);

/** @param {Record<string, string>} [fields] */
function formEvent(fields = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return {
		locals: { staff: STAFF },
		params: { code: 'AB23JK' },
		request: { formData: vi.fn(async () => data) }
	};
}

function handlersWithStore(store) {
	const authorize = vi.fn(() => STAFF);
	return {
		authorize,
		handlers: _createStaffPblDetailHandlers({
			authorize,
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async (operation) => operation(store),
			createRepository: (transaction) => transaction,
			createStore: (repository) => repository
		})
	};
}

describe('staff PBL team detail load', () => {
	it('requires staff and returns getStaffRoom payload', async () => {
		const room = { code: 'AB23JK', teamName: 'Lab', stepSources: {}, submissions: [] };
		const { authorize, handlers } = handlersWithStore({
			getStaffRoom: async () => room
		});
		const result = await handlers.load({
			locals: { staff: STAFF },
			params: { code: 'AB23JK' }
		});
		expect(authorize).toHaveBeenCalledWith({ staff: STAFF });
		expect(result).toEqual({ room, unavailable: false });
	});
});

describe('staff PBL team detail actions', () => {
	it('authorizes mutations before reading the form', async () => {
		const denied = Object.assign(new Error('denied'), { status: 403 });
		const authorize = vi.fn(() => {
			throw denied;
		});
		const handlers = _createStaffPblDetailHandlers({ authorize });
		const event = formEvent({ memberId: MEMBER_B });
		await expect(handlers.actions.ejectMember(event)).rejects.toBe(denied);
		expect(event.request.formData).not.toHaveBeenCalled();
	});

	it('ejects a member through staffEjectMember', async () => {
		const staffEjectMember = vi.fn(async () => ({ code: 'AB23JK' }));
		const { handlers } = handlersWithStore({ staffEjectMember });
		await expect(handlers.actions.ejectMember(formEvent({ memberId: MEMBER_B }))).resolves.toEqual({
			ok: true,
			action: 'ejectMember'
		});
		expect(staffEjectMember).toHaveBeenCalledWith({
			code: 'AB23JK',
			targetMemberId: MEMBER_B
		});
	});

	it('transfers leadership through transferDriver', async () => {
		const transferDriver = vi.fn(async () => ({
			code: 'AB23JK',
			driverMemberId: MEMBER_B
		}));
		const { handlers } = handlersWithStore({ transferDriver });
		await expect(
			handlers.actions.transferLeader(formEvent({ memberId: MEMBER_B }))
		).resolves.toEqual({
			ok: true,
			action: 'transferLeader'
		});
		expect(transferDriver).toHaveBeenCalledWith({
			code: 'AB23JK',
			newDriverMemberId: MEMBER_B
		});
	});

	it('requires the room code before disbanding and redirects on success', async () => {
		const disbandRoom = vi.fn(async () => ({ ok: true, code: 'AB23JK' }));
		const { handlers } = handlersWithStore({ disbandRoom });
		await expect(handlers.actions.disbandTeam(formEvent({ confirm: 'WRONG' }))).resolves.toMatchObject({
			status: 400
		});
		expect(disbandRoom).not.toHaveBeenCalled();

		await expect(handlers.actions.disbandTeam(formEvent({ confirm: 'ab23jk' }))).rejects.toMatchObject({
			status: 303,
			location: '/staff/pbl'
		});
		expect(disbandRoom).toHaveBeenCalledWith({ code: 'AB23JK' });
	});

	it('rejects blank member targets without calling the store', async () => {
		const staffEjectMember = vi.fn();
		const transferDriver = vi.fn();
		const { handlers } = handlersWithStore({ staffEjectMember, transferDriver });
		await expect(handlers.actions.ejectMember(formEvent())).resolves.toMatchObject({ status: 400 });
		await expect(handlers.actions.transferLeader(formEvent({ memberId: '  ' }))).resolves.toMatchObject({
			status: 400
		});
		expect(staffEjectMember).not.toHaveBeenCalled();
		expect(transferDriver).not.toHaveBeenCalled();
	});
});
