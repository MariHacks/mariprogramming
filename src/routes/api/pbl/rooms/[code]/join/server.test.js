// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { POST, _createPblJoinEndpoint } from './+server.js';

const SESSION = { maritools: { userId: 'user-lab-3', email: 'lab@marihacks.com' } };

describe('POST /api/pbl/rooms/[code]/join', () => {
	it('rejects join without a club session', async () => {
		const POST = _createPblJoinEndpoint({
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async () => {
				throw new Error('unused');
			}
		});
		const response = await POST({
			locals: { maritools: null },
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK/join', { method: 'POST' }),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK/join')
		});
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({
			error: 'Sign in with your club Google account to create or join a team.'
		});
	});

	it('joins an existing room', async () => {
		const POST = _createPblJoinEndpoint({
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async (operation) =>
				operation({
					joinRoom: async ({ code, userId }) => {
						expect(userId).toBe('user-lab-3');
						return { code, memberCount: 2 };
					}
				}),
			createRepository: (transaction) => transaction,
			createStore: (repository) => repository
		});
		const response = await POST({
			locals: SESSION,
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK/join', { method: 'POST' }),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK/join')
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ code: 'AB23JK', memberCount: 2 });
	});

	it('sets a member cookie when joining without one', async () => {
		const POST = _createPblJoinEndpoint({
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async (operation) =>
				operation({
					joinRoom: async ({ code }) => ({ code, memberCount: 2 })
				}),
			createRepository: (transaction) => transaction,
			createStore: (repository) => repository
		});
		const response = await POST({
			locals: SESSION,
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK/join', {
				method: 'POST'
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK/join')
		});
		expect(response.headers.get('set-cookie')).toContain('pbl_member=');
	});

	it('maps join failures', async () => {
		const POST = _createPblJoinEndpoint({
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			ensureSchema: vi.fn(async () => {
				throw new Error('down');
			})
		});
		const response = await POST({
			locals: SESSION,
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK/join', { method: 'POST' }),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK/join')
		});
		expect(response.status).toBe(503);
	});

	it('exports the live handler', () => {
		expect(typeof POST).toBe('function');
	});
});
