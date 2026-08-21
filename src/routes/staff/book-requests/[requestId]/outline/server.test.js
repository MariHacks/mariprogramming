// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	BookWorkNotFoundError,
	BookWorkValidationError
} from '$lib/server/books/work-repository.js';
import { _createBookRequestOutlineHandler } from './+server.js';

const STAFF = Object.freeze({ userId: 'staff-user', email: 'team@marihacks.com' });
const REQUEST_ID = '10000000-0000-4000-8000-000000000001';
const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

function handler(overrides = {}) {
	const repository = {
		readOutline: vi.fn(async () => ({
			descriptor: { filename: 'outline.pdf', byteLength: BYTES.byteLength, sha256: 'abc' },
			bytes: BYTES
		})),
		...overrides.repository
	};
	return {
		GET: _createBookRequestOutlineHandler({
			authorize: vi.fn(() => STAFF),
			readEnvironment: vi.fn(() => ({ databaseUrl: 'postgresql://staff@db/books' })),
			createRepository: vi.fn(() => repository),
			...overrides
		}),
		repository
	};
}

describe('staff book request outline download', () => {
	it('returns the stored PDF as a private attachment', async () => {
		const current = handler();
		const response = await current.GET({
			locals: { staff: STAFF },
			params: { requestId: REQUEST_ID }
		});
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/pdf');
		expect(response.headers.get('content-disposition')).toBe('attachment; filename="outline.pdf"');
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
		expect(current.repository.readOutline).toHaveBeenCalledWith(REQUEST_ID);
	});

	it('sanitizes quotes and line breaks in the stored filename', async () => {
		const current = handler({
			repository: {
				readOutline: vi.fn(async () => ({
					descriptor: {
						filename: 'course "outline"\n.pdf',
						byteLength: BYTES.byteLength,
						sha256: 'abc'
					},
					bytes: BYTES
				}))
			}
		});
		const response = await current.GET({
			locals: { staff: STAFF },
			params: { requestId: REQUEST_ID }
		});
		expect(response.headers.get('content-disposition')).toBe(
			'attachment; filename="course _outline__.pdf"'
		);
	});

	it.each([new BookWorkNotFoundError(), new BookWorkValidationError()])(
		'returns 404 when the outline cannot be read: %s',
		async (error) => {
			const current = handler({
				repository: {
					readOutline: vi.fn(async () => {
						throw error;
					})
				}
			});
			await expect(
				current.GET({ locals: { staff: STAFF }, params: { requestId: REQUEST_ID } })
			).rejects.toMatchObject({ status: 404 });
		}
	);

	it('propagates unexpected repository failures', async () => {
		const current = handler({
			repository: {
				readOutline: vi.fn(async () => {
					throw new Error('database exploded');
				})
			}
		});
		await expect(
			current.GET({ locals: { staff: STAFF }, params: { requestId: 'bad' } })
		).rejects.toThrow('database exploded');
	});
});
