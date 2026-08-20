const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/**
 * @typedef {{ kind: 'catalog', id: string, label: string }
 *   | { kind: 'other', label: string }} CatalogChoice
 */

export class CatalogChoiceError extends Error {
	constructor() {
		super('Catalogue choice is invalid');
		this.name = 'CatalogChoiceError';
		this.code = 'CATALOG_CHOICE_INVALID';
	}
}

/** @returns {never} */
function invalid() {
	throw new CatalogChoiceError();
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {number} maximum
 */
function boundedLabel(value, maximum) {
	if (typeof value !== 'string' || value.length === 0 || value.length > maximum) invalid();
	const label = value.trim().replace(/\s+/gu, ' ');
	if (!label || label.length > maximum || /\p{Cc}/u.test(label)) invalid();
	return label;
}

/**
 * Parses one independent teacher or course choice. Catalog and other arms cannot mix.
 *
 * @param {unknown} raw
 * @param {{ labelMaximum?: number }} [options]
 * @returns {Readonly<CatalogChoice>}
 */
export function parseCatalogChoice(raw, { labelMaximum = 200 } = {}) {
	if (!isPlainObject(raw)) invalid();
	const keys = Object.keys(raw).sort();
	if (keys.join(',') !== 'id,kind,label' && keys.join(',') !== 'kind,label') invalid();
	const kind = raw.kind;
	const id = raw.id;
	if (kind === 'catalog') {
		if (typeof id !== 'string' || !UUID_PATTERN.test(id)) invalid();
		return Object.freeze({
			kind: 'catalog',
			id,
			label: boundedLabel(raw.label, labelMaximum)
		});
	}
	if (kind === 'other') {
		if (id !== undefined && id !== null && id !== '') invalid();
		return Object.freeze({ kind: 'other', label: boundedLabel(raw.label, labelMaximum) });
	}
	return invalid();
}

/**
 * @param {unknown} choice
 * @returns {string}
 */
export function catalogChoiceLabel(choice) {
	const parsed = parseCatalogChoice(choice);
	return parsed.label;
}
