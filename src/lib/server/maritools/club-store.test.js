// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import { createClubStore, ClubInputError } from './club-store.js';

const joinedAt = new Date('2026-09-02T12:00:00.000Z');

function repository(overrides = {}) {
	return {
		joinProgrammingClub: vi.fn(async (input) => ({ ...input, createdAt: joinedAt })),
		updateMemberProfile: vi.fn(async (input) => ({ ...input, updatedAt: joinedAt })),
		getProgrammingClubMembership: vi.fn(async () => null),
		completeProgrammingClubOnboarding: vi.fn(async () => ({
			requiredFormCompletedAt: joinedAt
		})),
		shareSavedScheduleWithClub: vi.fn(async () => ({ scheduleSharedAt: joinedAt })),
		stopSharingScheduleWithClub: vi.fn(async () => ({ scheduleSharedAt: null })),
		listStaffClubMembers: vi.fn(async () => ({ rows: [], totalCount: 0 })),
		getStaffClubMember: vi.fn(async () => null),
		listSharedClubSchedules: vi.fn(async () => []),
		...overrides
	};
}

const joinInput = Object.freeze({
	userId: 'user-1',
	email: 'ada@example.com',
	studentId: '2530622',
	username: 'Ada_Codes',
	firstName: 'Ada',
	lastName: 'Lovelace',
	profileImageDataUrl: null,
	program: 'Science, Pure and Applied Science',
	yearLevel: 'second',
	experienceLevel: 'learning',
	interests: ['web', 'games'],
	clubGoals: 'Run more project nights'
});

describe('programming club store', () => {
	it('validates member identity edits and preserves the avatar when omitted', async () => {
		const inner = repository();
		const store = createClubStore(inner);

		await expect(
			store.updateMemberProfile({
				userId: 'user-1',
				username: 'Ada_Codes',
				firstName: ' Ada ',
				lastName: ' Lovelace '
			})
		).resolves.toMatchObject({
			userId: 'user-1',
			username: 'Ada_Codes',
			firstName: 'Ada',
			lastName: 'Lovelace'
		});
		expect(inner.updateMemberProfile).toHaveBeenCalledWith({
			userId: 'user-1',
			username: 'Ada_Codes',
			firstName: 'Ada',
			lastName: 'Lovelace'
		});

		await store.updateMemberProfile({
			userId: 'user-1',
			username: 'ada_codes',
			firstName: 'Ada',
			lastName: 'Lovelace',
			profileImageDataUrl: 'data:image/png;base64,YQ=='
		});
		expect(inner.updateMemberProfile).toHaveBeenLastCalledWith(
			expect.objectContaining({ profileImageDataUrl: 'data:image/png;base64,YQ==' })
		);

		await expect(
			store.updateMemberProfile({
				userId: 'user-1',
				username: 'bad name',
				firstName: 'Ada',
				lastName: 'Lovelace'
			})
		).rejects.toBeInstanceOf(ClubInputError);
		await expect(
			store.updateMemberProfile({
				userId: 'user-1',
				username: 'ada_codes',
				firstName: 'Ada',
				lastName: 'Lovelace',
				profileImageDataUrl: 'not-an-image'
			})
		).rejects.toBeInstanceOf(ClubInputError);
	});

	it('joins atomically with the member profile and validates controlled answers', async () => {
		const inner = repository();
		const store = createClubStore(inner);
		await expect(store.joinProgrammingClub(joinInput)).resolves.toMatchObject({
			program: joinInput.program,
			experienceLevel: 'learning'
		});
		expect(inner.joinProgrammingClub).toHaveBeenCalledWith({
			...joinInput,
			interests: ['games', 'web'],
			staffVisibilityAccepted: true,
			role: 'student'
		});
		expect(JSON.stringify(inner.joinProgrammingClub.mock.calls)).not.toContain('nimAccepted');
		await expect(
			store.joinProgrammingClub({ ...joinInput, interests: ['unknown'] })
		).rejects.toBeInstanceOf(ClubInputError);
		await expect(store.joinProgrammingClub({ ...joinInput, yearLevel: 'fourth' })).rejects.toBeInstanceOf(
			ClubInputError
		);
		await expect(store.joinProgrammingClub({ ...joinInput, username: 'a b' })).rejects.toBeInstanceOf(
			ClubInputError
		);
	});

	it('accepts omitted or blank club goals while retaining the maximum length', async () => {
		const inner = repository();
		const store = createClubStore(inner);

		const withoutGoals = { ...joinInput };
		delete withoutGoals.clubGoals;
		await expect(store.joinProgrammingClub(withoutGoals)).resolves.toMatchObject({
			clubGoals: null
		});
		await expect(store.joinProgrammingClub({ ...joinInput, clubGoals: '   ' })).resolves.toMatchObject({
			clubGoals: null
		});
		await expect(
			store.joinProgrammingClub({ ...joinInput, clubGoals: 'x'.repeat(1001) })
		).rejects.toBeInstanceOf(ClubInputError);
	});

	it('shares and unshares only an existing valid saved schedule', async () => {
		const inner = repository();
		const store = createClubStore(inner);
		await expect(store.shareSavedScheduleWithClub('user-1')).resolves.toMatchObject({
			scheduleSharedAt: joinedAt
		});
		await expect(store.stopSharingScheduleWithClub('user-1')).resolves.toMatchObject({
			scheduleSharedAt: null
		});
		expect(inner.shareSavedScheduleWithClub).toHaveBeenCalledWith('user-1');
		expect(inner.stopSharingScheduleWithClub).toHaveBeenCalledWith('user-1');
	});

	it('records completion of the required membership form', async () => {
		const inner = repository();
		const result = await createClubStore(inner).completeRequiredForm('user-1');
		expect(result.requiredFormCompletedAt).toEqual(joinedAt);
		expect(inner.completeProgrammingClubOnboarding).toHaveBeenCalledWith('user-1');
	});

	it('builds deterministic weekday availability and never returns saved raw paste', async () => {
		const inner = repository({
			listSharedClubSchedules: vi.fn(async () => [
				{ userId: 'ada', paste: CANONICAL_OMNIVOX_SCHEDULE },
				{ userId: 'bad', paste: 'not an Omnivox schedule' },
				{ userId: 'missing', paste: null }
			])
		});
		const store = createClubStore(inner);
		const aggregate = await store.getStaffMeetingAvailability();
		expect(aggregate).toMatchObject({ denominator: 1, invalidScheduleCount: 2 });
		expect(aggregate.cells).toHaveLength(100);
		expect(aggregate.cells[0]).toMatchObject({ weekday: 'Mon', time: '08:00', freeCount: 1 });
		expect(JSON.stringify(aggregate)).not.toContain(CANONICAL_OMNIVOX_SCHEDULE);
	});

	it('returns parsed courses, never the staff member raw schedule paste', async () => {
		const inner = repository({
			getStaffClubMember: vi.fn(async () => ({
				userId: 'ada',
				displayName: 'Ada',
				scheduleSharedAt: joinedAt,
				schedulePaste: CANONICAL_OMNIVOX_SCHEDULE
			}))
		});
		const member = await createClubStore(inner).getStaffClubMember('ada');
		expect(member.courses.length).toBeGreaterThan(0);
		expect(member).not.toHaveProperty('schedulePaste');
		expect(JSON.stringify(member)).not.toContain(CANONICAL_OMNIVOX_SCHEDULE);
	});
});
