// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import * as environment from '../config/environment.js';
import {
	MariToolsConflictError,
	MariToolsNotFoundError,
	MariToolsUnavailableError,
	MariToolsValidationError
} from './repository.js';
import {
	createClubStore,
	ClubInputError,
	ClubUnavailableError,
	openClubStore
} from './club-store.js';

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
		muteUser: vi.fn(async (userId, until) => ({ userId, mutedUntil: until })),
		banUser: vi.fn(async (userId, options) => ({ userId, bannedUntil: options.until })),
		unmuteUser: vi.fn(async (userId) => ({ userId, mutedUntil: null })),
		unbanUser: vi.fn(async (userId) => ({ userId, bannedAt: null, bannedUntil: null })),
		setMemberRole: vi.fn(async (userId, role) => ({ userId, role })),
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
		await expect(
			store.joinProgrammingClub({ ...joinInput, yearLevel: 'fourth' })
		).rejects.toBeInstanceOf(ClubInputError);
		await expect(
			store.joinProgrammingClub({ ...joinInput, username: 'a b' })
		).rejects.toBeInstanceOf(ClubInputError);
	});

	it('rejects every malformed signup field and accepts a team account', async () => {
		const store = createClubStore(repository());
		const invalidInputs = [
			{ userId: null },
			{ userId: '' },
			{ studentId: '123' },
			{ experienceLevel: 'expert' },
			{ program: 'Unknown Program' },
			{ yearLevel: 'fourth' },
			{ email: null },
			{ username: 'ab' },
			{ firstName: '' },
			{ lastName: 'x'.repeat(81) },
			{ profileImageDataUrl: 42 },
			{ profileImageDataUrl: `data:image/png;base64,${'A'.repeat(750_001)}` },
			{ interests: null },
			{ interests: [] },
			{ interests: ['web', 'web'] },
			{ interests: ['web', 'unknown'] },
			{ clubGoals: 42 }
		];
		for (const override of invalidInputs) {
			await expect(store.joinProgrammingClub({ ...joinInput, ...override })).rejects.toBeInstanceOf(
				ClubInputError
			);
		}

		const inner = repository();
		await createClubStore(inner).joinProgrammingClub({
			...joinInput,
			email: 'team@marihacks.com',
			profileImageDataUrl: '',
			clubGoals: null
		});
		expect(inner.joinProgrammingClub).toHaveBeenCalledWith(
			expect.objectContaining({ role: 'staff', profileImageDataUrl: null, clubGoals: null })
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
		await expect(
			store.joinProgrammingClub({ ...joinInput, clubGoals: '   ' })
		).resolves.toMatchObject({
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

	it('returns null or an empty course list when a member has no usable schedule', async () => {
		await expect(createClubStore(repository()).getStaffClubMember('ada')).resolves.toBeNull();
		await expect(
			createClubStore(
				repository({
					getStaffClubMember: vi.fn(async () => ({ userId: 'ada', schedulePaste: null }))
				})
			).getStaffClubMember('ada')
		).resolves.toMatchObject({ courses: [], scheduleInvalid: false });
		await expect(
			createClubStore(
				repository({
					getStaffClubMember: vi.fn(async () => ({ userId: 'ada', schedulePaste: 'invalid' }))
				})
			).getStaffClubMember('ada')
		).resolves.toMatchObject({ courses: [], scheduleInvalid: true });
	});

	it('applies member controls through fixed role values and moderation operations', async () => {
		const inner = repository();
		const store = createClubStore(inner);
		const muteUntil = new Date('2026-09-09T12:00:00.000Z');
		const banUntil = new Date('2026-10-02T12:00:00.000Z');

		await expect(store.muteMember('user-1', muteUntil)).resolves.toMatchObject({
			mutedUntil: muteUntil
		});
		await expect(store.banMember('user-1', { until: banUntil })).resolves.toMatchObject({
			bannedUntil: banUntil
		});
		await store.unmuteMember('user-1');
		await store.unbanMember('user-1');
		await store.promoteMember('user-1');
		await store.demoteMember('user-1');

		expect(inner.muteUser).toHaveBeenCalledWith('user-1', muteUntil);
		expect(inner.banUser).toHaveBeenCalledWith('user-1', { until: banUntil });
		expect(inner.unmuteUser).toHaveBeenCalledWith('user-1');
		expect(inner.unbanUser).toHaveBeenCalledWith('user-1');
		expect(inner.setMemberRole).toHaveBeenNthCalledWith(1, 'user-1', 'moderator');
		expect(inner.setMemberRole).toHaveBeenNthCalledWith(2, 'user-1', 'student');
	});

	it('delegates onboarding lookup, member listing, and permanent bans', async () => {
		const inner = repository({
			getProgrammingClubMembership: vi.fn(async () => ({ userId: 'user-1' })),
			listStaffClubMembers: vi.fn(async (filter) => ({ rows: [], filter }))
		});
		const store = createClubStore(inner);
		await expect(store.getMyClubOnboarding('user-1')).resolves.toMatchObject({ userId: 'user-1' });
		await expect(store.listStaffClubMembers()).resolves.toMatchObject({ rows: [] });
		await expect(store.listStaffClubMembers({ query: 'Ada', page: 2 })).resolves.toMatchObject({
			filter: { query: 'Ada', page: 2 }
		});
		await store.banMember('user-1', { permanent: true });
		expect(inner.banUser).toHaveBeenLastCalledWith('user-1', { until: null });
	});

	it('maps repository failures without hiding unexpected errors', async () => {
		const cases = [
			[new ClubInputError('local'), ClubInputError],
			[new ClubUnavailableError(), ClubUnavailableError],
			[new MariToolsValidationError(), ClubInputError],
			[new MariToolsConflictError(), ClubInputError],
			[new MariToolsNotFoundError(), ClubUnavailableError],
			[new MariToolsUnavailableError(), ClubUnavailableError]
		];
		for (const [error, Expected] of cases) {
			const store = createClubStore(
				repository({
					getProgrammingClubMembership: vi.fn(async () => {
						throw error;
					})
				})
			);
			await expect(store.getMyClubOnboarding('user-1')).rejects.toBeInstanceOf(Expected);
		}

		const noCode = new MariToolsValidationError();
		noCode.code = null;
		await expect(
			createClubStore(
				repository({
					getProgrammingClubMembership: vi.fn(async () => {
						throw noCode;
					})
				})
			).getMyClubOnboarding('user-1')
		).rejects.toMatchObject({ code: 'invalid' });

		const unexpected = new Error('unexpected');
		await expect(
			createClubStore(
				repository({
					getProgrammingClubMembership: vi.fn(async () => {
						throw unexpected;
					})
				})
			).getMyClubOnboarding('user-1')
		).rejects.toBe(unexpected);
	});
});

describe('openClubStore', () => {
	afterEach(() => vi.restoreAllMocks());

	it('builds a store from runtime configuration', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockReturnValue({
			databaseUrl: 'postgresql://runtime:secret@db.example/club'
		});
		expect(typeof openClubStore().joinProgrammingClub).toBe('function');
	});

	it('maps missing configuration and preserves local unavailable errors', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockImplementation(() => {
			throw new Error('missing');
		});
		expect(() => openClubStore()).toThrow(ClubUnavailableError);
		vi.mocked(environment.readRuntimeEnvironment).mockImplementation(() => {
			throw new ClubUnavailableError();
		});
		expect(() => openClubStore()).toThrow(ClubUnavailableError);
	});
});
