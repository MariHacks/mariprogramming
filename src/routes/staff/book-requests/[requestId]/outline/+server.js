// @ts-nocheck
import { error } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/auth/authorization.js';
import { readStaffCatalogueEnvironment } from '$lib/server/config/environment.js';
import {
	BookWorkNotFoundError,
	BookWorkValidationError,
	createBookWorkRepository
} from '$lib/server/books/work-repository.js';

/**
 * @param {Record<string, any>} [dependencies]
 */
export function _createBookRequestOutlineHandler(dependencies = {}) {
	const authorize = dependencies.authorize ?? requireStaff;
	const readEnvironment = dependencies.readEnvironment ?? readStaffCatalogueEnvironment;
	const createRepository = dependencies.createRepository ?? createBookWorkRepository;

	return async function GET({ locals, params }) {
		authorize(locals);
		try {
			const runtime = readEnvironment();
			const outline = await createRepository({
				databaseUrl: runtime.databaseUrl
			}).readOutline(params.requestId);
			const filename = outline.descriptor.filename.replaceAll(/["\\\r\n]/gu, '_');
			return new Response(outline.bytes, {
				headers: {
					'cache-control': 'private, no-store',
					'content-disposition': `attachment; filename="${filename}"`,
					'content-length': String(outline.descriptor.byteLength),
					'content-type': 'application/pdf',
					'x-content-type-options': 'nosniff'
				}
			});
		} catch (failure) {
			if (failure instanceof BookWorkNotFoundError || failure instanceof BookWorkValidationError) {
				error(404, 'Outline not found');
			}
			throw failure;
		}
	};
}

export const GET = _createBookRequestOutlineHandler();
