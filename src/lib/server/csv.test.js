// @ts-nocheck
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { CsvExportError, createBookstorePurchaseCsv } from './csv.js';

describe('bookstore purchase CSV', () => {
	it('writes the fixed privacy-safe columns with RFC 4180 line endings', () => {
		expect(
			createBookstorePurchaseCsv([
				{
					bookstore: 'Campus Books',
					title: 'A title, with "quotes"',
					isbn: '9780131103627',
					quantity: 3
				},
				{ bookstore: 'Librairie du Collège', title: 'Une ligne\ndeux', isbn: null, quantity: 1 }
			])
		).toBe(
			'bookstore,title,ISBN,quantity\r\n' +
				'Campus Books,"A title, with ""quotes""",9780131103627,3\r\n' +
				'Librairie du Collège,"Une ligne\ndeux",,1\r\n'
		);
	});

	it.each([
		['=SUM(1,1)', "'=SUM(1,1)"],
		['+cmd', "'+cmd"],
		['-2+3', "'-2+3"],
		['@SUM(A1)', "'@SUM(A1)"],
		['\t=SUM(A1)', "'\t=SUM(A1)"],
		['\r=SUM(A1)', "'\r=SUM(A1)"],
		['  =SUM(A1)', "'  =SUM(A1)"],
		['\u000b  +cmd', "'\u000b  +cmd"]
	])('neutralizes hostile title %j', (title, neutralized) => {
		const csv = createBookstorePurchaseCsv([
			{ bookstore: 'Campus Books', title, isbn: '9780131103627', quantity: 1 }
		]);
		expect(csv).toContain(neutralized.replaceAll('"', '""'));
		expect(csv).not.toContain(`\r\n${title},`);
	});

	it('neutralizes every exported text column independently', () => {
		const csv = createBookstorePurchaseCsv([
			{ bookstore: '=STORE', title: '+TITLE', isbn: '-123', quantity: 2 }
		]);
		expect(csv).toBe("bookstore,title,ISBN,quantity\r\n'=STORE,'+TITLE,'-123,2\r\n");
	});

	it('exports a header-only file for an empty purchase queue', () => {
		expect(createBookstorePurchaseCsv([])).toBe('bookstore,title,ISBN,quantity\r\n');
	});

	it.each([
		['non-array rows', null],
		['null row', [null]],
		['array row', [[]]],
		[
			'too many rows',
			Array.from({ length: 1001 }, () => ({ bookstore: 'A', title: 'B', isbn: null, quantity: 1 }))
		],
		[
			'extra PII field',
			[
				{
					bookstore: 'A',
					title: 'B',
					isbn: null,
					quantity: 1,
					customerEmail: 'student@example.com'
				}
			]
		],
		['missing field', [{ bookstore: 'A', title: 'B', quantity: 1 }]],
		['empty bookstore', [{ bookstore: '', title: 'B', isbn: null, quantity: 1 }]],
		['overlong title', [{ bookstore: 'A', title: 'B'.repeat(241), isbn: null, quantity: 1 }]],
		['NUL text', [{ bookstore: 'A', title: 'B\0C', isbn: null, quantity: 1 }]],
		['invalid ISBN type', [{ bookstore: 'A', title: 'B', isbn: 123, quantity: 1 }]],
		['zero quantity', [{ bookstore: 'A', title: 'B', isbn: null, quantity: 0 }]],
		['oversized row quantity', [{ bookstore: 'A', title: 'B', isbn: null, quantity: 10000 }]],
		[
			'oversized aggregate quantity',
			[
				{ bookstore: 'A', title: 'B', isbn: null, quantity: 6000 },
				{ bookstore: 'A', title: 'C', isbn: null, quantity: 4000 }
			]
		]
	])('rejects %s', (_label, rows) => {
		expect(() => createBookstorePurchaseCsv(rows)).toThrow(CsvExportError);
	});
});
