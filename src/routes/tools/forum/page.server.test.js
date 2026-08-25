// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { MaritoolsInputError, MaritoolsUnavailableError } from '$lib/server/maritools/student-store.js';
import { prerender, _createHandlers } from './+page.server.js';

const SESSION = {
	userId: 'user-1',
	sessionId: 'session-1',
	email: 'ada@gmail.com',
	googleSubject: 'sub-1',
	expiresAt: new Date('2030-01-01T00:00:00.000Z')
};
const COURSE = '11111111-1111-4111-8111-111111111111';
const THREAD = '20000000-0000-4000-8000-000000000001';

function handlers(overrides = {}) {
	const store = {
		listThreads: vi.fn(async () => [
			{ id: THREAD, title: 'Midterm tips', body: 'Bring a calculator.', category: 'courses', courseId: COURSE }
		]),
		listCatalogCourses: vi.fn(async () => [
			{ id: COURSE, code: '203-SN3-RE', title: 'Modern Physics' }
		]),
		createThread: vi.fn(async () => ({ id: THREAD, title: 'Hi' })),
		...overrides.store
	};
	return {
		..._createHandlers({
			createStore: vi.fn(() => store),
			...overrides
		}),
		store
	};
}

function event({ locals = {}, form = {}, search = '' } = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(form)) data.set(key, String(value));
	return {
		locals,
		url: new URL(`https://club.example.com/tools/forum${search}`),
		request: { formData: async () => data }
	};
}

describe('forum page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('lists threads anonymously and attaches catalog course codes', async () => {
		const current = handlers();
		const data = await current.load(event());
		expect(data.threads[0].courseCode).toBe('203-SN3-RE');
		expect(data.signedIn).toBe(false);
		expect(JSON.stringify(data)).not.toMatch(/2530622|authorUserId/);
		const signed = await current.load(event({ locals: { maritools: SESSION } }));
		expect(signed.signedIn).toBe(true);
		const untagged = handlers({
			store: {
				listThreads: vi.fn(async () => [
					{ id: THREAD, title: 'Club fair', category: 'student-life', courseId: null }
				])
			}
		});
		expect((await untagged.load(event())).threads[0].courseCode).toBeNull();
		const unknownCourse = handlers({
			store: {
				listThreads: vi.fn(async () => [
					{ id: THREAD, title: 'Orphan', category: 'courses', courseId: COURSE }
				]),
				listCatalogCourses: vi.fn(async () => [])
			}
		});
		expect((await unknownCourse.load(event())).threads[0].courseCode).toBeNull();
	});

	it('forwards category and valid course filters', async () => {
		const current = handlers();
		await current.load(event({ search: `?category=courses&course=${COURSE}` }));
		expect(current.store.listThreads).toHaveBeenCalledWith({
			category: 'courses',
			courseId: COURSE
		});
		await current.load(event({ search: '?category=student-life' }));
		expect(current.store.listThreads).toHaveBeenCalledWith({ category: 'student-life' });
		await current.load(event({ search: '?category=nope&course=bad' }));
		expect(current.store.listThreads).toHaveBeenCalledWith({});
	});

	it('returns an empty list when the forum cannot be read', async () => {
		const current = handlers({
			store: {
				listThreads: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(current.load(event())).resolves.toMatchObject({
			threads: [],
			unavailable: true
		});
		const closed = handlers({
			createStore: vi.fn(() => {
				throw new MaritoolsUnavailableError();
			})
		});
		await expect(closed.load(event({ locals: { maritools: SESSION } }))).resolves.toMatchObject({
			threads: [],
			signedIn: true,
			unavailable: true
		});
	});

	it('rethrows unexpected load failures', async () => {
		const current = handlers({
			store: {
				listThreads: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(current.load(event())).rejects.toThrow('boom');
	});

	it('creates a course-tagged thread and redirects', async () => {
		const current = handlers();
		await expect(
			current.actions.create(
				event({
					locals: { maritools: SESSION },
					form: {
						title: 'Lab help',
						body: 'Where is A-109?',
						category: 'courses',
						courseId: COURSE
					}
				})
			)
		).rejects.toMatchObject({ status: 303, location: `/tools/forum/${THREAD}` });
		expect(current.store.createThread).toHaveBeenCalledWith({
			authorUserId: SESSION.userId,
			title: 'Lab help',
			body: 'Where is A-109?',
			category: 'courses',
			courseId: COURSE
		});
	});

	it('omits a course tag for student-life threads', async () => {
		const current = handlers();
		await expect(
			current.actions.create(
				event({
					locals: { maritools: SESSION },
					form: {
						title: 'Club fair',
						body: 'When is it?',
						category: 'student-life',
						courseId: COURSE
					}
				})
			)
		).rejects.toMatchObject({ status: 303 });
		expect(current.store.createThread).toHaveBeenCalledWith({
			authorUserId: SESSION.userId,
			title: 'Club fair',
			body: 'When is it?',
			category: 'student-life'
		});
	});

	it('rejects create without a session or required fields', async () => {
		expect((await handlers().actions.create(event({ form: { title: 'Hi', body: 'x' } }))).status).toBe(
			401
		);
		expect(
			(
				await handlers().actions.create(
					event({ locals: { maritools: SESSION }, form: { category: 'student-life' } })
				)
			).status
		).toBe(400);
		expect(
			(
				await handlers().actions.create(
					event({
						locals: { maritools: SESSION },
						form: { title: 'Hi', body: 'Hello', category: 'memes' }
					})
				)
			).status
		).toBe(400);
		expect(
			(
				await handlers().actions.create(
					event({ locals: { maritools: SESSION }, form: { title: 'Hi', body: 'Hello' } })
				)
			).status
		).toBe(400);
		expect(
			(
				await handlers().actions.create(
					event({
						locals: { maritools: SESSION },
						form: { title: 'Hi', body: 'Hello', category: 'courses', courseId: 'bad' }
					})
				)
			).status
		).toBe(400);
	});

	it('returns bounded create errors', async () => {
		const invalid = handlers({
			store: {
				createThread: vi.fn(async () => {
					throw new MaritoolsInputError('invalid');
				})
			}
		});
		expect(
			(
				await invalid.actions.create(
					event({
						locals: { maritools: SESSION },
						form: { title: 'Hi', body: 'Hello', category: 'student-life' }
					})
				)
			).status
		).toBe(400);
		const down = handlers({
			store: {
				createThread: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(
				await down.actions.create(
					event({
						locals: { maritools: SESSION },
						form: { title: 'Hi', body: 'Hello', category: 'student-life' }
					})
				)
			).status
		).toBe(503);
		const boom = handlers({
			store: {
				createThread: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			boom.actions.create(
				event({
					locals: { maritools: SESSION },
					form: { title: 'Hi', body: 'Hello', category: 'student-life' }
				})
			)
		).rejects.toThrow('boom');
		const empty = handlers({ store: { createThread: vi.fn(async () => null) } });
		expect(
			(
				await empty.actions.create(
					event({
						locals: { maritools: SESSION },
						form: { title: 'Hi', body: 'Hello', category: 'student-life' }
					})
				)
			).status
		).toBe(503);
	});
});
