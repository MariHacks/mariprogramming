import { describe, expect, it } from 'vitest';
import { CatalogChoiceError, catalogChoiceLabel, parseCatalogChoice } from './catalog-choice.js';

const TEACHER_ID = '10000000-0000-4000-8000-000000000001';

describe('CatalogChoice parser', () => {
	it('parses an independent catalog arm with a snapshot label', () => {
		const choice = parseCatalogChoice({
			kind: 'catalog',
			id: TEACHER_ID,
			label: '  Mme Tremblay  '
		});
		expect(choice).toEqual({
			kind: 'catalog',
			id: TEACHER_ID,
			label: 'Mme Tremblay'
		});
		expect(Object.isFrozen(choice)).toBe(true);
	});

	it('parses an other arm without an identifier', () => {
		expect(
			parseCatalogChoice({ kind: 'other', label: 'Guest lecturer' }, { labelMaximum: 160 })
		).toEqual({ kind: 'other', label: 'Guest lecturer' });
	});

	it('treats a blank identifier as absent on the other arm', () => {
		expect(
			parseCatalogChoice({ kind: 'other', id: '', label: 'Self-directed' })
		).toEqual({ kind: 'other', label: 'Self-directed' });
	});

	it('returns the snapshot label for either arm', () => {
		expect(
			catalogChoiceLabel({ kind: 'catalog', id: TEACHER_ID, label: 'Ada Lovelace' })
		).toBe('Ada Lovelace');
		expect(catalogChoiceLabel({ kind: 'other', label: 'Other course' })).toBe('Other course');
	});

	it.each([
		['null', null],
		['array', []],
		['missing kind', { id: TEACHER_ID, label: 'Ada' }],
		['unknown kind', { kind: 'custom', label: 'Ada' }],
		['catalog without id', { kind: 'catalog', label: 'Ada' }],
		['catalog with blank id', { kind: 'catalog', id: '', label: 'Ada' }],
		['catalog with non-uuid', { kind: 'catalog', id: 'not-a-uuid', label: 'Ada' }],
		['other with id', { kind: 'other', id: TEACHER_ID, label: 'Ada' }],
		['blank label', { kind: 'other', label: '   ' }],
		['control characters', { kind: 'other', label: 'Ada\u0001Lovelace' }],
		['extra field', { kind: 'other', label: 'Ada', note: 'no' }]
	])('rejects %s', (_label, raw) => {
		expect(() => parseCatalogChoice(raw)).toThrow(CatalogChoiceError);
	});

	it('rejects a label longer than the field bound', () => {
		expect(() =>
			parseCatalogChoice({ kind: 'other', label: 'A'.repeat(201) })
		).toThrow(CatalogChoiceError);
	});
});
