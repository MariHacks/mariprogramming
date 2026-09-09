// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { PblConflictError, PblFullError, PblInputError, PblNotFoundError } from './store.js';
import { _resetSharedMemoryPblRepository } from './store.js';
import {
	createPblRuntime,
	memberFromRequest,
	pblErrorResponse,
	pblJson,
	readPblJson
} from './http.js';

const ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('PBL HTTP helpers', () => {
	it('maps domain errors to JSON status codes', async () => {
		expect(await pblErrorResponse(new PblInputError('Enter a team name.')).json()).toEqual({
			error: 'Enter a team name.'
		});
		expect(pblErrorResponse(new PblNotFoundError()).status).toBe(404);
		expect(pblErrorResponse(new PblFullError()).status).toBe(403);
		const conflict = pblErrorResponse(new PblConflictError({ code: 'AB23JK', version: 2 }));
		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toMatchObject({ conflict: true });
		expect(pblErrorResponse(new Error('db')).status).toBe(503);
		expect((await pblJson({ ok: true }).json()).ok).toBe(true);
	});

	it('reads a bounded JSON object', async () => {
		const ok = new Request('https://club.example/api/pbl/rooms', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'content-length': '20' },
			body: '{"teamName":"Lab"}'
		});
		expect(await readPblJson(ok)).toEqual({ teamName: 'Lab' });
		await expect(
			readPblJson(
				new Request('https://club.example/api/pbl/rooms', {
					method: 'POST',
					headers: { 'content-type': 'text/plain' },
					body: 'x'
				})
			)
		).rejects.toBeInstanceOf(PblInputError);
		await expect(
			readPblJson(
				new Request('https://club.example/api/pbl/rooms', {
					method: 'POST',
					headers: { 'content-type': 'application/json', 'content-length': 'nope' },
					body: '{}'
				})
			)
		).rejects.toMatchObject({ status: 413 });
		await expect(
			readPblJson(
				new Request('https://club.example/api/pbl/rooms', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: '[1]'
				})
			)
		).rejects.toBeInstanceOf(PblInputError);
		await expect(
			readPblJson(
				new Request('https://club.example/api/pbl/rooms', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: '{bad'
				})
			)
		).rejects.toBeInstanceOf(PblInputError);
		await expect(
			readPblJson(
				/** @type {any} */ ({
					headers: { get: () => null },
					text: async () => '{}'
				})
			)
		).rejects.toBeInstanceOf(PblInputError);
		await expect(
			readPblJson(
				new Request('https://club.example/api/pbl/rooms', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: `{"x":"${'a'.repeat(120001)}"}`
				})
			)
		).rejects.toMatchObject({ status: 413 });
		await expect(
			readPblJson(
				new Request('https://club.example/api/pbl/rooms', {
					method: 'POST',
					headers: { 'content-type': 'application/json', 'content-length': '120001' },
					body: '{}'
				})
			)
		).rejects.toMatchObject({ status: 413 });
	});

	it('reuses or mints a member cookie', () => {
		const existing = memberFromRequest(
			new Request('https://club.example/api/pbl/rooms', {
				headers: { cookie: 'pbl_member=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
			}),
			{ url: new URL('https://club.example/api/pbl/rooms') }
		);
		expect(existing.memberId).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
		expect(existing.setCookie).toBeNull();
		const minted = memberFromRequest(new Request('http://127.0.0.1/api/pbl/rooms'), {
			url: new URL('http://127.0.0.1/api/pbl/rooms')
		});
		expect(minted.memberId).toMatch(/^[0-9a-f]{32}$/u);
		expect(minted.setCookie).toContain('HttpOnly');
		expect(minted.setCookie).not.toContain('Secure');
		const secure = memberFromRequest(new Request('https://club.example/api/pbl/rooms'), {
			url: new URL('https://club.example/api/pbl/rooms')
		});
		expect(secure.setCookie).toContain('Secure');
		const known = memberFromRequest(
			new Request('https://club.example/api/pbl/rooms'),
			{},
			{ memberId: ID }
		);
		expect(known).toEqual({ memberId: ID, setCookie: null });
		const noUrl = memberFromRequest(new Request('https://club.example/api/pbl/rooms'), {});
		expect(noUrl.setCookie).not.toContain('Secure');
	});

	it('opens a store inside a database transaction after schema ensure', async () => {
		const store = { ping: 'ok' };
		const runtime = createPblRuntime({
			ensureSchema: vi.fn(async () => undefined),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async (operation) => operation({}),
			createRepository: () => ({}),
			createStore: () => store
		});
		expect(await runtime.withStore(async (current) => current)).toBe(store);
	});

	it('still opens a store when schema ensure fails', async () => {
		const store = { ping: 'ok' };
		const runtime = createPblRuntime({
			ensureSchema: vi.fn(async () => {
				throw new Error('cannot create');
			}),
			readEnvironment: () => ({ databaseUrl: 'postgresql://u:p@localhost/db' }),
			withTransaction: async (operation) => operation({}),
			createRepository: () => ({}),
			createStore: () => store
		});
		expect(await runtime.withStore(async (current) => current)).toBe(store);
	});

	it('uses process memory when the database is not configured', async () => {
		_resetSharedMemoryPblRepository();
		const runtime = createPblRuntime({
			readEnvironment: () => {
				throw new Error('no database');
			}
		});
		const room = await runtime.withStore((store) =>
			store.createRoom({ pblId: 'science', teamName: 'Preview lab', memberId: ID })
		);
		expect(room.teamName).toBe('Preview lab');
		expect(room.joinable).toBe(true);
	});
});
