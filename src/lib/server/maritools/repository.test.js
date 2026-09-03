// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
	MariToolsConflictError,
	MariToolsNotFoundError,
	MariToolsUnavailableError,
	MariToolsValidationError,
	createMariToolsRepository,
	committedTermSeeds,
	fall2026TermSeed,
	isUniqueViolation,
	publicOutlineView,
	publicProfileCard,
	publicStudentView,
	resolveCatalogContributionStatus,
	sha256Hex,
	structuredFactsConflict
} from './repository.js';

const SHA = sha256Hex('outline');
const OTHER_SHA = sha256Hex('other-outline');
const USER = 'user-1';
const OFFERING = '10000000-0000-4000-8000-000000000001';
const THREAD = '20000000-0000-4000-8000-000000000001';
const REPLY = '30000000-0000-4000-8000-000000000001';
const REPORT = '40000000-0000-4000-8000-000000000001';
const CLUB = '50000000-0000-4000-8000-000000000001';
const SUBMISSION = '60000000-0000-4000-8000-000000000001';

function uniqueError() {
	return Object.assign(new Error('duplicate'), { code: '23505' });
}

function queuedRepo(queue) {
	let index = 0;
	const runTransaction = vi.fn(async (operation) => {
		const take = () => {
			const item = queue[index++];
			if (item instanceof Error) throw item;
			return item;
		};
		const chain = {
			select: () => chain,
			from: () => chain,
			where: () => chain,
			orderBy: () => chain,
			limit: () => chain,
			innerJoin: () => chain,
			leftJoin: () => chain,
			insert: () => chain,
			values: () => chain,
			returning: () => chain,
			update: () => chain,
			set: () => chain,
			execute: async () => [],
			then(resolve, reject) {
				return Promise.resolve().then(take).then(resolve, reject);
			}
		};
		return operation(chain);
	});
	return createMariToolsRepository({
		databaseUrl: 'postgresql://maritools-test',
		runTransaction
	});
}

describe('maritools repository helpers', () => {
	it('hashes bytes to hex sha256', () => {
		expect(sha256Hex('outline')).toMatch(/^[a-f0-9]{64}$/u);
		expect(sha256Hex(new Uint8Array([1, 2, 3]))).toMatch(/^[a-f0-9]{64}$/u);
		expect(sha256Hex(Buffer.from('outline'))).toBe(sha256Hex('outline'));
	});

	it('detects unique violations on the error or its cause', () => {
		expect(isUniqueViolation(uniqueError())).toBe(true);
		expect(isUniqueViolation(new Error('nope'))).toBe(false);
		expect(isUniqueViolation('nope')).toBe(false);
		expect(isUniqueViolation({ cause: uniqueError() })).toBe(true);
	});

	it('detects conflicting structured facts after key sort', () => {
		expect(structuredFactsConflict({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false);
		expect(structuredFactsConflict({ a: 1 }, { a: 2 })).toBe(true);
		expect(structuredFactsConflict([{ a: 1 }], [{ a: 1 }])).toBe(false);
	});

	it('resolves catalog contribution status', () => {
		expect(resolveCatalogContributionStatus(null, { a: 1 }, [])).toBe('published');
		expect(resolveCatalogContributionStatus({ structured: { a: 1 } }, { a: 1 }, [])).toBe('reuse');
		expect(resolveCatalogContributionStatus({ structured: { a: 1 } }, { a: 2 }, [])).toBe(
			'conflict'
		);
		expect(resolveCatalogContributionStatus(null, { a: 1 }, [{ status: 'published' }])).toBe(
			'conflict'
		);
		expect(resolveCatalogContributionStatus(null, { a: 1 }, [{ status: 'conflict' }])).toBe(
			'conflict'
		);
		expect(resolveCatalogContributionStatus(null, { a: 1 }, [{ status: 'withdrawn' }])).toBe(
			'published'
		);
	});

	it('redacts student numbers and extracted text from public views', () => {
		const view = publicStudentView({
			userId: 'u1',
			displayName: 'Ada',
			role: 'student',
			studentId: '2530622',
			nimDisclosureAcceptedAt: null
		});
		expect(view).not.toHaveProperty('studentId');
		expect(JSON.stringify(view)).not.toContain('2530622');
		expect(publicStudentView({ userId: 'u1', role: 'staff' }).displayName).toBe(null);
		expect(() => publicStudentView(null)).toThrow(MariToolsValidationError);
		expect(
			publicProfileCard({
				userId: 'u1',
				displayName: 'Ada',
				role: 'student',
				studentId: '2530622',
				bannedAt: new Date()
			})
		).toMatchObject({
			userId: 'u1',
			displayName: 'Ada',
			role: 'student',
			isRestricted: true,
			isBanned: true,
			bannedPermanent: true
		});
		expect(
			publicProfileCard({
				userId: 'u1',
				displayName: 'Ada',
				role: 'student',
				bannedAt: new Date(),
				bannedUntil: new Date(Date.now() + 86400000)
			})
		).toMatchObject({
			isBanned: true,
			bannedPermanent: false
		});
		expect(
			JSON.stringify(
				publicProfileCard({
					userId: 'u1',
					displayName: 'Ada',
					role: 'student',
					studentId: '2530622'
				})
			)
		).not.toContain('2530622');
		const outline = publicOutlineView({
			id: 'd1',
			userId: 'u1',
			sha256: SHA,
			byteLength: 12,
			extractedText: 'secret outline'
		});
		expect(outline.extractedText).toBeUndefined();
		expect(JSON.stringify(outline)).not.toContain('secret outline');
		expect(() => publicOutlineView(null)).toThrow(MariToolsValidationError);
	});

	it('returns the Fall 2026 seed pair', () => {
		const seed = fall2026TermSeed();
		expect(seed.term.id).toBe('fall-2026');
		expect(seed.rules.termId).toBe('fall-2026');
		expect(() => fall2026TermSeed([], {})).toThrow(MariToolsUnavailableError);
		expect(() => fall2026TermSeed([{ id: 'fall-2026' }], {})).toThrow(MariToolsUnavailableError);
		const all = committedTermSeeds();
		expect(all.map((entry) => entry.term.id)).toEqual(['fall-2026', 'winter-2027']);
		expect(() => committedTermSeeds([{ id: 'fall-2026' }], {})).toThrow(MariToolsUnavailableError);
	});

	it('updates member identity, enforces username ownership, and preserves an omitted avatar', async () => {
		const existing = {
			userId: USER,
			studentId: '2530622',
			username: 'old_name',
			profileImageDataUrl: 'data:image/png;base64,b2xk'
		};
		const updated = {
			...existing,
			username: 'ada_codes',
			displayName: 'ada_codes',
			firstName: 'Ada',
			lastName: 'Lovelace'
		};

		await expect(
			queuedRepo([[existing], [], [updated]]).updateMemberProfile({
				userId: USER,
				username: 'ada_codes',
				firstName: 'Ada',
				lastName: 'Lovelace'
			})
		).resolves.toEqual(updated);
		await expect(
			queuedRepo([[existing], [{ userId: 'someone-else' }]]).updateMemberProfile({
				userId: USER,
				username: 'taken_name',
				firstName: 'Ada',
				lastName: 'Lovelace'
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([[existing], [{ userId: USER }], [{ ...updated, profileImageDataUrl: 'new' }]])
				.updateMemberProfile({
					userId: USER,
					username: 'ada_codes',
					firstName: 'Ada',
					lastName: 'Lovelace',
					profileImageDataUrl: 'new'
				})
		).resolves.toMatchObject({ profileImageDataUrl: 'new' });
		await expect(
			queuedRepo([[]]).updateMemberProfile({
				userId: USER,
				username: 'ada_codes',
				firstName: 'Ada',
				lastName: 'Lovelace'
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([[existing], [], []]).updateMemberProfile({
				userId: USER,
				username: 'ada_codes',
				firstName: 'Ada',
				lastName: 'Lovelace'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([]).updateMemberProfile({
				userId: USER,
				username: 'bad name',
				firstName: 'Ada',
				lastName: 'Lovelace'
			})
		).rejects.toBeInstanceOf(MariToolsValidationError);
	});

	it('rejects invalid repository configuration', () => {
		expect(() => createMariToolsRepository({ databaseUrl: '' })).toThrow(MariToolsUnavailableError);
		expect(() => createMariToolsRepository({ databaseUrl: ' postgresql://x' })).toThrow(
			MariToolsUnavailableError
		);
		expect(() =>
			createMariToolsRepository({ databaseUrl: 'postgresql://x', runTransaction: null })
		).toThrow(MariToolsUnavailableError);
	});
});

describe('createMariToolsRepository', () => {
	it('defaults to withDatabaseTransaction and validates before transacting', async () => {
		const source = await readFile(resolve('src/lib/server/maritools/repository.js'), 'utf8');
		expect(source).toMatch(/withDatabaseTransaction/u);
		expect(source).toMatch(/pg_advisory_xact_lock/u);
		const runTransaction = vi.fn();
		const repository = createMariToolsRepository({
			databaseUrl: 'postgresql://x',
			runTransaction
		});
		await expect(repository.getTerm('')).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(repository.getTerm(' fall-2026')).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(repository.findOrCreateOffering({ termId: 'fall-2026' })).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(
			repository.upsertStudentProfile({ userId: USER, studentId: 'abc' })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.saveOutlineDocument({ userId: USER, sha256: 'x', byteLength: 1 })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.saveOutlineDocument({ userId: USER, sha256: SHA, byteLength: 0 })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.saveOutlineReview({ userId: USER, sha256: SHA, proposals: [] })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.deleteOutlineDocument({ userId: USER, sha256: 'bad' })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(repository.findExtraction({})).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.saveExtraction({ documentSha256: SHA, proposals: [] })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.publishCatalogContribution({
				offeringId: 'bad',
				documentSha256: SHA,
				structured: {}
			})
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.listCatalogContributions({ offeringId: OFFERING, status: 'nope' })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(repository.listPublishedCatalog({ termId: ' term' })).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(
			repository.createClub({ name: 'Chess', slug: 'Chess Club' })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.createClub({ name: 'Chess', slug: 'chess', links: {} })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.createClub({
				name: 'Chess',
				slug: 'chess',
				links: [{ url: 'javascript:alert(1)' }]
			})
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.createClub({ name: 'Chess', slug: 'chess', links: [{ url: 'not a url' }] })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.createClub({ name: 'Chess', slug: 'chess', links: [null] })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.createClub({ name: 'Chess', slug: 'chess', links: [{ url: '' }] })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.createClub({
				name: 'Chess',
				slug: 'chess',
				links: [{ url: `https://example.com/${'a'.repeat(500)}` }]
			})
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.createClub({ name: 'Chess', slug: 'chess', links: ['https://example.com'] })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			repository.createClub({
				name: 'Chess',
				slug: 'chess',
				links: [{ url: 'ftp://files.example.com/club' }]
			})
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(repository.submitClub({ payload: [] })).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(repository.getClubSubmission('bad')).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(repository.updateClubSubmissionPayload('bad', { name: 'Chess' })).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(repository.updateClubSubmissionPayload(SUBMISSION, [])).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(repository.listClubSubmissions({ status: 'nope' })).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(repository.setClubSubmissionStatus('bad', 'pending')).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(repository.setClubSubmissionStatus(SUBMISSION, 'nope')).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		expect(await repository.getPublishedClubBySlug(null)).toBeNull();
		expect(await repository.getPublishedClubBySlug('Bad Slug')).toBeNull();
		await expect(
			repository.createThread({ authorUserId: USER, title: 'Hi', body: 'Hello', category: 'memes' })
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(repository.listThreads({ category: 'memes' })).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(
			repository.createReport({
				targetKind: 'post',
				targetId: THREAD,
				reporterUserId: USER,
				reason: 'spam'
			})
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(repository.listReports({ status: 'nope' })).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(repository.setReportStatus(REPORT, 'open')).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		await expect(repository.findExtraction({ offeringId: 'bad' })).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
		expect(runTransaction).not.toHaveBeenCalled();
	});

	it('redacts unexpected failures and preserves domain errors', async () => {
		const failed = createMariToolsRepository({
			databaseUrl: 'postgresql://secret-host',
			runTransaction: vi.fn().mockRejectedValue(new Error('postgresql://secret-host'))
		});
		await expect(failed.listTerms()).rejects.toBeInstanceOf(MariToolsUnavailableError);
		const domain = createMariToolsRepository({
			databaseUrl: 'postgresql://x',
			runTransaction: vi.fn().mockRejectedValue(new MariToolsConflictError())
		});
		await expect(domain.listPublishedClubs()).rejects.toBeInstanceOf(MariToolsConflictError);
		const validation = createMariToolsRepository({
			databaseUrl: 'postgresql://x',
			runTransaction: vi.fn().mockRejectedValue(new MariToolsValidationError())
		});
		await expect(validation.listPublishedClubs()).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(domain.getPublishedClubBySlug('robotics')).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(validation.getPublishedClubBySlug('robotics')).rejects.toBeInstanceOf(
			MariToolsValidationError
		);
	});

	it('covers seed races, malformed rows, and offering recovery', async () => {
		const seed = fall2026TermSeed();
		await expect(
			queuedRepo([[], [seed.term], [], [seed.rules]]).seedFall2026()
		).resolves.toMatchObject({ term: { id: 'fall-2026' } });
		await expect(
			queuedRepo([[], uniqueError(), [seed.term], [], [seed.rules]]).seedFall2026()
		).resolves.toMatchObject({ term: { id: 'fall-2026' } });
		await expect(queuedRepo([[], uniqueError(), []]).seedFall2026()).rejects.toBeInstanceOf(
			MariToolsConflictError
		);
		await expect(
			queuedRepo([[seed.term], [], uniqueError(), [seed.rules]]).seedFall2026()
		).resolves.toMatchObject({ rules: { termId: 'fall-2026' } });
		await expect(
			queuedRepo([[seed.term], [], uniqueError(), []]).seedFall2026()
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([
				[seed.term],
				[],
				uniqueError(),
				[{ termId: 'fall-2026', noClassDates: ['2099-01-01'], scheduleOverrides: [] }]
			]).seedFall2026()
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([
				[
					{
						id: 'fall-2026',
						name: 'Wrong',
						startDate: '2026-08-18',
						endDate: '2026-12-22',
						classStartDate: '2026-08-18',
						classEndDate: '2026-12-04',
						status: 'active'
					}
				]
			]).seedFall2026()
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([
				[seed.term],
				[{ termId: 'fall-2026', noClassDates: ['2099-01-01'], scheduleOverrides: [] }]
			]).seedFall2026()
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(queuedRepo(['bad']).listTerms()).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[{ id: 'x' }, { id: 'y' }]]).getTerm('fall-2026')
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[{ id: 'fall-2026', name: 'Fall' }]]).getTerm('fall-2026')
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[{ termId: 'x' }]]).getCalendarRules('fall-2026')
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(queuedRepo([[]]).getTerm('fall-2026')).resolves.toBeNull();
		await expect(queuedRepo([[]]).getCalendarRules('fall-2026')).resolves.toBeNull();
		await expect(
			queuedRepo([
				[
					{
						id: 'old',
						name: 'Old',
						startDate: '2020-01-01',
						endDate: '2020-05-01',
						classStartDate: '2020-01-01',
						classEndDate: '2020-04-01',
						status: 'historical'
					}
				]
			]).listTerms()
		).resolves.toMatchObject([{ status: 'historical' }]);

		const course = { id: THREAD, code: 'CSC 205', canonicalTitle: 'Data' };
		const offering = {
			id: OFFERING,
			courseId: THREAD,
			termId: 'fall-2026',
			section: '00001',
			teacherName: 'Ada'
		};
		await expect(
			queuedRepo([
				[{ id: 'fall-2026' }],
				[],
				uniqueError(),
				[course],
				[],
				uniqueError(),
				[offering]
			]).findOrCreateOffering({
				termId: 'fall-2026',
				code: 'CSC 205',
				section: '00001',
				teacherName: 'Ada',
				canonicalTitle: 'Data'
			})
		).resolves.toEqual({ course, offering });
		await expect(
			queuedRepo([[]]).findOrCreateOffering({
				termId: 'fall-2026',
				code: 'CSC 205',
				section: '00001',
				teacherName: 'Ada',
				canonicalTitle: 'Data'
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([[{ id: 'fall-2026' }], [], []]).findOrCreateOffering({
				termId: 'fall-2026',
				code: 'CSC 205',
				section: '00001',
				teacherName: 'Ada',
				canonicalTitle: 'Data'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
	});

	it('covers student, outline, catalog, club, and forum branches', async () => {
		await expect(
			queuedRepo([[{ userId: USER, studentId: '11111' }]]).upsertStudentProfile({
				userId: USER,
				studentId: '22222'
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([
				[{ userId: USER, studentId: '2530622', displayName: 'Ada' }]
			]).upsertStudentProfile({
				userId: USER,
				studentId: '2530622',
				displayName: 'Ada'
			})
		).resolves.toMatchObject({ displayName: 'Ada' });
		await expect(
			queuedRepo([
				[{ userId: USER, studentId: '2530622', displayName: 'Ada' }],
				[]
			]).upsertStudentProfile({
				userId: USER,
				studentId: '2530622',
				displayName: 'Ada King'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[], [], [{ userId: USER, role: 'staff' }]]).upsertStudentProfile({
				userId: USER,
				studentId: '2530622',
				role: 'staff'
			})
		).resolves.toMatchObject({ role: 'staff' });
		await expect(
			queuedRepo([[], [], [{ userId: USER, role: 'moderator' }]]).upsertStudentProfile({
				userId: USER,
				studentId: '111111',
				role: 'moderator'
			})
		).resolves.toMatchObject({ role: 'moderator' });
		await expect(
			queuedRepo([[], [], [{ userId: USER, role: 'student' }]]).upsertStudentProfile({
				userId: USER,
				studentId: '222222',
				role: 'nope'
			})
		).resolves.toMatchObject({ role: 'student' });
		await expect(
			queuedRepo([[], [{ userId: 'other', studentId: '2530622' }]]).upsertStudentProfile({
				userId: USER,
				studentId: '2530622'
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([
				[],
				[],
				uniqueError(),
				[{ userId: USER, studentId: '2530622' }]
			]).upsertStudentProfile({
				userId: USER,
				studentId: '2530622'
			})
		).resolves.toMatchObject({ userId: USER });
		await expect(
			queuedRepo([
				[],
				[],
				uniqueError(),
				[{ userId: USER, studentId: '11111' }]
			]).upsertStudentProfile({
				userId: USER,
				studentId: '2530622'
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([[], [], new Error('disk')]).upsertStudentProfile({
				userId: USER,
				studentId: '2530622'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(queuedRepo([[]]).acceptNimDisclosure(USER)).rejects.toBeInstanceOf(
			MariToolsNotFoundError
		);
		await expect(
			queuedRepo([[{ userId: USER, nimDisclosureAcceptedAt: new Date() }]]).acceptNimDisclosure(
				USER
			)
		).resolves.toMatchObject({ userId: USER });
		await expect(
			queuedRepo([[{ userId: USER, nimDisclosureAcceptedAt: null }], []]).acceptNimDisclosure(USER)
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(queuedRepo([[]]).getStudentRole(USER)).resolves.toBeNull();
		await expect(
			queuedRepo([[{ userId: USER, role: 'staff' }]]).getStudentRole(USER)
		).resolves.toBe('staff');

		const existingDoc = {
			id: THREAD,
			userId: USER,
			sha256: SHA,
			byteLength: 12,
			extractedText: 'hello'
		};
		await expect(
			queuedRepo([[{ ...existingDoc, byteLength: 9 }]]).saveOutlineDocument({
				userId: USER,
				sha256: SHA,
				byteLength: 12,
				extractedText: 'hello'
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([[existingDoc]]).saveOutlineDocument({
				userId: USER,
				sha256: SHA,
				byteLength: 12,
				extractedText: 'other'
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([[existingDoc]]).saveOutlineDocument({
				userId: USER,
				sha256: SHA,
				byteLength: 12
			})
		).resolves.toEqual(existingDoc);
		await expect(
			queuedRepo([[{ ...existingDoc, extractedText: null }], []]).saveOutlineDocument({
				userId: USER,
				sha256: SHA,
				byteLength: 12,
				extractedText: 'hello'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[{ ...existingDoc, extractedText: null }], [existingDoc]]).saveOutlineDocument({
				userId: USER,
				sha256: SHA,
				byteLength: 12,
				extractedText: 'hello'
			})
		).resolves.toEqual(existingDoc);
		await expect(
			queuedRepo([[], uniqueError(), [existingDoc]]).saveOutlineDocument({
				userId: USER,
				sha256: SHA,
				byteLength: 12,
				extractedText: 'hello'
			})
		).resolves.toEqual(existingDoc);
		await expect(
			queuedRepo([[], [existingDoc]]).saveOutlineDocument({
				userId: USER,
				sha256: SHA,
				byteLength: 12,
				extractedText: '  hello from a real course outline PDF  '
			})
		).resolves.toEqual(existingDoc);
		await expect(
			createMariToolsRepository({
				databaseUrl: 'postgresql://x',
				runTransaction: vi.fn()
			}).saveOutlineDocument({
				userId: USER,
				sha256: SHA,
				byteLength: 12,
				extractedText: '   '
			})
		).rejects.toBeInstanceOf(MariToolsValidationError);

		const savedOutline = {
			sha256: SHA,
			createdAt: new Date('2026-08-30T12:00:00.000Z'),
			proposals: { courseCode: '203-SN3-RE', title: 'Modern Physics' },
			inferenceCount: 1
		};
		await expect(queuedRepo([[savedOutline]]).listUserOutlines(USER)).resolves.toEqual([
			savedOutline
		]);

		await expect(queuedRepo([[{ paste: '1\tCalculus\n' }]]).getSavedSchedule(USER)).resolves.toEqual({
			paste: '1\tCalculus\n'
		});
		await expect(
			queuedRepo([[], [{ paste: '1\tCalculus\n' }]]).saveSchedule({
				userId: USER,
				paste: '1\tCalculus\n'
			})
		).resolves.toEqual({ paste: '1\tCalculus\n' });

		const extraction = { id: THREAD, documentSha256: SHA, offeringId: OFFERING };
		await expect(
			queuedRepo([[extraction]]).findExtraction({ documentSha256: SHA, offeringId: OFFERING })
		).resolves.toEqual(extraction);
		await expect(
			queuedRepo([[], [extraction]]).findExtraction({ documentSha256: SHA, offeringId: OFFERING })
		).resolves.toEqual(extraction);
		await expect(queuedRepo([[]]).findExtraction({ documentSha256: SHA })).resolves.toBeNull();
		await expect(queuedRepo([[]]).findExtraction({ offeringId: OFFERING })).resolves.toBeNull();
		await expect(
			queuedRepo([[extraction]]).saveExtraction({
				documentSha256: SHA,
				offeringId: OFFERING,
				proposals: { books: [] }
			})
		).resolves.toEqual({ extraction, cacheHit: true });
		await expect(
			queuedRepo([[], [extraction]]).saveExtraction({
				documentSha256: SHA,
				proposals: { books: [] }
			})
		).resolves.toMatchObject({ cacheHit: false });
		await expect(
			queuedRepo([[], []]).saveExtraction({ documentSha256: SHA, proposals: { books: [] } })
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[], uniqueError(), [extraction]]).saveExtraction({
				documentSha256: SHA,
				proposals: { books: [] }
			})
		).resolves.toEqual({ extraction, cacheHit: true });
		await expect(
			queuedRepo([[], uniqueError(), []]).saveExtraction({
				documentSha256: SHA,
				proposals: { books: [] }
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([[], new Error('network')]).saveExtraction({
				documentSha256: SHA,
				proposals: { books: [] }
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);

		await expect(
			queuedRepo([[]]).publishCatalogContribution({
				offeringId: OFFERING,
				documentSha256: SHA,
				structured: { title: 'A' }
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		const published = {
			id: CLUB,
			offeringId: OFFERING,
			documentSha256: SHA,
			structured: { title: 'A' },
			status: 'published'
		};
		await expect(
			queuedRepo([[{ id: OFFERING }], [published], []]).publishCatalogContribution({
				offeringId: OFFERING,
				documentSha256: SHA,
				structured: { title: 'A' }
			})
		).resolves.toEqual({ contribution: published, conflict: false });
		const conflicted = { ...published, status: 'conflict' };
		await expect(
			queuedRepo([[{ id: OFFERING }], [conflicted], []]).publishCatalogContribution({
				offeringId: OFFERING,
				documentSha256: SHA,
				structured: { title: 'B' }
			})
		).resolves.toEqual({ contribution: conflicted, conflict: true });
		await expect(
			queuedRepo([[{ id: OFFERING }], [published], [], []]).publishCatalogContribution({
				offeringId: OFFERING,
				documentSha256: SHA,
				structured: { title: 'B' }
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([
				[{ id: OFFERING }],
				[],
				[{ ...published, documentSha256: OTHER_SHA, status: 'published' }],
				[{ id: REPORT, status: 'conflict' }]
			]).publishCatalogContribution({
				offeringId: OFFERING,
				documentSha256: SHA,
				structured: { title: 'B' }
			})
		).resolves.toMatchObject({ conflict: true });
		await expect(
			queuedRepo([[{ id: OFFERING }], [], [], uniqueError(), [published]]).publishCatalogContribution({
				offeringId: OFFERING,
				documentSha256: SHA,
				structured: { title: 'A' }
			})
		).resolves.toEqual({ contribution: published, conflict: false });
		await expect(
			queuedRepo([[{ id: OFFERING }], [], [], uniqueError(), []]).publishCatalogContribution({
				offeringId: OFFERING,
				documentSha256: SHA,
				structured: { title: 'A' }
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);

		await expect(queuedRepo([[{ slug: 'chess' }]]).listPublishedCatalog()).resolves.toEqual([
			{ slug: 'chess' }
		]);
		await expect(
			queuedRepo([
				[
					{ termId: 'fall-2026', slug: 'a' },
					{ termId: 'winter-2027', slug: 'b' }
				]
			]).listPublishedCatalog({ termId: 'fall-2026' })
		).resolves.toEqual([{ termId: 'fall-2026', slug: 'a' }]);
		await expect(
			queuedRepo([[{ status: 'conflict', courseCode: '420-NYA-05' }]]).listConflictCatalog()
		).resolves.toEqual([{ status: 'conflict', courseCode: '420-NYA-05' }]);
		const CONTRIB = '70000000-0000-4000-8000-000000000001';
		await expect(queuedRepo([[]]).resolveCatalogConflict(CONTRIB)).rejects.toBeInstanceOf(
			MariToolsNotFoundError
		);
		await expect(
			queuedRepo([
				[{ id: CONTRIB, offeringId: OFFERING, status: 'published' }],
				[]
			]).resolveCatalogConflict(CONTRIB)
		).resolves.toMatchObject({ id: CONTRIB, status: 'published' });
		await expect(
			queuedRepo([[{ id: CONTRIB, offeringId: OFFERING, status: 'withdrawn' }]]).resolveCatalogConflict(
				CONTRIB
			)
		).rejects.toBeInstanceOf(MariToolsValidationError);
		await expect(
			queuedRepo([
				[{ id: CONTRIB, offeringId: OFFERING, status: 'conflict' }],
				[{ id: CONTRIB, offeringId: OFFERING, status: 'published' }],
				[]
			]).resolveCatalogConflict(CONTRIB)
		).resolves.toMatchObject({ id: CONTRIB, status: 'published' });
		await expect(
			queuedRepo([uniqueError()]).createClub({ name: 'Chess', slug: 'chess' })
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([[]]).submitClub({ payload: { name: 'Chess' } })
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(queuedRepo([[]]).getClubSubmission(SUBMISSION)).resolves.toBeNull();
		await expect(
			queuedRepo([[]]).updateClubSubmissionPayload(SUBMISSION, { name: 'Chess' })
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([[{ id: SUBMISSION }], []]).updateClubSubmissionPayload(SUBMISSION, { name: 'Chess' })
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[{ id: SUBMISSION, payload: { name: 'Chess' } }]]).getClubSubmission(SUBMISSION)
		).resolves.toMatchObject({ id: SUBMISSION });
		await expect(
			queuedRepo([
				[{ id: SUBMISSION, payload: { name: 'Old' } }],
				[{ id: SUBMISSION, payload: { name: 'Chess' } }]
			]).updateClubSubmissionPayload(SUBMISSION, { name: 'Chess' })
		).resolves.toMatchObject({ payload: { name: 'Chess' } });
		await expect(
			queuedRepo([[]]).setClubSubmissionStatus(SUBMISSION, 'published')
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([[{ id: SUBMISSION }], []]).setClubSubmissionStatus(SUBMISSION, 'rejected')
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[]]).createThread({
				authorUserId: USER,
				title: 'Hi',
				body: 'Hello',
				category: 'courses'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[], []]).createReply({ threadId: THREAD, authorUserId: USER, body: 'hi' })
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([[], [{ id: THREAD, removedAt: new Date() }]]).createReply({
				threadId: THREAD,
				authorUserId: USER,
				body: 'hi'
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([[], [{ id: THREAD, lockedAt: new Date(), removedAt: null }]]).createReply({
				threadId: THREAD,
				authorUserId: USER,
				body: 'hi'
			})
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			queuedRepo([[], [{ id: THREAD, lockedAt: null, removedAt: null }], []]).createReply({
				threadId: THREAD,
				authorUserId: USER,
				body: 'hi'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(queuedRepo([[]]).lockThread(THREAD)).rejects.toBeInstanceOf(
			MariToolsNotFoundError
		);
		await expect(
			queuedRepo([[{ id: THREAD, lockedAt: new Date() }]]).lockThread(THREAD)
		).resolves.toMatchObject({ id: THREAD });
		await expect(
			queuedRepo([[{ id: THREAD, lockedAt: null }], []]).lockThread(THREAD)
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		const until = new Date(Date.now() + 86400000);
		await expect(queuedRepo([[]]).muteUser(USER, until)).rejects.toBeInstanceOf(
			MariToolsNotFoundError
		);
		await expect(
			queuedRepo([
				[{ userId: USER, role: 'student', studentId: '2530622' }],
				[{ userId: USER, role: 'student', mutedUntil: until }]
			]).muteUser(USER, until)
		).resolves.toMatchObject({ userId: USER, mutedUntil: until });
		await expect(queuedRepo([[]]).banUser(USER)).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([
				[{ userId: USER, role: 'student', studentId: '2530622' }],
				[{ userId: USER, role: 'student', bannedAt: new Date(), bannedUntil: null }]
			]).banUser(USER)
		).resolves.toMatchObject({ userId: USER, bannedUntil: null });
		const banUntil = new Date(Date.now() + 86400000);
		await expect(
			queuedRepo([
				[{ userId: USER, role: 'student', studentId: '2530622' }],
				[{ userId: USER, role: 'student', bannedAt: new Date(), bannedUntil: banUntil }]
			]).banUser(USER, { until: banUntil })
		).resolves.toMatchObject({ userId: USER, bannedUntil: banUntil });
		await expect(queuedRepo([[]]).unmuteUser(USER)).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([
				[{ userId: USER, role: 'student', mutedUntil: until }],
				[{ userId: USER, role: 'student', mutedUntil: null }]
			]).unmuteUser(USER)
		).resolves.toMatchObject({ userId: USER, mutedUntil: null });
		await expect(
			queuedRepo([
				[{ userId: USER, role: 'student', bannedAt: new Date() }],
				[{ userId: USER, role: 'student', bannedAt: null, bannedUntil: null }]
			]).unbanUser(USER)
		).resolves.toMatchObject({ userId: USER, bannedAt: null });
		await expect(queuedRepo([[]]).listThreadsByAuthor(USER)).resolves.toEqual([]);
		await expect(queuedRepo([[]]).removeThread(THREAD)).rejects.toBeInstanceOf(
			MariToolsNotFoundError
		);
		await expect(
			queuedRepo([[{ id: THREAD, removedAt: new Date() }]]).removeThread(THREAD)
		).resolves.toMatchObject({ id: THREAD });
		await expect(
			queuedRepo([[{ id: THREAD, removedAt: null }], []]).removeThread(THREAD)
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(queuedRepo([[]]).removeReply(REPLY)).rejects.toBeInstanceOf(
			MariToolsNotFoundError
		);
		await expect(
			queuedRepo([[{ id: REPLY, removedAt: new Date() }]]).removeReply(REPLY)
		).resolves.toMatchObject({ id: REPLY });
		await expect(
			queuedRepo([[{ id: REPLY, removedAt: null }], []]).removeReply(REPLY)
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([
				[{ id: THREAD, removedAt: null, body: 'old' }],
				[{ id: THREAD, removedAt: null, body: 'Edited' }]
			]).updateThread({ id: THREAD, body: 'Edited' })
		).resolves.toMatchObject({ id: THREAD, body: 'Edited' });
		await expect(
			queuedRepo([
				[{ id: REPLY, removedAt: null, body: 'old' }],
				[{ id: REPLY, removedAt: null, body: 'Edited' }]
			]).updateReply({ id: REPLY, body: 'Edited' })
		).resolves.toMatchObject({ id: REPLY, body: 'Edited' });
		await expect(queuedRepo([[{ id: REPLY }]]).getReply(REPLY)).resolves.toMatchObject({
			id: REPLY
		});
		await expect(queuedRepo([[]]).updateThread({ id: THREAD, body: 'Edited' })).rejects.toBeInstanceOf(
			MariToolsNotFoundError
		);
		await expect(
			queuedRepo([[{ id: THREAD, removedAt: new Date() }]]).updateThread({
				id: THREAD,
				body: 'Edited'
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([[{ id: THREAD, removedAt: null }], []]).updateThread({
				id: THREAD,
				body: 'Edited'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(queuedRepo([[]]).updateReply({ id: REPLY, body: 'Edited' })).rejects.toBeInstanceOf(
			MariToolsNotFoundError
		);
		await expect(
			queuedRepo([[{ id: REPLY, removedAt: new Date() }]]).updateReply({
				id: REPLY,
				body: 'Edited'
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([[{ id: REPLY, removedAt: null }], []]).updateReply({
				id: REPLY,
				body: 'Edited'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[]]).createReport({
				targetKind: 'thread',
				targetId: THREAD,
				reporterUserId: USER,
				reason: 'spam'
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(
			queuedRepo([[{ id: THREAD }], []]).createReport({
				targetKind: 'thread',
				targetId: THREAD,
				reporterUserId: USER,
				reason: 'spam'
			})
		).rejects.toBeInstanceOf(MariToolsUnavailableError);
		await expect(
			queuedRepo([[]]).createReport({
				targetKind: 'reply',
				targetId: REPLY,
				reporterUserId: USER,
				reason: 'spam'
			})
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
		await expect(queuedRepo([[]]).setReportStatus(REPORT, 'resolved')).rejects.toBeInstanceOf(
			MariToolsNotFoundError
		);
		await expect(
			queuedRepo([[{ id: REPORT }], []]).setReportStatus(REPORT, 'dismissed')
		).rejects.toBeInstanceOf(MariToolsUnavailableError);

		await expect(
			queuedRepo([
				[
					{ category: 'courses', courseId: THREAD },
					{ category: 'student-life', courseId: OFFERING }
				]
			]).listThreads({ category: 'courses', courseId: THREAD })
		).resolves.toEqual([{ category: 'courses', courseId: THREAD }]);
		await expect(queuedRepo([[{ status: 'pending' }]]).listClubSubmissions()).resolves.toEqual([
			{ status: 'pending' }
		]);
		await expect(
			queuedRepo([[{ status: 'pending' }, { status: 'published' }]]).listClubSubmissions({
				status: 'pending'
			})
		).resolves.toEqual([{ status: 'pending' }]);
		await expect(
			queuedRepo([[{ status: 'pending' }]]).listClubSubmissions({ status: null })
		).resolves.toEqual([{ status: 'pending' }]);
		await expect(queuedRepo([[{ status: 'open' }]]).listReports()).resolves.toEqual([
			{ status: 'open' }
		]);
		await expect(queuedRepo([[{ status: 'open' }]]).listReports({ status: null })).resolves.toEqual(
			[{ status: 'open' }]
		);
		await expect(
			queuedRepo([
				[
					{ category: 'courses', courseId: THREAD },
					{ category: 'courses', courseId: OFFERING }
				]
			]).listThreads({ courseId: THREAD })
		).resolves.toEqual([{ category: 'courses', courseId: THREAD }]);
		await expect(
			queuedRepo([[{ status: 'published' }, { status: 'conflict' }]]).listCatalogContributions({
				offeringId: OFFERING,
				status: 'conflict'
			})
		).resolves.toEqual([{ status: 'conflict' }]);
		await expect(
			queuedRepo([[{ status: 'open' }, { status: 'resolved' }]]).listReports({ status: 'open' })
		).resolves.toEqual([{ status: 'open' }]);
	});
});
