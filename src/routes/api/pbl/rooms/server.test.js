// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { POST, _createPblCreateEndpoint } from './+server.js';

const SESSION = { maritools: { userId: 'user-lab-3', email: 'lab@marihacks.com' } };

describe('POST /api/pbl/rooms', () => {
	it('rejects create without a club session', async () => {
		const POST = _createPblCreateEndpoint({
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async () => {
				throw new Error('unused');
			}
		});
		const response = await POST({
			locals: { maritools: null },
			request: new Request('https://club.example/api/pbl/rooms', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ pblId: 'science', teamName: 'Lab table 3' })
			}),
			url: new URL('https://club.example/api/pbl/rooms')
		});
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({
			error: 'Sign in with your club Google account to create or join a team.'
		});
	});

	it('creates a room and sets the member cookie', async () => {
		const POST = _createPblCreateEndpoint({
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async (operation) =>
				operation({
					createRoom: async (input) => {
						expect(input.userId).toBe('user-lab-3');
						return { code: 'AB23JK', teamName: 'Lab table 3' };
					}
				}),
			createRepository: (transaction) => transaction,
			createStore: (repository) => repository
		});
		const response = await POST({
			locals: SESSION,
			request: new Request('https://club.example/api/pbl/rooms', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ pblId: 'science', teamName: 'Lab table 3' })
			}),
			url: new URL('https://club.example/api/pbl/rooms')
		});
		expect(response.status).toBe(201);
		expect(response.headers.get('set-cookie')).toContain('pbl_member=');
		expect(await response.json()).toEqual({ code: 'AB23JK', teamName: 'Lab table 3' });
	});

	it('reuses an existing member cookie', async () => {
		const POST = _createPblCreateEndpoint({
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async (operation) =>
				operation({
					createRoom: async () => ({ code: 'AB23JK' })
				}),
			createRepository: (transaction) => transaction,
			createStore: (repository) => repository
		});
		const response = await POST({
			locals: SESSION,
			request: new Request('https://club.example/api/pbl/rooms', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					cookie: 'pbl_member=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
				},
				body: JSON.stringify({ pblId: 'science', teamName: 'Lab table 3' })
			}),
			url: new URL('https://club.example/api/pbl/rooms')
		});
		expect(response.status).toBe(201);
		expect(response.headers.get('set-cookie')).toBeNull();
	});

	it('returns a JSON error for invalid input', async () => {
		const POST = _createPblCreateEndpoint({
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async () => {
				throw new Error('unused');
			}
		});
		const response = await POST({
			locals: SESSION,
			request: new Request('https://club.example/api/pbl/rooms', {
				method: 'POST',
				headers: { 'content-type': 'text/plain' },
				body: 'nope'
			}),
			url: new URL('https://club.example/api/pbl/rooms')
		});
		expect(response.status).toBe(400);
	});

	it('exports the live handler', () => {
		expect(typeof POST).toBe('function');
	});
});
