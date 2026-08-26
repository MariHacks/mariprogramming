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
	createCommunityStore,
	openCommunityStore,
	publicClubView,
	publicReplyView,
	publicThreadView,
	slugFromName
} from './community-store.js';

const USER = 'user-1';
const COURSE = '11111111-1111-4111-8111-111111111111';
const THREAD = '20000000-0000-4000-8000-000000000001';
const SUBMISSION = '60000000-0000-4000-8000-000000000001';

function inner(overrides = {}) {
	return {
		listPublishedClubs: vi.fn(async () => [
			{ id: 'c1', name: 'Robotics', slug: 'robotics', category: 'stem', description: 'Bots', links: [] }
		]),
		getPublishedClubBySlug: vi.fn(async (slug) =>
			slug === 'robotics'
				? { id: 'c1', name: 'Robotics', slug: 'robotics', category: 'stem', description: 'Bots', links: [] }
				: null
		),
		submitClub: vi.fn(async () => ({ id: SUBMISSION, status: 'pending' })),
		listClubSubmissions: vi.fn(async () => [
			{
				id: SUBMISSION,
				payload: {
					name: 'Chess',
					slug: 'chess',
					category: 'games',
					description: 'Play',
					links: [{ label: 'Site', url: 'https://example.com' }]
				}
			}
		]),
		createClub: vi.fn(async () => ({
			id: 'club-1',
			name: 'Chess',
			slug: 'chess',
			category: 'games',
			description: 'Play',
			links: []
		})),
		setClubSubmissionStatus: vi.fn(async () => ({ status: 'published' })),
		listPublishedCatalog: vi.fn(async () => [
			{ courseId: COURSE, courseCode: '203-SN3-RE', title: 'Modern Physics' },
			{ courseId: COURSE, courseCode: '203-SN3-RE', title: 'Modern Physics' },
			{ courseCode: 'NO-ID', title: 'Skipped' }
		]),
		listThreads: vi.fn(async () => [
			{ id: THREAD, title: 'Hi', body: 'Hello', category: 'courses', courseId: COURSE }
		]),
		getThread: vi.fn(async () => ({
			id: THREAD,
			title: 'Hi',
			body: 'Hello',
			category: 'courses',
			authorUserId: USER
		})),
		listReplies: vi.fn(async () => [{ id: 'r1', threadId: THREAD, body: 'Thanks', authorUserId: USER }]),
		createThread: vi.fn(async () => ({ id: THREAD, title: 'Hi', body: 'Hello', category: 'student-life' })),
		createReply: vi.fn(async () => ({ id: 'r1', threadId: THREAD, body: 'Thanks' })),
		createReport: vi.fn(async () => ({ id: 'rep-1' })),
		lockThread: vi.fn(async () => ({ id: THREAD, lockedAt: new Date() })),
		removeThread: vi.fn(async () => ({ id: THREAD, removedAt: new Date() })),
		removeReply: vi.fn(async () => ({ id: 'r1', removedAt: new Date() })),
		getStudentProfile: vi.fn(async () => ({
			userId: USER,
			studentId: '2530622',
			displayName: 'Ada',
			role: 'student'
		})),
		...overrides
	};
}

describe('community views', () => {
	it('builds slugs and drops empty public records', () => {
		expect(slugFromName('Robotics Club')).toBe('robotics-club');
		expect(publicThreadView(null)).toBeNull();
		expect(publicReplyView(undefined)).toBeNull();
		expect(publicClubView(null)).toBeNull();
		expect(publicClubView({ id: '1', name: 'Chess', slug: 'chess', links: 'nope' }).links).toEqual([]);
	});
});

describe('createCommunityStore', () => {
	it('loads a published club by slug', async () => {
		const store = createCommunityStore(inner());
		await expect(store.getPublishedClubBySlug('robotics')).resolves.toMatchObject({
			slug: 'robotics',
			name: 'Robotics'
		});
		await expect(store.getPublishedClubBySlug('missing')).resolves.toBeNull();
	});

	it('lists clubs, pending submissions, and catalog courses without student numbers', async () => {
		const repo = inner();
		const store = createCommunityStore(repo);
		const clubs = await store.listClubs();
		expect(clubs[0].name).toBe('Robotics');
		const pending = await store.listPendingClubSubmissions();
		expect(pending[0]).toMatchObject({ id: SUBMISSION, name: 'Chess', slug: 'chess' });
		const courses = await store.listCatalogCourses();
		expect(courses).toEqual([{ id: COURSE, code: '203-SN3-RE', title: 'Modern Physics' }]);
		expect(JSON.stringify({ clubs, pending, courses })).not.toContain('2530622');
	});

	it('publishes a pending club through the repository', async () => {
		const repo = inner();
		const store = createCommunityStore(repo);
		await expect(store.publishPendingClub(SUBMISSION)).resolves.toMatchObject({ slug: 'chess' });
		expect(repo.createClub).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Chess', slug: 'chess', published: true })
		);
		expect(repo.setClubSubmissionStatus).toHaveBeenCalledWith(SUBMISSION, 'published');
	});

	it('rejects a missing or nameless pending club', async () => {
		const missing = createCommunityStore(inner({ listClubSubmissions: vi.fn(async () => []) }));
		await expect(missing.publishPendingClub(SUBMISSION)).rejects.toMatchObject({
			code: 'missing-submission'
		});
		const nameless = createCommunityStore(
			inner({ listClubSubmissions: vi.fn(async () => [{ id: SUBMISSION, payload: { name: '   ' } }]) })
		);
		await expect(nameless.publishPendingClub(SUBMISSION)).rejects.toMatchObject({ code: 'invalid-club' });
		const repo = inner({
			listClubSubmissions: vi.fn(async () => [{ id: SUBMISSION, payload: { name: 'Chess Club' } }])
		});
		await createCommunityStore(repo).publishPendingClub(SUBMISSION);
		expect(repo.createClub).toHaveBeenCalledWith(expect.objectContaining({ slug: 'chess-club' }));
		const emptyPayload = inner({
			listClubSubmissions: vi.fn(async () => [{ id: SUBMISSION }])
		});
		await expect(
			createCommunityStore(emptyPayload).publishPendingClub(SUBMISSION)
		).rejects.toMatchObject({ code: 'invalid-club' });
		const existing = inner({
			createClub: vi.fn(async () => {
				throw new MariToolsConflictError();
			}),
			listPublishedClubs: vi.fn(async () => [{ id: 'c1', name: 'Chess', slug: 'chess' }])
		});
		await expect(createCommunityStore(existing).publishPendingClub(SUBMISSION)).resolves.toMatchObject({
			slug: 'chess'
		});
		const failedCreate = inner({
			createClub: vi.fn(async () => {
				throw new Error('insert failed');
			})
		});
		await expect(createCommunityStore(failedCreate).publishPendingClub(SUBMISSION)).rejects.toBeInstanceOf(
			MaritoolsUnavailableError
		);
	});

	it('submits clubs and lists public threads', async () => {
		const repo = inner();
		const store = createCommunityStore(repo);
		await store.submitClub({ submitterUserId: USER, payload: { name: 'Chess' } });
		expect(repo.submitClub).toHaveBeenCalledWith({
			submitterUserId: USER,
			clubId: null,
			payload: { name: 'Chess' }
		});
		const threads = await store.listThreads({ category: 'courses', courseId: COURSE });
		expect(threads[0]).not.toHaveProperty('authorUserId');
		await store.listThreads();
		expect(await store.getThread(THREAD)).toMatchObject({ id: THREAD, title: 'Hi' });
		const empty = createCommunityStore(inner({ getThread: vi.fn(async () => null) }));
		await expect(empty.getThread(THREAD)).resolves.toBeNull();
		expect((await store.listReplies(THREAD))[0]).not.toHaveProperty('authorUserId');
	});

	it('creates threads, replies, and reports', async () => {
		const store = createCommunityStore(inner());
		await expect(
			store.createThread({ authorUserId: USER, title: 'Hi', body: 'Hello', category: 'student-life' })
		).resolves.toMatchObject({ id: THREAD });
		await expect(
			store.createReply({ threadId: THREAD, authorUserId: USER, body: 'Thanks' })
		).resolves.toMatchObject({ body: 'Thanks' });
		await expect(
			store.createReport({
				targetKind: 'thread',
				targetId: THREAD,
				reporterUserId: USER,
				reason: 'spam'
			})
		).resolves.toMatchObject({ id: 'rep-1' });
	});

	it('locks and removes forum records', async () => {
		const store = createCommunityStore(inner());
		await expect(store.lockThread(THREAD)).resolves.toMatchObject({ id: THREAD });
		await expect(store.removeThread(THREAD)).resolves.toMatchObject({ id: THREAD });
		await expect(store.removeReply('r1')).resolves.toMatchObject({ id: 'r1' });
	});

	it('redacts profiles and reports staff', async () => {
		const store = createCommunityStore(inner());
		const profile = await store.getProfile(USER);
		expect(profile).not.toHaveProperty('studentId');
		expect(store.isStaff('team@marihacks.com')).toBe(true);
		const missing = createCommunityStore(inner({ getStudentProfile: vi.fn(async () => null) }));
		await expect(missing.getProfile(USER)).resolves.toBeNull();
	});

	it('maps repository domain errors', async () => {
		const store = createCommunityStore(
			inner({
				listPublishedClubs: vi.fn(async () => {
					throw new Error('connection');
				})
			})
		);
		await expect(store.listClubs()).rejects.toBeInstanceOf(MaritoolsUnavailableError);

		const validation = createCommunityStore(
			inner({
				listPublishedClubs: vi.fn(async () => {
					throw new MariToolsValidationError();
				})
			})
		);
		await expect(validation.listClubs()).rejects.toBeInstanceOf(MaritoolsInputError);

		const conflict = createCommunityStore(
			inner({
				listPublishedClubs: vi.fn(async () => {
					throw new MariToolsConflictError();
				})
			})
		);
		await expect(conflict.listClubs()).rejects.toBeInstanceOf(MaritoolsInputError);

		const missing = createCommunityStore(
			inner({
				listPublishedClubs: vi.fn(async () => {
					throw new MariToolsNotFoundError();
				})
			})
		);
		await expect(missing.listClubs()).rejects.toBeInstanceOf(MaritoolsUnavailableError);

		const down = createCommunityStore(
			inner({
				listPublishedClubs: vi.fn(async () => {
					throw new MariToolsUnavailableError();
				})
			})
		);
		await expect(down.listClubs()).rejects.toBeInstanceOf(MaritoolsUnavailableError);

		const local = createCommunityStore(
			inner({
				listPublishedClubs: vi.fn(async () => {
					throw new MaritoolsInputError('invalid');
				})
			})
		);
		await expect(local.listClubs()).rejects.toBeInstanceOf(MaritoolsInputError);

		const unavailable = createCommunityStore(
			inner({
				listPublishedClubs: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			})
		);
		await expect(unavailable.listClubs()).rejects.toBeInstanceOf(MaritoolsUnavailableError);

		const slugDown = createCommunityStore(
			inner({
				getPublishedClubBySlug: vi.fn(async () => {
					throw new MariToolsNotFoundError();
				})
			})
		);
		await expect(slugDown.getPublishedClubBySlug('robotics')).rejects.toBeInstanceOf(
			MaritoolsUnavailableError
		);
	});

	it('defaults pending payload fields', async () => {
		const store = createCommunityStore(
			inner({
				listClubSubmissions: vi.fn(async () => [{ id: SUBMISSION, payload: null }])
			})
		);
		await expect(store.listPendingClubSubmissions()).resolves.toEqual([
			{ id: SUBMISSION, name: '', slug: '', category: '', description: '', links: [] }
		]);
	});
});

describe('openCommunityStore', () => {
	afterEach(() => vi.restoreAllMocks());

	it('builds a store from the runtime database url', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockReturnValue({
			databaseUrl: 'postgresql://runtime:secret@db.example/club'
		});
		const store = openCommunityStore();
		expect(typeof store.listClubs).toBe('function');
	});

	it('treats missing runtime config as unavailable', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockImplementation(() => {
			throw new Error('Server configuration is unavailable');
		});
		expect(() => openCommunityStore()).toThrow(MaritoolsUnavailableError);
		vi.mocked(environment.readRuntimeEnvironment).mockImplementation(() => {
			throw new MaritoolsUnavailableError();
		});
		expect(() => openCommunityStore()).toThrow(MaritoolsUnavailableError);
	});
});
