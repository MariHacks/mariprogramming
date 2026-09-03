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
const STAFF = { ...SESSION, email: 'team@marihacks.com' };
const THREAD = '20000000-0000-4000-8000-000000000001';
const REPLY = '30000000-0000-4000-8000-000000000001';
const THREAD_ROW = {
	id: THREAD,
	title: 'Midterm tips',
	body: 'Bring a calculator.',
	category: 'courses',
	lockedAt: null,
	removedAt: null
};

/**
 * @param {any} [overrides]
 * @returns {any}
 */
function handlers(overrides = {}) {
	const store = {
		getThread: vi.fn(async () => THREAD_ROW),
		listReplies: vi.fn(async () => [{ id: REPLY, threadId: THREAD, body: 'Thanks' }]),
		listCatalogCourses: vi.fn(async () => []),
		getProfile: vi.fn(async () => null),
		isStaff: vi.fn((email, role) => email === 'team@marihacks.com' || role === 'staff'),
		createReply: vi.fn(async () => ({ id: REPLY })),
		createReport: vi.fn(async () => ({ id: 'rep-1' })),
		updateThread: vi.fn(async () => ({ ...THREAD_ROW, body: 'Edited' })),
		updateReply: vi.fn(async () => ({ id: REPLY, body: 'Edited reply' })),
		lockThread: vi.fn(async () => THREAD_ROW),
		removeThread: vi.fn(async () => THREAD_ROW),
		removeReply: vi.fn(async () => ({ id: REPLY })),
		muteUser: vi.fn(async () => ({ userId: SESSION.userId })),
		banUser: vi.fn(async () => ({ userId: SESSION.userId })),
		canManageThread: vi.fn(async () => false),
		canManageReply: vi.fn(async () => false),
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

/**
 * @param {any} [options]
 * @returns {any}
 */
function event({ locals = {}, form = {}, params = { threadId: THREAD } } = {}) {
	const data = new FormData();
	for (const [key, value] of Object.entries(form)) data.set(key, String(value));
	return {
		locals,
		params,
		request: { formData: async () => data }
	};
}

describe('forum thread page server', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('loads a thread for anonymous readers', async () => {
		const data = await handlers().load(event());
		expect(data.thread.title).toBe('Midterm tips');
		expect(data.thread.courseCode).toBeNull();
		expect(data.replies).toHaveLength(1);
		expect(data.canReply).toBe(false);
		expect(JSON.stringify(data)).not.toMatch(/2530622/);
	});

	it('attaches a catalog course code when the thread is tagged', async () => {
		const courseId = '11111111-1111-4111-8111-111111111111';
		const current = handlers({
			store: {
				getThread: vi.fn(async () => ({ ...THREAD_ROW, courseId })),
				listCatalogCourses: vi.fn(async () => [{ id: courseId, code: '203-SN3-RE', title: 'Modern Physics' }])
			}
		});
		const data = await current.load(event());
		expect(data.thread.courseCode).toBe('203-SN3-RE');
	});

	it('leaves courseCode empty when the tagged course is gone', async () => {
		const current = handlers({
			store: {
				getThread: vi.fn(async () => ({
					...THREAD_ROW,
					courseId: '11111111-1111-4111-8111-111111111111'
				})),
				listCatalogCourses: vi.fn(async () => [{ id: 'other', code: '201-NYA-05' }])
			}
		});
		const data = await current.load(event());
		expect(data.thread.courseCode).toBeNull();
	});

	it('lets a signed-in student reply when the thread is open', async () => {
		const data = await handlers().load(event({ locals: { maritools: SESSION } }));
		expect(data.signedIn).toBe(true);
		expect(data.canReply).toBe(true);
	});

	it('passes the viewer into thread and reply loads for manage flags', async () => {
		const current = handlers({
			store: {
				getThread: vi.fn(async (_id, viewer) => ({
					...THREAD_ROW,
					canManage: Boolean(viewer?.staff || viewer?.userId === SESSION.userId)
				})),
				listReplies: vi.fn(async (_id, viewer) => [
					{ id: REPLY, body: 'Thanks', canManage: Boolean(viewer?.userId === SESSION.userId) }
				])
			}
		});
		const data = await current.load(event({ locals: { maritools: SESSION } }));
		expect(current.store.getThread).toHaveBeenCalledWith(
			THREAD,
			expect.objectContaining({ userId: SESSION.userId, staff: false })
		);
		expect(current.store.listReplies).toHaveBeenCalledWith(
			THREAD,
			expect.objectContaining({ userId: SESSION.userId, staff: false })
		);
		expect(data.thread.canManage).toBe(true);
		expect(data.replies[0].canManage).toBe(true);
	});

	it('returns not found for missing or removed threads', async () => {
		const missing = handlers({ store: { getThread: vi.fn(async () => null) } });
		await expect(missing.load(event())).resolves.toMatchObject({ notFound: true, thread: null });
		const removed = handlers({
			store: { getThread: vi.fn(async () => ({ ...THREAD_ROW, removedAt: new Date() })) }
		});
		await expect(removed.load(event())).resolves.toMatchObject({ notFound: true });
	});

	it('returns unavailable and rethrows unexpected errors', async () => {
		const down = handlers({
			store: {
				getThread: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(down.load(event())).resolves.toMatchObject({ unavailable: true });
		const closed = handlers({
			createStore: vi.fn(() => {
				throw new MaritoolsUnavailableError();
			})
		});
		await expect(closed.load(event({ locals: { maritools: SESSION } }))).resolves.toMatchObject({
			unavailable: true,
			signedIn: true
		});
		const staffDown = handlers({
			store: {
				getProfile: vi.fn(async () => ({ role: 'staff' })),
				getThread: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		await expect(staffDown.load(event({ locals: { maritools: SESSION } }))).resolves.toMatchObject({
			unavailable: true,
			staff: true,
			signedIn: true
		});
		const boom = handlers({
			store: {
				getThread: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(boom.load(event())).rejects.toThrow('boom');
		const profileBoom = handlers({
			store: {
				getProfile: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(profileBoom.load(event({ locals: { maritools: SESSION } }))).rejects.toThrow('boom');
	});

	it('posts a reply', async () => {
		const current = handlers();
		await expect(
			current.actions.reply(event({ locals: { maritools: SESSION }, form: { body: 'Thanks' } }))
		).resolves.toEqual({ replied: true });
		expect((await current.actions.reply(event({ form: { body: 'Thanks' } }))).status).toBe(401);
		expect(
			(await current.actions.reply(event({ locals: { maritools: SESSION } }))).status
		).toBe(400);
	});

	it('returns bounded reply errors', async () => {
		const invalid = handlers({
			store: {
				createReply: vi.fn(async () => {
					throw new MaritoolsInputError('invalid');
				})
			}
		});
		expect(
			(await invalid.actions.reply(event({ locals: { maritools: SESSION }, form: { body: 'Hi' } }))).status
		).toBe(400);
		const down = handlers({
			store: {
				createReply: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(await down.actions.reply(event({ locals: { maritools: SESSION }, form: { body: 'Hi' } }))).status
		).toBe(503);
		const boom = handlers({
			store: {
				createReply: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			boom.actions.reply(event({ locals: { maritools: SESSION }, form: { body: 'Hi' } }))
		).rejects.toThrow('boom');
	});

	it('files a report', async () => {
		const current = handlers();
		await expect(
			current.actions.report(
				event({
					locals: { maritools: SESSION },
					form: { targetKind: 'thread', targetId: THREAD, reason: 'spam' }
				})
			)
		).resolves.toEqual({ reported: true });
		expect((await current.actions.report(event({ form: { reason: 'spam' } }))).status).toBe(401);
		expect(
			(await current.actions.report(event({ locals: { maritools: SESSION } }))).status
		).toBe(400);
	});

	it('returns bounded report errors', async () => {
		const invalid = handlers({
			store: {
				createReport: vi.fn(async () => {
					throw new MaritoolsInputError('invalid');
				})
			}
		});
		expect(
			(
				await invalid.actions.report(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'thread', targetId: THREAD, reason: 'spam' }
					})
				)
			).status
		).toBe(400);
		const down = handlers({
			store: {
				createReport: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(
				await down.actions.report(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'thread', targetId: THREAD, reason: 'spam' }
					})
				)
			).status
		).toBe(503);
		const boom = handlers({
			store: {
				createReport: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			boom.actions.report(
				event({
					locals: { maritools: SESSION },
					form: { targetKind: 'thread', targetId: THREAD, reason: 'spam' }
				})
			)
		).rejects.toThrow('boom');
	});

	it('edits and deletes as the author or staff', async () => {
		const author = handlers({
			store: {
				canManageThread: vi.fn(async () => true),
				canManageReply: vi.fn(async () => true)
			}
		});
		await expect(
			author.actions.edit(
				event({
					locals: { maritools: SESSION },
					form: { targetKind: 'thread', targetId: THREAD, body: 'Updated body' }
				})
			)
		).resolves.toEqual({ edited: true });
		expect(author.store.updateThread).toHaveBeenCalledWith({
			id: THREAD,
			body: 'Updated body'
		});
		await expect(
			author.actions.edit(
				event({
					locals: { maritools: SESSION },
					form: { targetKind: 'reply', targetId: REPLY, body: 'Updated reply' }
				})
			)
		).resolves.toEqual({ edited: true });
		await expect(
			author.actions.delete(
				event({
					locals: { maritools: SESSION },
					form: { targetKind: 'reply', targetId: REPLY }
				})
			)
		).resolves.toEqual({ deleted: true });
		expect(author.store.removeReply).toHaveBeenCalledWith(REPLY);

		const denied = handlers({
			store: {
				canManageThread: vi.fn(async () => false),
				canManageReply: vi.fn(async () => false)
			}
		});
		expect(
			(
				await denied.actions.edit(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'thread', targetId: THREAD, body: 'Nope' }
					})
				)
			).status
		).toBe(403);
		expect((await denied.actions.edit(event({ form: { body: 'Nope' } }))).status).toBe(401);
		expect(
			(
				await denied.actions.edit(
					event({ locals: { maritools: SESSION }, form: { targetKind: 'thread', targetId: THREAD } })
				)
			).status
		).toBe(400);

		const staff = handlers({
			store: {
				canManageThread: vi.fn(async () => true),
				canManageReply: vi.fn(async () => true)
			}
		});
		await expect(
			staff.actions.delete(
				event({
					locals: { maritools: STAFF },
					form: { targetKind: 'thread', targetId: THREAD }
				})
			)
		).rejects.toMatchObject({ status: 303, location: '/tools/forum' });
		expect(staff.store.removeThread).toHaveBeenCalledWith(THREAD);
	});

	it('rejects unmanaged reply edits and thread deletes', async () => {
		const denied = handlers({
			store: {
				canManageThread: vi.fn(async () => false),
				canManageReply: vi.fn(async () => false)
			}
		});

		expect(
			(
				await denied.actions.edit(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'reply', targetId: REPLY, body: 'Nope' }
					})
				)
			).status
		).toBe(403);
		expect(
			(
				await denied.actions.delete(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'thread', targetId: THREAD }
					})
				)
			).status
		).toBe(403);
		expect(
			(await denied.actions.edit(event({ locals: { maritools: SESSION } }))).status
		).toBe(400);
	});

	it('returns bounded edit and delete errors', async () => {
		const invalid = handlers({
			store: {
				canManageThread: vi.fn(async () => true),
				updateThread: vi.fn(async () => {
					throw new MaritoolsInputError('invalid');
				})
			}
		});
		expect(
			(
				await invalid.actions.edit(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'thread', targetId: THREAD, body: 'Hi' }
					})
				)
			).status
		).toBe(400);
		const downEdit = handlers({
			store: {
				canManageThread: vi.fn(async () => true),
				updateThread: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(
				await downEdit.actions.edit(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'thread', targetId: THREAD, body: 'Hi' }
					})
				)
			).status
		).toBe(503);
		const boomEdit = handlers({
			store: {
				canManageReply: vi.fn(async () => true),
				updateReply: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			boomEdit.actions.edit(
				event({
					locals: { maritools: SESSION },
					form: { targetKind: 'reply', targetId: REPLY, body: 'Hi' }
				})
			)
		).rejects.toThrow('boom');
		expect(
			(
				await handlers().actions.edit(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'post', targetId: THREAD, body: 'Hi' }
					})
				)
			).status
		).toBe(400);
		const down = handlers({
			store: {
				canManageReply: vi.fn(async () => true),
				removeReply: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(
				await down.actions.delete(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'reply', targetId: REPLY }
					})
				)
			).status
		).toBe(503);
		expect((await handlers().actions.delete(event())).status).toBe(401);
		expect(
			(await handlers().actions.delete(event({ locals: { maritools: SESSION } }))).status
		).toBe(400);
		expect(
			(
				await handlers().actions.delete(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'post', targetId: THREAD }
					})
				)
			).status
		).toBe(400);
		const deniedDelete = handlers({
			store: { canManageReply: vi.fn(async () => false) }
		});
		expect(
			(
				await deniedDelete.actions.delete(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'reply', targetId: REPLY }
					})
				)
			).status
		).toBe(403);
		const invalidDelete = handlers({
			store: {
				canManageReply: vi.fn(async () => true),
				removeReply: vi.fn(async () => {
					throw new MaritoolsInputError('invalid');
				})
			}
		});
		expect(
			(
				await invalidDelete.actions.delete(
					event({
						locals: { maritools: SESSION },
						form: { targetKind: 'reply', targetId: REPLY }
					})
				)
			).status
		).toBe(400);
		const boomDelete = handlers({
			store: {
				canManageReply: vi.fn(async () => true),
				removeReply: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			boomDelete.actions.delete(
				event({
					locals: { maritools: SESSION },
					form: { targetKind: 'reply', targetId: REPLY }
				})
			)
		).rejects.toThrow('boom');
	});

	it('moderates as staff', async () => {
		const current = handlers();
		await expect(
			current.actions.moderate(event({ locals: { maritools: STAFF }, form: { moderation: 'lock' } }))
		).resolves.toEqual({ moderated: true });
		await expect(
			current.actions.moderate(
				event({ locals: { maritools: STAFF }, form: { moderation: 'remove-thread' } })
			)
		).rejects.toMatchObject({ status: 303, location: '/tools/forum' });
		await current.actions.moderate(
			event({
				locals: { maritools: STAFF },
				form: { moderation: 'remove-reply', replyId: REPLY }
			})
		);
		expect(
			(await current.actions.moderate(event({ locals: { maritools: STAFF }, form: { moderation: 'nope' } })))
				.status
		).toBe(400);
		expect(
			(
				await current.actions.moderate(
					event({ locals: { maritools: STAFF }, form: { moderation: 'remove-reply' } })
				)
			).status
		).toBe(400);
		expect((await current.actions.moderate(event())).status).toBe(403);
		expect(
			(await current.actions.moderate(event({ locals: { maritools: STAFF } }))).status
		).toBe(400);
		const viaRole = handlers({
			store: { getProfile: vi.fn(async () => ({ role: 'staff' })) }
		});
		await expect(
			viaRole.actions.moderate(event({ locals: { maritools: SESSION }, form: { moderation: 'lock' } }))
		).resolves.toEqual({ moderated: true });
		const noRole = handlers({
			store: { getProfile: vi.fn(async () => ({})) }
		});
		expect(
			(await noRole.actions.moderate(event({ locals: { maritools: SESSION }, form: { moderation: 'lock' } })))
				.status
		).toBe(403);
	});

	it('mutes and bans authors with bounded duration inputs', async () => {
		const current = handlers();

		await expect(
			current.actions.moderate(
				event({
					locals: { maritools: STAFF },
					form: { moderation: 'mute-author', authorUserId: SESSION.userId, mutePreset: '1h' }
				})
			)
		).resolves.toEqual({ moderated: true });
		expect(current.store.muteUser).toHaveBeenCalledWith(
			SESSION.userId,
			expect.objectContaining({ until: expect.any(Date) })
		);

		await expect(
			current.actions.moderate(
				event({
					locals: { maritools: STAFF },
					form: {
						moderation: 'ban-author',
						authorUserId: SESSION.userId,
						banPreset: 'permanent'
					}
				})
			)
		).resolves.toEqual({ moderated: true });
		expect(current.store.banUser).toHaveBeenCalledWith(SESSION.userId, { permanent: true });
		await expect(
			current.actions.moderate(
				event({
					locals: { maritools: STAFF },
					form: { moderation: 'ban-author', authorUserId: SESSION.userId, banPreset: '7d' }
				})
			)
		).resolves.toEqual({ moderated: true });
		expect(current.store.banUser).toHaveBeenLastCalledWith(
			SESSION.userId,
			expect.objectContaining({ until: expect.any(Date) })
		);

		for (const moderation of ['mute-author', 'ban-author']) {
			expect(
				(
					await current.actions.moderate(
						event({ locals: { maritools: STAFF }, form: { moderation } })
					)
				).status
			).toBe(400);
		}
	});

	it('returns bounded moderation errors', async () => {
		const down = handlers({
			store: {
				lockThread: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		expect(
			(await down.actions.moderate(event({ locals: { maritools: STAFF }, form: { moderation: 'lock' } })))
				.status
		).toBe(503);
		const boom = handlers({
			store: {
				lockThread: vi.fn(async () => {
					throw new Error('boom');
				})
			}
		});
		await expect(
			boom.actions.moderate(event({ locals: { maritools: STAFF }, form: { moderation: 'lock' } }))
		).rejects.toThrow('boom');
		const closed = handlers({
			createStore: vi.fn(() => {
				throw new MaritoolsUnavailableError();
			})
		});
		expect(
			(await closed.actions.moderate(event({ locals: { maritools: STAFF }, form: { moderation: 'lock' } })))
				.status
		).toBe(503);
	});

	it('keeps a locked thread read-only and still staff-checks if the profile store is down', async () => {
		const locked = handlers({
			store: { getThread: vi.fn(async () => ({ ...THREAD_ROW, lockedAt: new Date() })) }
		});
		const lockedData = await locked.load(event({ locals: { maritools: SESSION } }));
		expect(lockedData.canReply).toBe(false);
		const staffDown = handlers({
			store: {
				getProfile: vi.fn(async () => {
					throw new MaritoolsUnavailableError();
				})
			}
		});
		const data = await staffDown.load(event({ locals: { maritools: STAFF } }));
		expect(data.staff).toBe(true);
	});
});
