const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** @typedef {{ source: 'catalog', id: string } | { source: 'other', name: string }} CatalogRef */

export class CatalogRefError extends Error {
	/** @param {'teacher' | 'course'} field */
	constructor(field) {
		super('Catalogue reference is invalid');
		this.name = 'CatalogRefError';
		this.code = 'CATALOG_REF_INVALID';
		this.field = field;
	}
}

/**
 * @param {{ selection: unknown, freeText: unknown }} input
 * @param {'teacher' | 'course'} field
 * @returns {Readonly<CatalogRef>}
 */
export function parseCatalogRef(input, field) {
	if (
		!['teacher', 'course'].includes(field) ||
		input === null ||
		typeof input !== 'object' ||
		typeof input.selection !== 'string'
	) {
		throw new CatalogRefError(field);
	}
	if (input.selection !== 'other' && input.selection !== '') {
		if (!UUID_PATTERN.test(input.selection)) throw new CatalogRefError(field);
		return Object.freeze({ source: 'catalog', id: input.selection });
	}
	if (typeof input.freeText !== 'string') throw new CatalogRefError(field);
	const name = input.freeText.trim();
	const maximum = field === 'teacher' ? 160 : 200;
	if (!name || name.length > maximum || /[\0\r\n]/u.test(name)) throw new CatalogRefError(field);
	return Object.freeze({ source: 'other', name });
}

/**
 * @param {CatalogRef} ref
 * @returns {{ id: string | null, name: string | null }}
 */
export function catalogRefColumns(ref) {
	return ref.source === 'catalog' ? { id: ref.id, name: null } : { id: null, name: ref.name };
}
