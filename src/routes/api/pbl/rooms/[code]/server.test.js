// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { GET, PUT, _createPblRoomEndpoint } from './+server.js';

const MEMBER = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SESSION = { maritools: { userId: 'user-lab-3', email: 'lab@marihacks.com' } };

function runtime(store) {
	return _createPblRoomEndpoint({
		ensureSchema: vi.fn(async () => undefined),
		readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
		withTransaction: async (operation) => operation(store),
		createRepository: (transaction) => transaction,
		createStore: (repository) => repository
	});
}

describe('PBL room poll and push', () => {
	it('returns the current room', async () => {
		const { GET } = runtime({
			getRoom: async (code) => ({ code, source: 'print(1)', version: 2 })
		});
		const response = await GET({
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK'),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK')
		});
		expect(await response.json()).toMatchObject({ code: 'AB23JK', version: 2 });
	});

	it('maps a missing room to 404', async () => {
		const { PblNotFoundError } = await import('$lib/server/pbl/store.js');
		const { GET } = runtime({
			getRoom: async () => {
				throw new PblNotFoundError();
			}
		});
		const response = await GET({
			params: { code: 'NOPE01' },
			request: new Request('https://club.example/api/pbl/rooms/NOPE01'),
			url: new URL('https://club.example/api/pbl/rooms/NOPE01')
		});
		expect(response.status).toBe(404);
	});

	it('rebinds pbl_member on GET when the store returns a canonical memberId', async () => {
		const canonical = 'cccccccccccccccccccccccccccccccc';
		const stale = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
		const getRoom = vi.fn(async (_code, viewer, userId) => {
			expect(viewer).toBe(stale);
			expect(userId).toBe('user-lab-3');
			return { code: 'AB23JK', version: 2, memberId: canonical, members: [] };
		});
		const { GET } = runtime({ getRoom });
		const response = await GET({
			locals: SESSION,
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK', {
				headers: { cookie: `pbl_member=${stale}` }
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK')
		});
		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain(`pbl_member=${canonical}`);
		expect(getRoom).toHaveBeenCalledWith('AB23JK', stale, 'user-lab-3');
	});

	it('maps a true removal on GET to 403 without Set-Cookie', async () => {
		const { PblInputError } = await import('$lib/server/pbl/store.js');
		const { GET } = runtime({
			getRoom: async () => {
				throw new PblInputError('You were removed from this team.', 403);
			}
		});
		const response = await GET({
			locals: SESSION,
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK', {
				headers: { cookie: `pbl_member=${MEMBER}` }
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK')
		});
		expect(response.status).toBe(403);
		expect(response.headers.get('set-cookie')).toBeNull();
		expect(await response.json()).toMatchObject({ error: /removed from this team/i });
	});

	it('rejects updates without a club session', async () => {
		const { PUT } = runtime({
			updateRoom: async () => {
				throw new Error('unused');
			}
		});
		const response = await PUT({
			locals: { maritools: null },
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK', {
				method: 'PUT',
				headers: {
					'content-type': 'application/json',
					cookie: `pbl_member=${MEMBER}`
				},
				body: JSON.stringify({ version: 2, source: 'print("team")' })
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK')
		});
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({
			error: 'Sign in with your club Google account to create or join a team.'
		});
	});

	it('updates a joined member and maps failures', async () => {
		const { PUT } = runtime({
			updateRoom: async (input) => ({ code: input.code, source: input.source, version: 3 })
		});
		const response = await PUT({
			locals: SESSION,
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK', {
				method: 'PUT',
				headers: {
					'content-type': 'application/json',
					cookie: `pbl_member=${MEMBER}`
				},
				body: JSON.stringify({ version: 2, source: 'print("team")', takeDriver: true })
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK')
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ version: 3 });

		const minted = await PUT({
			locals: SESSION,
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ version: 2, source: 'print("team")' })
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK')
		});
		expect(minted.headers.get('set-cookie')).toContain('pbl_member=');

		const missing = await PUT({
			locals: SESSION,
			params: { code: 'AB23JK' },
			request: new Request('https://club.example/api/pbl/rooms/AB23JK', {
				method: 'PUT',
				headers: { 'content-type': 'text/plain' },
				body: 'x'
			}),
			url: new URL('https://club.example/api/pbl/rooms/AB23JK')
		});
		expect(missing.status).toBe(400);
	});

	it('exports live handlers', () => {
		expect(typeof GET).toBe('function');
		expect(typeof PUT).toBe('function');
	});
});
