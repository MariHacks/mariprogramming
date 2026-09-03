// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as environment from '../config/environment.js';
import {
	MariToolsConflictError,
	MariToolsNotFoundError,
	MariToolsUnavailableError,
	MariToolsValidationError
} from './repository.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	createStudentStore,
	openStudentStore
} from './student-store.js';

const USER = 'user-1';
const FLAT_ENTRY = {
	id: 'c1',
	termId: 'fall-2026',
	courseCode: '203-SN3-RE',
	title: 'Modern Physics',
	section: '00021',
	teacherName: 'Baharak Fatholahzadeh',
	structured: { assessments: [], books: [] },
	status: 'published'
};
const NESTED_ENTRY = {
	contribution: FLAT_ENTRY,
	offering: {
		termId: 'fall-2026',
		section: '00021',
		teacherName: 'Baharak Fatholahzadeh'
	},
	course: { code: '203-SN3-RE', canonicalTitle: 'Modern Physics' }
};

/** @param {any} row */
function flatFromNested(row) {
	if (!row?.contribution) return row;
	return {
		listTerms: vi.fn(async () => []),
		id: row.contribution.id,
		termId: row.offering?.termId ?? row.contribution.termId,
		courseCode: row.course?.code ?? row.contribution.courseCode,
		title: row.course?.canonicalTitle ?? row.contribution.title,
		section: row.offering?.section ?? row.contribution.section,
		teacherName: row.offering?.teacherName ?? row.contribution.teacherName,
		structured: row.contribution.structured,
		status: row.contribution.status
	};
}

/**
 * @param {any} [overrides]
 * @returns {any}
 */
function inner(overrides = {}) {
	return {
		getStudentProfile: vi.fn(async () => ({
			userId: USER,
			studentId: '2530622',
			displayName: 'Ada',
			role: 'student',
			nimDisclosureAcceptedAt: new Date()
		})),
		upsertStudentProfile: vi.fn(async () => ({})),
		acceptNimDisclosure: vi.fn(async () => undefined),
		listPublishedCatalog: vi.fn(async () => [FLAT_ENTRY]),
		listUserOutlines: vi.fn(async () => []),
		findExtraction: vi.fn(async () => null),
		saveOutlineDocument: vi.fn(async () => ({})),
		saveOutlineReview: vi.fn(async () => ({})),
		deleteOutlineDocument: vi.fn(async () => ({})),
		saveExtraction: vi.fn(async () => ({})),
		getSavedSchedule: vi.fn(async () => null),
		saveSchedule: vi.fn(async () => ({})),
		findOrCreateOffering: vi.fn(async () => ({ offering: { id: 'off-1' } })),
		publishCatalogContribution: vi.fn(async () => ({ conflict: false })),
		...overrides
	};
}

describe('createStudentStore', () => {
	it('lists terms through the repository', async () => {
		const listTerms = vi.fn(async () => [{ id: 'fall-2026', label: 'Fall 2026' }]);
		const store = createStudentStore(inner({ listTerms }));

		await expect(store.listTerms()).resolves.toEqual([{ id: 'fall-2026', label: 'Fall 2026' }]);
		expect(listTerms).toHaveBeenCalledOnce();
	});

	it('completes a student profile without accepting outline analysis', async () => {
		const repo = inner();
		const store = createStudentStore(repo);
		const profile = await store.completeProfile({
			userId: USER,
			email: 'ada@gmail.com',
			studentId: '2530622',
			displayName: 'Ada'
		});
		expect(profile).not.toHaveProperty('studentId');
		expect(JSON.stringify(profile)).not.toContain('2530622');
		expect(profile.displayName).toBe('Ada');
		expect(repo.acceptNimDisclosure).not.toHaveBeenCalled();
		expect(repo.upsertStudentProfile).toHaveBeenCalledWith(
			expect.objectContaining({ role: 'student', displayName: 'Ada' })
		);
	});

	it('records staff role and omits a blank display name', async () => {
		const repo = inner();
		const store = createStudentStore(repo);
		await store.completeProfile({
			userId: USER,
			email: 'team@marihacks.com',
			studentId: '2530622',
			displayName: ''
		});
		expect(repo.upsertStudentProfile).toHaveBeenCalledWith(
			expect.objectContaining({ role: 'staff', displayName: null })
		);
	});

	it('returns a redacted profile or null', async () => {
		const store = createStudentStore(inner());
		const profile = await store.getProfile(USER);
		expect(profile).not.toHaveProperty('studentId');
		expect(profile.displayName).toBe('Ada');
		const missing = createStudentStore(inner({ getStudentProfile: vi.fn(async () => null) }));
		await expect(missing.getProfile(USER)).resolves.toBeNull();
		await expect(
			missing.completeProfile({
				userId: USER,
				email: 'ada@gmail.com',
				studentId: '2530622'
			})
		).resolves.toBeNull();
	});

	it('rejects an invalid student number', async () => {
		const store = createStudentStore(inner());
		await expect(
			store.completeProfile({
				userId: USER,
				email: 'ada@gmail.com',
				studentId: '12'
			})
		).rejects.toMatchObject({ name: 'MaritoolsInputError', code: 'invalid-student-id' });
	});

	it('records the one-time Semester analysis confirmation', async () => {
		const repo = inner();
		const store = createStudentStore(repo);

		await expect(store.acceptOutlineAnalysis(USER)).resolves.toBeUndefined();
		expect(repo.acceptNimDisclosure).toHaveBeenCalledWith(USER);
	});

	it('maps published catalog rows and nested repository rows', async () => {
		const store = createStudentStore(inner());
		const listed = await store.listPublishedCatalog({ termId: 'fall-2026', query: '203' });
		expect(listed[0].courseCode).toBe('203-SN3-RE');
		expect(JSON.stringify(listed)).not.toContain(USER);
		await expect(store.listPublishedCatalog()).resolves.toHaveLength(1);

		const nested = createStudentStore(
			inner({
				listPublishedCatalog: vi.fn(async () => [flatFromNested(NESTED_ENTRY)])
			})
		);
		await expect(nested.listPublishedCatalog({ query: '203' })).resolves.toHaveLength(1);
		await expect(store.listPublishedCatalog({ query: 'zzz' })).resolves.toEqual([]);
		const uncoded = createStudentStore(
			inner({
				listPublishedCatalog: vi.fn(async () => [{ ...FLAT_ENTRY, courseCode: undefined }])
			})
		);
		await expect(uncoded.listPublishedCatalog({ query: '203' })).resolves.toEqual([]);
	});

	it('maps every course catalog field and nullable relation', async () => {
		const createdAt = new Date('2026-08-30T12:00:00.000Z');
		const listCatalogForCourse = vi.fn(async () => [
			{
				...FLAT_ENTRY,
				offeringId: 'off-1',
				courseId: 'course-1',
				createdAt
			},
			{ ...FLAT_ENTRY, id: 'c2' }
		]);
		const store = createStudentStore(inner({ listCatalogForCourse }));

		await expect(store.listCatalogForCourse('course-1')).resolves.toEqual([
			{
				...FLAT_ENTRY,
				offeringId: 'off-1',
				courseId: 'course-1',
				createdAt
			},
			{
				...FLAT_ENTRY,
				id: 'c2',
				offeringId: null,
				courseId: null,
				createdAt: null
			}
		]);
		expect(listCatalogForCourse).toHaveBeenCalledWith('course-1');
	});

	it('matches catalog query as case-insensitive substring on code, title, or teacher', async () => {
		const store = createStudentStore(inner());
		await expect(store.listPublishedCatalog({ query: 'phy' })).resolves.toEqual([
			expect.objectContaining({ title: 'Modern Physics', courseCode: '203-SN3-RE' })
		]);
		await expect(store.listPublishedCatalog({ query: 'Phys' })).resolves.toHaveLength(1);
		await expect(store.listPublishedCatalog({ query: 'physics' })).resolves.toHaveLength(1);
		await expect(store.listPublishedCatalog({ query: 'fathola' })).resolves.toEqual([
			expect.objectContaining({ teacherName: 'Baharak Fatholahzadeh' })
		]);
		await expect(store.listPublishedCatalog({ query: 'zzz' })).resolves.toEqual([]);
		await expect(store.listPublishedCatalog({ query: '   ' })).resolves.toHaveLength(1);
	});

	it('returns a cached extraction or null', async () => {
		const store = createStudentStore(inner());
		await expect(store.getExtraction('ab'.repeat(32))).resolves.toBeNull();
		const hit = createStudentStore(
			inner({
				findExtraction: vi.fn(async () => ({ proposals: { assessments: [] }, inferenceCount: 2 }))
			})
		);
		await expect(hit.getExtraction('ab'.repeat(32))).resolves.toEqual({
			proposals: { assessments: [] },
			inferenceCount: 2
		});
	});

	it('returns account-owned outline reviews without private document text', async () => {
		const createdAt = new Date('2026-08-30T12:00:00.000Z');
		const store = createStudentStore(
			inner({
				listUserOutlines: vi.fn(async () => [
					{
						sha256: 'ab'.repeat(32),
						createdAt,
						proposals: { courseCode: '203-SN3-RE', title: 'Modern Physics' },
						inferenceCount: 2,
						extractedText: 'must never leave the repository'
					},
					{
						sha256: 'cd'.repeat(32),
						createdAt: new Date('2026-08-30T11:00:00.000Z'),
						proposals: null,
						inferenceCount: null
					}
				])
			})
		);

		const outlines = await store.listOutlines(USER);

		expect(outlines).toEqual([
			{
				sha256: 'ab'.repeat(32),
				createdAt,
				extraction: {
					proposals: { courseCode: '203-SN3-RE', title: 'Modern Physics' },
					inferenceCount: 2
				}
			},
			{
				sha256: 'cd'.repeat(32),
				createdAt: new Date('2026-08-30T11:00:00.000Z'),
				extraction: null
			}
		]);
		expect(JSON.stringify(outlines)).not.toContain('must never leave');
	});

	it('prefers the student private review and scopes save and delete to that account', async () => {
		const repo = inner({
			listUserOutlines: vi.fn(async () => [
				{
					sha256: 'ab'.repeat(32),
					createdAt: new Date('2026-08-30T12:00:00.000Z'),
					reviewProposals: { title: 'My corrected title' },
					proposals: { title: 'Shared extraction title' },
					inferenceCount: 1
				}
			])
		});
		const store = createStudentStore(repo);
		expect((await store.listOutlines(USER))[0].extraction.proposals).toEqual({
			title: 'My corrected title'
		});
		await store.saveOutlineReview({
			userId: USER,
			sha256: 'ab'.repeat(32),
			proposals: { title: 'Saved title' }
		});
		await store.deleteOutline({ userId: USER, sha256: 'ab'.repeat(32) });
		expect(repo.saveOutlineReview).toHaveBeenCalledWith(
			expect.objectContaining({ userId: USER, sha256: 'ab'.repeat(32) })
		);
		expect(repo.deleteOutlineDocument).toHaveBeenCalledWith({
			userId: USER,
			sha256: 'ab'.repeat(32)
		});
	});

	it('loads and saves the signed-in account schedule', async () => {
		const repo = inner({
			getSavedSchedule: vi.fn(async () => ({ paste: '1\tCalculus\n' }))
		});
		const store = createStudentStore(repo);

		await expect(store.getSchedule(USER)).resolves.toBe('1\tCalculus\n');
		await store.saveSchedule({ userId: USER, paste: '2\tPhysics\n' });

		expect(repo.saveSchedule).toHaveBeenCalledWith({ userId: USER, paste: '2\tPhysics\n' });
	});

	it('returns an empty schedule when none is saved', async () => {
		await expect(createStudentStore(inner()).getSchedule(USER)).resolves.toBe('');
	});

	it('contributes through offering identity', async () => {
		const repo = inner();
		const store = createStudentStore(repo);
		await expect(
			store.contribute({
				contributorUserId: USER,
				documentSha256: 'ab'.repeat(32),
				termId: 'fall-2026',
				courseCode: '203-SN3-RE',
				title: 'Modern Physics',
				section: '00021',
				teacherName: 'Baharak Fatholahzadeh',
				structured: { assessments: [], books: [] }
			})
		).resolves.toEqual({ offeringId: 'off-1', conflict: false });
		expect(repo.publishCatalogContribution).toHaveBeenCalled();
		const flatOffering = createStudentStore(
			inner({ findOrCreateOffering: vi.fn(async () => ({ offering: { id: 'off-2' } })) })
		);
		await expect(
			flatOffering.contribute({
				contributorUserId: USER,
				documentSha256: 'ab'.repeat(32),
				termId: 'fall-2026',
				courseCode: '203-SN3-RE',
				title: 'Modern Physics',
				section: '00021',
				teacherName: 'Baharak Fatholahzadeh',
				structured: {}
			})
		).resolves.toEqual({ offeringId: 'off-2', conflict: false });
	});

	it('rejects a contribute payload without identity fields', async () => {
		const store = createStudentStore(inner());
		await expect(
			store.contribute(/** @type {any} */ ({
				contributorUserId: USER,
				documentSha256: 'ab'.repeat(32),
				structured: {}
			}))
		).rejects.toBeInstanceOf(MaritoolsInputError);
	});

	it('maps repository domain errors', async () => {
		const store = createStudentStore(
			inner({
				getStudentProfile: vi.fn(async () => {
					throw new Error('connection');
				})
			})
		);
		await expect(store.getProfile(USER)).rejects.toBeInstanceOf(MaritoolsUnavailableError);

		const validation = createStudentStore(
			inner({
				getStudentProfile: vi.fn(async () => {
					throw new MariToolsValidationError();
				})
			})
		);
		await expect(validation.getProfile(USER)).rejects.toBeInstanceOf(MaritoolsInputError);

		const uncoded = createStudentStore(
			inner({
				getStudentProfile: vi.fn(async () => {
					const error = new MariToolsValidationError();
					/** @type {any} */ (error).code = undefined;
					throw error;
				})
			})
		);
		await expect(uncoded.getProfile(USER)).rejects.toMatchObject({
			name: 'MaritoolsInputError',
			code: 'invalid'
		});

		const conflict = createStudentStore(
			inner({
				getStudentProfile: vi.fn(async () => {
					throw new MariToolsConflictError();
				})
			})
		);
		await expect(conflict.getProfile(USER)).rejects.toBeInstanceOf(MaritoolsInputError);

		const missing = createStudentStore(
			inner({
				getStudentProfile: vi.fn(async () => {
					throw new MariToolsNotFoundError();
				})
			})
		);
		await expect(missing.getProfile(USER)).rejects.toBeInstanceOf(MaritoolsUnavailableError);

		const down = createStudentStore(
			inner({
				saveOutlineDocument: vi.fn(async () => {
					throw new MariToolsUnavailableError();
				})
			})
		);
		await expect(
			down.saveOutlineDocument({
				userId: USER,
				sha256: 'ab'.repeat(32),
				byteLength: 10,
				extractedText: 'text'
			})
		).rejects.toBeInstanceOf(MaritoolsUnavailableError);
	});

	it('saves documents and extractions', async () => {
		const repo = inner();
		const store = createStudentStore(repo);
		await store.saveExtraction({
			documentSha256: 'ab'.repeat(32),
			offeringId: null,
			proposals: {},
			model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
			inferenceCount: 1
		});
		expect(repo.saveExtraction).toHaveBeenCalled();
	});

	it('rethrows local domain errors', async () => {
		const store = createStudentStore(
			inner({
				getStudentProfile: vi.fn(async () => {
					throw new MaritoolsInputError('invalid-student-id');
				})
			})
		);
		await expect(store.getProfile(USER)).rejects.toBeInstanceOf(MaritoolsInputError);
		const down = createStudentStore(
			inner({
				getStudentProfile: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			})
		);
		await expect(down.getProfile(USER)).rejects.toBeInstanceOf(MaritoolsUnavailableError);
	});
});

describe('openStudentStore', () => {
	afterEach(() => vi.restoreAllMocks());

	it('builds a store from the runtime database url', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockReturnValue(/** @type {any} */ ({
			databaseUrl: 'postgresql://runtime:secret@db.example/club'
		}));
		const store = openStudentStore();
		expect(typeof store.getProfile).toBe('function');
	});

	it('treats missing runtime config as unavailable', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockImplementation(() => {
			throw new Error('Server configuration is unavailable');
		});
		expect(() => openStudentStore()).toThrow(MaritoolsUnavailableError);
		vi.mocked(environment.readRuntimeEnvironment).mockImplementation(() => {
			throw new MaritoolsUnavailableError();
		});
		expect(() => openStudentStore()).toThrow(MaritoolsUnavailableError);
	});
});
