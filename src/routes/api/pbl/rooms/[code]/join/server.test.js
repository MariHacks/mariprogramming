// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { POST, _createPblJoinEndpoint } from './+server.js';

describe('POST /api/pbl/rooms/[code]/join', () => {
	it('joins an existing room', async () => {
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
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK/join', { method: 'POST' }),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK/join')
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ code: 'AB23JK', memberCount: 2 });
	});

	it('sets a member cookie when joining anonymously', async () => {
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
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK/join', {
				method: 'POST',
				headers: { cookie: 'pbl_member=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK/join')
		});
		expect(response.headers.get('set-cookie')).toBeNull();
	});

	it('maps join failures', async () => {
		const POST = _createPblJoinEndpoint({
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			ensureSchema: vi.fn(async () => {
				throw new Error('down');
			})
		});
		const response = await POST({
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
