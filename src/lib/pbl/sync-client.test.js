import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoomSync } from './sync-client.js';

describe('room sync client', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('uses default poll timing when omitted', async () => {
		const sync = createRoomSync({
			code: 'AB23JK',
			onState: () => {},
			fetch: async () => new Response('{}', { status: 404 })
		});
		expect(await sync.join()).toBeNull();
		sync.start();
		sync.update({ source: 'x' });
		await sync.flush();
		sync.stop();
		await sync.flush();
	});

	it('joins, polls, and pushes local edits with last-write-wins versions', async () => {
		vi.useFakeTimers();
		/** @type {any[]} */
		const states = [];
		/** @type {string[]} */
		const errors = [];
		/** @type {Array<{ url: string, init?: RequestInit }>} */
		const calls = [];
		let version = 1;
		const sync = createRoomSync({
			code: 'AB23JK',
			pollMs: 1000,
			pushMs: 400,
			onState: (state) => states.push(state),
			onError: (message) => errors.push(message),
			fetch: async (url, init) => {
				calls.push({ url: String(url), init });
				const method = init?.method ?? 'GET';
				if (String(url).endsWith('/join')) {
					return new Response(JSON.stringify({ code: 'AB23JK', source: 'print(1)', version: 1 }));
				}
				if (method === 'PUT') {
					version += 1;
					const body = JSON.parse(String(init?.body ?? '{}'));
					return new Response(JSON.stringify({ ...body, version }));
				}
				return new Response(JSON.stringify({ code: 'AB23JK', source: 'print(2)', version }));
			}
		});

		const joined = await sync.join();
		expect(joined.version).toBe(1);
		sync.start();
		await Promise.resolve();
		sync.update({ source: 'print("team")' });
		await vi.advanceTimersByTimeAsync(400);
		await Promise.resolve();
		expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true);
		await vi.advanceTimersByTimeAsync(1000);
		sync.stop();
		expect(states.at(-1)?.source).toBeDefined();
		expect(errors).toEqual([]);
	});

	it('reports HTTP errors without throwing', async () => {
		const errors = [];
		const sync = createRoomSync({
			code: 'NOPE01',
			onState: () => {},
			onError: (message) => errors.push(message),
			fetch: async () => new Response(JSON.stringify({ error: 'Room not found.' }), { status: 404 })
		});
		expect(await sync.join()).toBeNull();
		expect(errors).toEqual(['Room not found.']);
		await sync.pull();
		expect(errors).toHaveLength(2);
		const unlabeled = createRoomSync({
			code: 'NOPE01',
			onState: () => {},
			onError: (message) => errors.push(message),
			fetch: async () => new Response('{}', { status: 503 })
		});
		expect(await unlabeled.join()).toBeNull();
		expect(errors.at(-1)).toBe('The team room is unavailable.');
		const flusher = createRoomSync({
			code: 'AB23JK',
			onState: () => {},
			onError: () => {},
			fetch: async (url, init) => {
				if ((init?.method ?? 'GET') === 'PUT') {
					return new Response(JSON.stringify({ conflict: true }), { status: 200 });
				}
				if (String(url).endsWith('/join')) {
					return new Response(JSON.stringify({ code: 'AB23JK' }));
				}
				return new Response('{}', { status: 404 });
			}
		});
		await flusher.join();
		flusher.update({ source: 'x' });
		await flusher.flush();
		flusher.stop();
		await flusher.pull();
	});

	it('retries a conflicted PUT with the local source and the server version', async () => {
		const states = [];
		const errors = [];
		/** @type {any[]} */
		const bodies = [];
		const sync = createRoomSync({
			code: 'AB23JK',
			onState: (state) => states.push(state),
			onError: (message) => errors.push(message),
			fetch: async (url, init) => {
				if ((init?.method ?? 'GET') === 'PUT') {
					const body = JSON.parse(String(init?.body ?? '{}'));
					bodies.push(body);
					if (bodies.length === 1) {
						return new Response(
							JSON.stringify({
								error: 'The room changed on another device.',
								conflict: true,
								room: { code: 'AB23JK', source: 'from-b', version: 4 }
							}),
							{ status: 409 }
						);
					}
					return new Response(JSON.stringify({ ...body, version: body.version + 1 }));
				}
				return new Response(JSON.stringify({ code: 'AB23JK', source: 'from-a', version: 3 }));
			}
		});
		await sync.join();
		sync.update({ source: 'from-a-edit' });
		await sync.flush();
		expect(bodies).toHaveLength(2);
		expect(bodies[0].version).toBe(3);
		expect(bodies[1]).toMatchObject({ version: 4, source: 'from-a-edit' });
		expect(states.at(-1)?.source).toBe('from-a-edit');
		expect(states.at(-1)?.version).toBe(5);
		expect(errors).toEqual([]);
		sync.stop();
	});

	it('reports PUT failures, retries a conflict with no version, and cancels a pending push', async () => {
		const errors = [];
		const denied = createRoomSync({
			code: 'AB23JK',
			onState: () => {},
			onError: (message) => errors.push(message),
			fetch: async (url, init) => {
				if ((init?.method ?? 'GET') === 'PUT') {
					return new Response(JSON.stringify({ error: 'Join this team before editing.' }), {
						status: 403
					});
				}
				return new Response(JSON.stringify({ code: 'AB23JK', version: 1 }));
			}
		});
		await denied.join();
		denied.update({ source: 'x' });
		await denied.flush();
		expect(errors).toEqual(['Join this team before editing.']);
		denied.stop();

		const quiet = createRoomSync({
			code: 'AB23JK',
			onState: () => {},
			fetch: async (url, init) => {
				if ((init?.method ?? 'GET') === 'PUT') {
					return new Response('{}', { status: 500 });
				}
				return new Response(JSON.stringify({ code: 'AB23JK', version: 1 }));
			}
		});
		await quiet.join();
		quiet.update({ source: 'x' });
		await quiet.flush();
		quiet.stop();

		const bodies = [];
		const unversioned = createRoomSync({
			code: 'AB23JK',
			onState: () => {},
			fetch: async (url, init) => {
				if ((init?.method ?? 'GET') === 'PUT') {
					const body = JSON.parse(String(init?.body ?? '{}'));
					bodies.push(body);
					if (bodies.length === 1) {
						return new Response(
							JSON.stringify({
								conflict: true,
								room: { code: 'AB23JK', source: 'server', version: 0 }
							}),
							{ status: 409 }
						);
					}
					return new Response(JSON.stringify({ ...body, version: 2 }));
				}
				return new Response(JSON.stringify({ code: 'AB23JK', source: 'local', version: 1 }));
			}
		});
		await unversioned.join();
		unversioned.update({ source: 'local-edit' });
		await unversioned.flush();
		expect(bodies[1]?.source).toBe('local-edit');
		unversioned.stop();

		const pending = createRoomSync({
			code: 'AB23JK',
			onState: () => {},
			fetch: async () => new Response(JSON.stringify({ code: 'AB23JK', version: 1 }))
		});
		await pending.join();
		pending.update({ source: 'queued' });
		pending.stop();
	});

	it('keeps local typing when a poll returns a newer room', async () => {
		vi.useFakeTimers();
		/** @type {any[]} */
		const states = [];
		let getCount = 0;
		const sync = createRoomSync({
			code: 'AB23JK',
			pollMs: 50,
			pushMs: 5000,
			onState: (state) => states.push(state),
			fetch: async (url, init) => {
				if ((init?.method ?? 'GET') === 'PUT') {
					return new Response(JSON.stringify({ conflict: true, room: { source: 'remote', version: 9 } }));
				}
				getCount += 1;
				return new Response(JSON.stringify({ source: `remote-${getCount}`, version: getCount }));
			}
		});
		sync.start();
		await Promise.resolve();
		sync.update({ source: 'local' });
		sync.update({ source: 'local-2' });
		await vi.advanceTimersByTimeAsync(50);
		await Promise.resolve();
		expect(states.at(-1)?.source).toBe('local-2');
		await sync.flush();
		expect(states.at(-1)?.source).toBe('remote');
		sync.stop();
		await sync.flush();
		await sync.pull();
	});
});
