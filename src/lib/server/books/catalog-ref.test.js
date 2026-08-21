// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { CatalogRefError, catalogRefColumns, parseCatalogRef } from './catalog-ref.js';

const ID = '10000000-0000-4000-8000-000000000001';

describe('catalogue references', () => {
	it('parses catalogue and Other choices independently', () => {
		expect(parseCatalogRef({ selection: ID, freeText: 'stale' }, 'teacher')).toEqual({
			source: 'catalog',
			id: ID
		});
		expect(parseCatalogRef({ selection: '', freeText: 'Independent study' }, 'course')).toEqual({
			source: 'other',
			name: 'Independent study'
		});
		expect(parseCatalogRef({ selection: 'other', freeText: 'Mme. Nadeau' }, 'course')).toEqual({
			source: 'other',
			name: 'Mme. Nadeau'
		});
	});

	it.each([
		[{ selection: '', freeText: '' }, 'teacher'],
		[{ selection: 'other', freeText: '' }, 'course'],
		[{ selection: 'not-a-uuid', freeText: 'name' }, 'teacher'],
		[{ selection: 'other', freeText: 'x'.repeat(201) }, 'course'],
		[{ selection: 'other', freeText: 'line\nbreak' }, 'teacher'],
		[null, 'teacher'],
		[{ selection: 12, freeText: 'name' }, 'course']
	])('rejects an invalid reference %#', (input, field) => {
		expect(() => parseCatalogRef(input, field)).toThrow(CatalogRefError);
	});

	it('rejects an unsupported field name', () => {
		expect(() =>
			parseCatalogRef({ selection: 'other', freeText: 'Guest' }, /** @type {any} */ ('book'))
		).toThrow(CatalogRefError);
		expect(() => parseCatalogRef({ selection: 'other', freeText: 12 }, 'teacher')).toThrow(
			CatalogRefError
		);
	});

	it('serializes the discriminated union to exclusive columns', () => {
		expect(catalogRefColumns({ source: 'catalog', id: ID })).toEqual({ id: ID, name: null });
		expect(catalogRefColumns({ source: 'other', name: 'Independent study' })).toEqual({
			id: null,
			name: 'Independent study'
		});
	});
});
