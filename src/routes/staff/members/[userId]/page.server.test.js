// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { ClubInputError, ClubUnavailableError } from '$lib/server/maritools/club-store.js';
import { _createStaffMemberDetailHandlers } from './+page.server.js';

function actionEvent(fields = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
	return {
		locals: { staff: { userId: 'staff' } },
		params: { userId: 'member-1' },
		request: {
			formData: vi.fn(async () => data)
		}
	};
}

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

	it('authorizes every mutation before reading the form or opening a store', async () => {
		const denied = new Error('redirect');
		const createStore = vi.fn();
		const handlers = _createStaffMemberDetailHandlers({
			authorize: vi.fn(() => {
				throw denied;
			}),
			createStore
		});
		const event = actionEvent({ mutePreset: '1h' });

		await expect(handlers.actions.mute(event)).rejects.toBe(denied);
		expect(event.request.formData).not.toHaveBeenCalled();
		expect(createStore).not.toHaveBeenCalled();
	});

	it('uses distinct fixed actions for moderation and member roles', async () => {
		const store = {
			muteMember: vi.fn(async () => ({})),
			banMember: vi.fn(async () => ({})),
			unmuteMember: vi.fn(async () => ({})),
			unbanMember: vi.fn(async () => ({})),
			promoteMember: vi.fn(async () => ({})),
			demoteMember: vi.fn(async () => ({}))
		};
		const handlers = _createStaffMemberDetailHandlers({
			authorize: vi.fn(),
			createStore: () => store
		});

		await expect(handlers.actions.mute(actionEvent({ mutePreset: '1h' }))).resolves.toEqual({
			updated: true,
			control: 'mute'
		});
		await expect(handlers.actions.ban(actionEvent({ banPreset: 'permanent' }))).resolves.toEqual({
			updated: true,
			control: 'ban'
		});
		await handlers.actions.unmute(actionEvent());
		await handlers.actions.unban(actionEvent());
		const forgedPromotion = actionEvent({ role: 'staff' });
		await handlers.actions.promoteExecutive(forgedPromotion);
		await handlers.actions.demoteMember(actionEvent());

		expect(store.muteMember).toHaveBeenCalledWith('member-1', expect.any(Date));
		expect(store.banMember).toHaveBeenCalledWith('member-1', { permanent: true });
		expect(store.unmuteMember).toHaveBeenCalledWith('member-1');
		expect(store.unbanMember).toHaveBeenCalledWith('member-1');
		expect(store.promoteMember).toHaveBeenCalledWith('member-1');
		expect(store.demoteMember).toHaveBeenCalledWith('member-1');
		expect(forgedPromotion.request.formData).not.toHaveBeenCalled();
	});

	it('supports a timed ban', async () => {
		const banMember = vi.fn(async () => ({}));
		const handlers = _createStaffMemberDetailHandlers({
			authorize: vi.fn(),
			createStore: () => ({ banMember })
		});

		await expect(handlers.actions.ban(actionEvent({ banPreset: '30d' }))).resolves.toEqual({
			updated: true,
			control: 'ban'
		});
		expect(banMember).toHaveBeenCalledWith('member-1', { until: expect.any(Date) });
	});

	it('rejects a missing target without opening a store', async () => {
		const createStore = vi.fn();
		const handlers = _createStaffMemberDetailHandlers({ authorize: vi.fn(), createStore });
		const event = actionEvent();
		event.params.userId = '   ';

		await expect(handlers.actions.unban(event)).resolves.toMatchObject({
			status: 400,
			data: { error: 'Pick a member first.' }
		});
		expect(createStore).not.toHaveBeenCalled();
	});

	it.each([
		[new ClubInputError('conflict'), 400, 'That member control could not be applied.'],
		[new ClubUnavailableError(), 503, 'Member controls are unavailable. Try again.']
	])('maps bounded control failures without exposing internals', async (failure, status, message) => {
		const handlers = _createStaffMemberDetailHandlers({
			authorize: vi.fn(),
			createStore: () => ({
				promoteMember: vi.fn(async () => {
					throw failure;
				})
			})
		});

		await expect(handlers.actions.promoteExecutive(actionEvent())).resolves.toMatchObject({
			status,
			data: { error: message }
		});
	});

	it('rethrows unexpected control failures', async () => {
		const failure = new Error('unexpected');
		const handlers = _createStaffMemberDetailHandlers({
			authorize: vi.fn(),
			createStore: () => ({
				demoteMember: vi.fn(async () => {
					throw failure;
				})
			})
		});

		await expect(handlers.actions.demoteMember(actionEvent())).rejects.toBe(failure);
	});

	it('normalizes a missing target id', async () => {
		const createStore = vi.fn();
		const handlers = _createStaffMemberDetailHandlers({ authorize: vi.fn(), createStore });
		const event = actionEvent();
		event.params.userId = null;

		await expect(handlers.actions.unmute(event)).resolves.toMatchObject({ status: 400 });
		expect(createStore).not.toHaveBeenCalled();
	});

	it('returns a 404 when the member does not exist', async () => {
		const handlers = _createStaffMemberDetailHandlers({
			authorize: vi.fn(),
			createStore: () => ({ getStaffClubMember: vi.fn(async () => null) })
		});

		await expect(
			handlers.load({ locals: { staff: {} }, params: { userId: 'missing' } })
		).rejects.toMatchObject({ status: 404, body: { message: 'Club member not found' } });
	});

	it('returns an unavailable detail when the store is down', async () => {
		const handlers = _createStaffMemberDetailHandlers({
			authorize: vi.fn(),
			createStore: () => ({
				getStaffClubMember: vi.fn(async () => {
					throw new ClubUnavailableError();
				})
			})
		});

		await expect(
			handlers.load({ locals: { staff: {} }, params: { userId: 'member-1' } })
		).resolves.toEqual({ member: null, unavailable: true });
	});

	it('rethrows unexpected detail failures', async () => {
		const failure = new Error('boom');
		const handlers = _createStaffMemberDetailHandlers({
			authorize: vi.fn(),
			createStore: () => ({
				getStaffClubMember: vi.fn(async () => {
					throw failure;
				})
			})
		});

		await expect(
			handlers.load({ locals: { staff: {} }, params: { userId: 'member-1' } })
		).rejects.toBe(failure);
	});
});
