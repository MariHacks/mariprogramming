// @ts-nocheck
// @vitest-environment node

import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import {
	MariToolsConflictError,
	MariToolsNotFoundError,
	createMariToolsRepository,
	publicOutlineView,
	publicStudentView,
	sha256Hex
} from './repository.js';

const POSTGRES_BIN = '/Applications/Postgres.app/Contents/Versions/latest/bin';
const MIGRATIONS_DIRECTORY = resolve('drizzle');
const USER_A = 'mt-user-a';
const USER_B = 'mt-user-b';
const USER_C = 'mt-user-c';
const USER_D = 'mt-user-d';
const SHA_A = sha256Hex('outline-a');
const SHA_B = sha256Hex('outline-b');

let clusterRoot;
let dataDirectory;
let socketDirectory;
let port;
let databaseUrl;

/** @param {string} name */
function binary(name) {
	return join(POSTGRES_BIN, name);
}

/** @param {string} command @param {string[]} args */
function run(command, args) {
	return spawnSync(command, args, {
		env: {
			...process.env,
			PGHOST: socketDirectory,
			PGPORT: String(port),
			PGDATABASE: 'postgres',
			PGUSER: process.env.USER
		},
		encoding: 'utf8'
	});
}

function freePort() {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close();
				reject(new Error('Could not reserve a PostgreSQL test port'));
				return;
			}
			server.close((error) => (error ? reject(error) : resolvePort(address.port)));
		});
	});
}

async function runTransaction(operation) {
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		return await drizzle(client, { schema }).transaction(operation);
	} finally {
		await client.end();
	}
}

function repository() {
	return createMariToolsRepository({ databaseUrl, runTransaction });
}

describe.sequential('MariTools repository against disposable PostgreSQL', () => {
	beforeAll(async () => {
		clusterRoot = await mkdtemp(join(tmpdir(), 'mpc-maritools-repo-'));
		dataDirectory = join(clusterRoot, 'data');
		socketDirectory = join(clusterRoot, 'socket');
		await mkdir(socketDirectory);
		port = await freePort();
		const initialized = run(binary('initdb'), [
			'--pgdata',
			dataDirectory,
			'--auth=trust',
			'--no-locale',
			'--encoding=UTF8'
		]);
		if (initialized.status !== 0) throw new Error(initialized.stderr);
		const started = run(binary('pg_ctl'), [
			'--pgdata',
			dataDirectory,
			'--log',
			join(clusterRoot, 'postgres.log'),
			'--options',
			`-F -k ${socketDirectory} -h 127.0.0.1 -p ${port}`,
			'--wait',
			'start'
		]);
		if (started.status !== 0) throw new Error(started.stderr);
		for (const migrationName of (await readdir(MIGRATIONS_DIRECTORY))
			.filter((name) => name.endsWith('.sql'))
			.sort()) {
			const applied = run(binary('psql'), [
				'--no-psqlrc',
				'--set',
				'ON_ERROR_STOP=1',
				'--file',
				join(MIGRATIONS_DIRECTORY, migrationName)
			]);
			if (applied.status !== 0) throw new Error(applied.stderr);
		}
		databaseUrl = `postgresql://${encodeURIComponent(process.env.USER)}@127.0.0.1:${port}/postgres`;
		run(binary('psql'), [
			'--no-psqlrc',
			'--set',
			'ON_ERROR_STOP=1',
			'--command',
			`
			INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
			VALUES
				('${USER_A}', 'Student A', 'a@gmail.com', true, now(), now()),
				('${USER_B}', 'Student B', 'b@gmail.com', true, now(), now()),
				('${USER_C}', 'Student C', 'c@gmail.com', true, now(), now()),
				('${USER_D}', 'Student D', 'd@gmail.com', true, now(), now())
			`
		]);
	}, 30000);

	afterAll(async () => {
		if (dataDirectory) {
			run(binary('pg_ctl'), ['--pgdata', dataDirectory, '--mode', 'immediate', '--wait', 'stop']);
		}
		if (clusterRoot) await rm(clusterRoot, { recursive: true, force: true });
	});

	it('seeds fall 2026 once and finds or creates offerings', async () => {
		const repo = repository();
		const first = await repo.seedCommittedTerms();
		const second = await repo.seedCommittedTerms();
		expect(first.map((row) => row.term.id).sort()).toEqual(['fall-2026', 'winter-2027']);
		expect(second.find((row) => row.term.id === 'fall-2026')?.rules.noClassDates).toContain(
			'2026-09-07'
		);
		expect(await repo.listTerms()).toHaveLength(2);
		expect(await repo.getTerm('fall-2026')).toMatchObject({ name: 'Fall 2026' });
		expect(await repo.getTerm('winter-2027')).toMatchObject({ name: 'Winter 2027' });
		expect(await repo.getCalendarRules('fall-2026')).toMatchObject({ termId: 'fall-2026' });
		expect(await repo.getCalendarRules('winter-2027')).toMatchObject({ termId: 'winter-2027' });

		const created = await repo.findOrCreateOffering({
			termId: 'fall-2026',
			code: '201-NYA-05',
			section: '00001',
			teacherName: 'Ada Lovelace',
			canonicalTitle: 'Calculus I'
		});
		const reused = await repo.findOrCreateOffering({
			termId: 'fall-2026',
			code: '201-NYA-05',
			section: '00001',
			teacherName: 'Ada Lovelace',
			canonicalTitle: 'Different Title Is Ignored'
		});
		expect(reused.offering.id).toBe(created.offering.id);
		expect(reused.course.canonicalTitle).toBe('Calculus I');
		const winter = await repo.findOrCreateOffering({
			termId: 'winter-2027',
			code: '201-NYA-05',
			section: '00001',
			teacherName: 'Ada Lovelace',
			canonicalTitle: 'Calculus I'
		});
		expect(winter.offering.termId).toBe('winter-2027');
	});

	it('upserts student profiles without exposing student IDs on the public view', async () => {
		const repo = repository();
		const profile = await repo.upsertStudentProfile({
			userId: USER_A,
			studentId: '2530622',
			displayName: 'Ada'
		});
		expect(profile.studentId).toBe('2530622');
		expect(JSON.stringify(publicStudentView(profile))).not.toContain('2530622');
		expect(await repo.getStudentRole(USER_A)).toBe('student');
		expect(await repo.getStudentRole(USER_B)).toBeNull();

		const again = await repo.upsertStudentProfile({
			userId: USER_A,
			studentId: '2530622',
			displayName: 'Ada King'
		});
		expect(again.displayName).toBe('Ada King');
		await expect(
			repo.upsertStudentProfile({ userId: USER_A, studentId: '11111' })
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await expect(
			repo.upsertStudentProfile({ userId: USER_B, studentId: '2530622' })
		).rejects.toBeInstanceOf(MariToolsConflictError);

		const disclosed = await repo.acceptNimDisclosure(USER_A);
		expect(disclosed.nimDisclosureAcceptedAt).toBeTruthy();
		const still = await repo.acceptNimDisclosure(USER_A);
		expect(still.nimDisclosureAcceptedAt).toEqual(disclosed.nimDisclosureAcceptedAt);
	});

	it('caches outline extractions and keeps PDF text off the public view', async () => {
		const repo = repository();
		const offering = await repo.findOrCreateOffering({
			termId: 'fall-2026',
			code: '603-101-MQ',
			section: '00002',
			teacherName: 'Ada Lovelace',
			canonicalTitle: 'English'
		});
		const saved = await repo.saveOutlineDocument({
			userId: USER_A,
			sha256: SHA_A,
			byteLength: 1200,
			extractedText: null
		});
		const filled = await repo.saveOutlineDocument({
			userId: USER_A,
			sha256: SHA_A,
			byteLength: 1200,
			extractedText: 'PRIVATE OUTLINE TEXT'
		});
		expect(filled.id).toBe(saved.id);
		expect(filled.extractedText).toBe('PRIVATE OUTLINE TEXT');
		expect(JSON.stringify(publicOutlineView(filled))).not.toContain('PRIVATE OUTLINE TEXT');
		const loaded = await repo.getOutlineDocument({ userId: USER_A, sha256: SHA_A });
		expect(loaded.extractedText).toBe('PRIVATE OUTLINE TEXT');
		expect(await repo.listUserOutlines(USER_A)).toEqual([
			expect.objectContaining({ sha256: SHA_A, proposals: null })
		]);

		const first = await repo.saveExtraction({
			documentSha256: SHA_A,
			offeringId: offering.offering.id,
			proposals: { assessments: [] },
			model: 'nvidia/test'
		});
		expect(first.cacheHit).toBe(false);
		const second = await repo.saveExtraction({
			documentSha256: SHA_A,
			offeringId: offering.offering.id,
			proposals: { assessments: ['ignored'] },
			model: 'nvidia/test'
		});
		expect(second.cacheHit).toBe(true);
		expect(second.extraction.proposals).toEqual({ assessments: [] });
		expect(
			await repo.findExtraction({
				documentSha256: SHA_A,
				offeringId: offering.offering.id
			})
		).toMatchObject({ id: first.extraction.id });
		expect(await repo.findExtraction({ offeringId: offering.offering.id })).toMatchObject({
			documentSha256: SHA_A
		});
		expect(await repo.listUserOutlines(USER_A)).toEqual([
			expect.objectContaining({ sha256: SHA_A, proposals: { assessments: [] } })
		]);
	});

	it('round-trips one saved schedule per account', async () => {
		const repo = repository();
		await repo.saveSchedule({ userId: USER_A, paste: '1\tCalculus\n' });
		expect(await repo.getSavedSchedule(USER_A)).toMatchObject({ paste: '1\tCalculus\n' });

		await repo.saveSchedule({ userId: USER_A, paste: '1\tPhysics\n' });
		expect(await repo.getSavedSchedule(USER_A)).toMatchObject({ paste: '1\tPhysics\n' });
		expect(await repo.getSavedSchedule(USER_B)).toBeNull();
	});

	it('joins members atomically and exposes their account details only through staff queries', async () => {
		const repo = repository();
		await repo.joinProgrammingClub({
			userId: USER_A,
			studentId: '2530622',
			username: 'ada_member',
			firstName: 'Ada',
			lastName: 'Member',
			profileImageDataUrl: 'data:image/png;base64,YQ==',
			program: 'Science, Pure and Applied Science',
			yearLevel: 'second',
			experienceLevel: 'learning',
			interests: ['web'],
			clubGoals: 'Project nights',
			staffVisibilityAccepted: true
		});
		await repo.joinProgrammingClub({
			userId: USER_B,
			studentId: '2530623',
			username: 'grace_member',
			firstName: 'Grace',
			lastName: 'Member',
			program: 'Pure and Applied Science',
			yearLevel: 'first',
			experienceLevel: 'new',
			interests: ['hardware'],
			staffVisibilityAccepted: true
		});

		const listing = await repo.listStaffClubMembers({ query: 'science' });
		expect(listing.totalCount).toBe(2);
		expect(listing.rows.map((row) => row.email).sort()).toEqual(['a@gmail.com', 'b@gmail.com']);
		expect(await repo.getStaffClubMember(USER_A)).toMatchObject({
			displayName: 'ada_member',
			firstName: 'Ada',
			studentId: '2530622',
			yearLevel: 'second',
			clubGoals: 'Project nights',
			schedulePaste: '1\tPhysics\n'
		});
		expect(await repo.getStaffClubMember(USER_B)).toMatchObject({ clubGoals: null });
		expect(await repo.listSharedClubSchedules()).toEqual([
			expect.objectContaining({ userId: USER_A, paste: '1\tPhysics\n' })
		]);

		expect(await repo.getProgrammingClubMembership(USER_A)).toMatchObject({
			scheduleSharedAt: expect.any(Date),
			requiredFormCompletedAt: null
		});
		await repo.completeProgrammingClubOnboarding(USER_A);
		expect(await repo.getProgrammingClubMembership(USER_A)).toMatchObject({
			requiredFormCompletedAt: expect.any(Date)
		});
	});

	it('preserves username casing while enforcing case-insensitive ownership', async () => {
		const repo = repository();
		const join = (userId, studentId, username, firstName) =>
			repo.joinProgrammingClub({
				userId,
				studentId,
				username,
				firstName,
				lastName: 'Member',
				program: 'Science, Pure and Applied Science',
				yearLevel: 'first',
				experienceLevel: 'new',
				interests: ['web'],
				staffVisibilityAccepted: true
			});
		await join(USER_C, '2530624', 'ZHiCh', 'Case');
		expect(await repo.getStaffClubMember(USER_C)).toMatchObject({
			username: 'ZHiCh',
			displayName: 'ZHiCh'
		});

		await expect(join(USER_D, '2530625', 'zhich', 'Other')).rejects.toBeInstanceOf(
			MariToolsConflictError
		);
		await join(USER_D, '2530625', 'other_member', 'Other');
		const client = new Client({ connectionString: databaseUrl });
		await client.connect();
		try {
			await expect(
				client.query('UPDATE mt_student_profiles SET username = $1 WHERE user_id = $2', [
					'zhich',
					USER_D
				])
			).rejects.toMatchObject({ code: '23505' });
		} finally {
			await client.end();
		}

		await expect(
			repo.updateMemberProfile({
				userId: USER_C,
				username: 'zHiCh',
				firstName: 'Case',
				lastName: 'Member'
			})
		).resolves.toMatchObject({ username: 'zHiCh', displayName: 'zHiCh' });
		expect(await repo.getStaffClubMember(USER_C)).toMatchObject({ username: 'zHiCh' });
	});

	it('persists a private reviewed outline and deletes only that account copy', async () => {
		const repo = repository();
		await repo.saveOutlineDocument({
			userId: USER_B,
			sha256: SHA_B,
			byteLength: 900,
			extractedText: 'PRIVATE B'
		});
		await repo.saveOutlineReview({
			userId: USER_B,
			sha256: SHA_B,
			proposals: { title: 'Student correction', assessments: [], books: [] }
		});
		expect(await repo.listUserOutlines(USER_B)).toEqual([
			expect.objectContaining({
				sha256: SHA_B,
				reviewProposals: expect.objectContaining({ title: 'Student correction' })
			})
		]);
		await repo.deleteOutlineDocument({ userId: USER_B, sha256: SHA_B });
		expect(await repo.listUserOutlines(USER_B)).toEqual([]);
		expect(await repo.getOutlineDocument({ userId: USER_A, sha256: SHA_A })).not.toBeNull();
		await expect(
			repo.deleteOutlineDocument({ userId: USER_B, sha256: SHA_B })
		).rejects.toBeInstanceOf(MariToolsNotFoundError);
	});

	it('publishes catalog contributions with a visible conflict instead of last-write-wins', async () => {
		const repo = repository();
		const offering = await repo.findOrCreateOffering({
			termId: 'fall-2026',
			code: '420-NYA-05',
			section: '00003',
			teacherName: 'Ada Lovelace',
			canonicalTitle: 'Programming'
		});
		const first = await repo.publishCatalogContribution({
			offeringId: offering.offering.id,
			contributorUserId: USER_A,
			documentSha256: SHA_A,
			structured: { title: 'Programming', isbn: '9780000000001' }
		});
		expect(first.conflict).toBe(false);
		expect(first.contribution.status).toBe('published');

		const same = await repo.publishCatalogContribution({
			offeringId: offering.offering.id,
			contributorUserId: USER_B,
			documentSha256: SHA_A,
			structured: { title: 'Programming', isbn: '9780000000001' }
		});
		expect(same.conflict).toBe(false);
		expect(same.contribution.id).toBe(first.contribution.id);

		const mismatched = await repo.publishCatalogContribution({
			offeringId: offering.offering.id,
			contributorUserId: USER_B,
			documentSha256: SHA_A,
			structured: { title: 'Programming', isbn: '9789999999999' }
		});
		expect(mismatched.conflict).toBe(true);
		expect(mismatched.contribution.status).toBe('conflict');
		expect(mismatched.contribution.structured).toEqual({
			title: 'Programming',
			isbn: '9780000000001'
		});

		const otherSha = await repo.publishCatalogContribution({
			offeringId: offering.offering.id,
			contributorUserId: USER_B,
			documentSha256: SHA_B,
			structured: { title: 'Different outline' }
		});
		expect(otherSha.conflict).toBe(true);
		expect(otherSha.contribution.status).toBe('conflict');
		const listed = await repo.listCatalogContributions({ offeringId: offering.offering.id });
		expect(listed.some((row) => row.status === 'conflict')).toBe(true);
		expect(listed.find((row) => row.documentSha256 === SHA_A).structured).toEqual({
			title: 'Programming',
			isbn: '9780000000001'
		});
		const catalog = await repo.listPublishedCatalog({ termId: 'fall-2026' });
		expect(Array.isArray(catalog)).toBe(true);
	});

	it('serializes concurrent catalog publications for one offering', async () => {
		const repo = repository();
		const offering = await repo.findOrCreateOffering({
			termId: 'fall-2026',
			code: '201-NYC-05',
			section: '00007',
			teacherName: 'Concurrent Teacher',
			canonicalTitle: 'Linear Algebra'
		});
		const [left, right] = await Promise.all([
			repo.publishCatalogContribution({
				offeringId: offering.offering.id,
				contributorUserId: USER_A,
				documentSha256: SHA_A,
				structured: { title: 'Left' }
			}),
			repo.publishCatalogContribution({
				offeringId: offering.offering.id,
				contributorUserId: USER_B,
				documentSha256: SHA_B,
				structured: { title: 'Right' }
			})
		]);
		expect([left.conflict, right.conflict].filter(Boolean)).toHaveLength(1);
		const rows = await repo.listCatalogContributions({
			offeringId: offering.offering.id
		});
		expect(rows).toHaveLength(2);
		const published = rows.filter((row) => row.status === 'published');
		expect(published.length).toBeLessThanOrEqual(1);
	});

	it('stores club submissions and forum threads without leaking student IDs', async () => {
		const repo = repository();
		const unpublished = await repo.createClub({
			name: 'Chess Club',
			slug: 'chess-club',
			published: false
		});
		expect(await repo.listPublishedClubs()).toEqual([]);
		const published = await repo.createClub({
			name: 'Robotics',
			slug: 'robotics',
			category: 'stem',
			description: 'Builds robots',
			links: [{ label: 'Discord', url: 'https://discord.gg/example' }],
			published: true
		});
		expect(await repo.listPublishedClubs()).toMatchObject([{ id: published.id, slug: 'robotics' }]);
		expect(await repo.getPublishedClubBySlug('robotics')).toMatchObject({ slug: 'robotics' });
		expect(await repo.getPublishedClubBySlug('chess-club')).toBeNull();
		expect(await repo.getPublishedClubBySlug('')).toBeNull();
		expect(await repo.getPublishedClubBySlug('Bad Slug')).toBeNull();
		expect(await repo.getPublishedClubBySlug(null)).toBeNull();
		await expect(repo.createClub({ name: 'Robotics 2', slug: 'robotics' })).rejects.toBeInstanceOf(
			MariToolsConflictError
		);

		const submission = await repo.submitClub({
			submitterUserId: USER_A,
			clubId: unpublished.id,
			payload: { name: 'Chess Club', room: 'C-204' }
		});
		expect(submission.status).toBe('pending');
		expect(await repo.listClubSubmissions({ status: 'pending' })).toHaveLength(1);
		const accepted = await repo.setClubSubmissionStatus(submission.id, 'published');
		expect(accepted.status).toBe('published');

		const offering = await repo.findOrCreateOffering({
			termId: 'fall-2026',
			code: '201-NYA-05',
			section: '00001',
			teacherName: 'Ada Lovelace',
			canonicalTitle: 'Calculus I'
		});
		const thread = await repo.createThread({
			authorUserId: USER_A,
			title: 'Midterm tips',
			body: 'Bring a calculator.',
			category: 'courses',
			courseId: offering.course.id,
			offeringId: offering.offering.id,
			termId: 'fall-2026'
		});
		expect(JSON.stringify(thread)).not.toContain('2530622');
		expect(await repo.listThreads({ category: 'courses' })).toHaveLength(1);
		expect(await repo.getThread(thread.id)).toMatchObject({ title: 'Midterm tips' });

		const reply = await repo.createReply({
			threadId: thread.id,
			authorUserId: USER_B,
			body: 'Thanks'
		});
		expect(await repo.listReplies(thread.id)).toHaveLength(1);
		const threadReport = await repo.createReport({
			targetKind: 'thread',
			targetId: thread.id,
			reporterUserId: USER_B,
			reason: 'noise'
		});
		expect(threadReport.targetKind).toBe('thread');
		const report = await repo.createReport({
			targetKind: 'reply',
			targetId: reply.id,
			reporterUserId: USER_A,
			reason: 'off topic'
		});
		expect(await repo.listReports({ status: 'open' })).toHaveLength(2);
		const resolved = await repo.setReportStatus(report.id, 'dismissed');
		expect(resolved.status).toBe('dismissed');

		await repo.lockThread(thread.id);
		await expect(
			repo.createReply({ threadId: thread.id, authorUserId: USER_B, body: 'later' })
		).rejects.toBeInstanceOf(MariToolsConflictError);
		await repo.removeReply(reply.id);
		expect(await repo.listReplies(thread.id)).toHaveLength(0);
		await repo.removeThread(thread.id);
		expect(await repo.listThreads()).toHaveLength(0);
		expect(await repo.getThread(thread.id)).toMatchObject({ id: thread.id });
	});
});
