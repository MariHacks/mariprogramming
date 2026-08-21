import { describe, expect, it } from 'vitest';
import {
	MIOS_CATALOGUE_BOOKSTORES,
	MIOS_CATALOGUE_CONTACT,
	MIOS_CATALOGUE_ENTRIES,
	MIOS_CATALOGUE_FIELDS,
	MIOS_CATALOGUE_NOTICES,
	MIOS_CATALOGUE_SKIPPED,
	MIOS_CATALOGUE_SOURCE,
	miosEntryFormValues,
	miosEntryKey
} from './mios-catalogue.js';

describe('Mios 2026-08-20 catalogue snapshot', () => {
	it('exposes the form fields and MariHacks contact without extra commerce fields', () => {
		expect(MIOS_CATALOGUE_FIELDS).toEqual([
			'courseCode',
			'section',
			'title',
			'instructor',
			'author',
			'bookTitle',
			'edition',
			'isbn',
			'bookstore',
			'notes',
			'sourceDate'
		]);
		expect(MIOS_CATALOGUE_CONTACT).toEqual({
			email: 'team@marihacks.com',
			instagram: '@marihacks'
		});
		expect(MIOS_CATALOGUE_SOURCE).toEqual({
			teacher: 'Mios',
			date: '2026-08-20',
			updatedAt: '2026-08-20T19:09:00-04:00',
			updatedAtLabel: '19:09 America/Toronto'
		});
		expect(MIOS_CATALOGUE_CONTACT.email).toBe('team@marihacks.com');
		expect(miosEntryFormValues(MIOS_CATALOGUE_ENTRIES[0])).toEqual({
			courseCode: '603-101-MQ',
			section: '01',
			title: 'Composition and Literature: Intro to College English',
			instructor: 'Philip Dann',
			author: 'Sayaka Murata',
			bookTitle: 'Convenience Store Woman',
			edition: '',
			isbn: '978-0-8021-2962-8',
			bookstore: "The Book Stop (Follett's), Concordia Loyola, 7141 Sherbrooke W, CJ1 422",
			notes: '',
			sourceDate: '2026-08-20'
		});
		expect(miosEntryFormValues(MIOS_CATALOGUE_ENTRIES[0])).not.toHaveProperty('priceCents');
		expect(MIOS_CATALOGUE_BOOKSTORES.map((store) => store.name)).toEqual([
			"The Book Stop (Follett's), Concordia Loyola",
			'Renaud Bray; Multimags',
			'Zone libre',
			'Librairie Le Port de tête'
		]);
		expect(MIOS_CATALOGUE_NOTICES.some((notice) => notice.includes('Petruzziello'))).toBe(true);
	});

	it('keeps every in-catalog row and omits course packs', () => {
		expect(MIOS_CATALOGUE_ENTRIES).toHaveLength(29);
		expect(new Set(MIOS_CATALOGUE_ENTRIES.map(miosEntryKey)).size).toBe(29);
		expect(
			MIOS_CATALOGUE_SKIPPED.map((row) => `${row.instructor} ${row.courseCode} ${row.section}`)
		).toEqual([
			'Newell 603-101-MQ 24',
			'Newell 603-103-MQ 20',
			'Boudreau 603-101-MQ 28',
			'Fitz-James 603-101-MQ 71',
			'Burton 603-101-MQ 06',
			'Natalie Huffels Eastman 2026 pack'
		]);
		expect(MIOS_CATALOGUE_SKIPPED.every((row) => row.outOfCatalog === true)).toBe(true);
	});

	it('does not invent ISBNs, store prices, editions, or bookstores', () => {
		const dannWoman = MIOS_CATALOGUE_ENTRIES.find(
			(row) => row.bookTitle === 'Convenience Store Woman'
		);
		const morrisMacbeth = MIOS_CATALOGUE_ENTRIES.find((row) => row.bookTitle === 'Macbeth');
		const tessaUf2 = MIOS_CATALOGUE_ENTRIES.filter(
			(row) => row.instructor === 'Tessa Morin Cabana' && row.courseCode === '602-UF2-MQ'
		);
		const gasse = MIOS_CATALOGUE_ENTRIES.find(
			(row) => row.bookTitle === "Le Chef-d'oeuvre inconnu"
		);
		const phaneuf = MIOS_CATALOGUE_ENTRIES.filter(
			(row) => row.instructor === 'Xavier Phaneuf-Jolicoeur'
		);
		const sylvain = MIOS_CATALOGUE_ENTRIES.filter((row) => row.instructor === 'Laurence Sylvain');
		const sylvainGuide = sylvain.find((row) => row.bookTitle.includes('dissertation'));

		expect(dannWoman?.isbn).toBe('978-0-8021-2962-8');
		expect(morrisMacbeth).toMatchObject({
			isbn: '',
			edition: '',
			title: '(title not in Mio)',
			notes: 'class Mio; no edition/ISBN'
		});
		expect(tessaUf2.every((row) => row.bookstore === '' && row.isbn === '')).toBe(true);
		expect(gasse?.priceCents).toBeNull();
		expect(gasse?.notes).toBe('syllabus price');
		expect(phaneuf.every((row) => row.priceCents === null)).toBe(true);
		expect(sylvain.map((row) => row.priceCents)).toEqual([2547, 1607, 2169, 1318, 1092]);
		expect(sylvainGuide?.bookstore).toBe('');
		expect(Object.isFrozen(MIOS_CATALOGUE_ENTRIES)).toBe(true);
		expect(Object.isFrozen(MIOS_CATALOGUE_ENTRIES[0])).toBe(true);
	});

	it('accepts later rows without changing the form contract', () => {
		const extra = {
			courseCode: '602-UF2-MQ',
			section: '14',
			title: "Comparaison d'oeuvres littéraires",
			instructor: 'Laurence Sylvain',
			author: '',
			bookTitle: 'Later title',
			edition: '',
			isbn: '',
			bookstore: '',
			notes: '',
			sourceDate: '2026-08-21',
			priceCents: null
		};
		expect(Object.keys(extra).filter((key) => key !== 'priceCents')).toEqual(MIOS_CATALOGUE_FIELDS);
		expect(miosEntryKey(extra)).toBe('laurence-sylvain|602-UF2-MQ|14|Later title');
	});
});
