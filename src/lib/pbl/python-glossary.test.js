import { describe, expect, it } from 'vitest';
import {
	GLOSSARY_ALIASES,
	PYTHON_GLOSSARY,
	glossaryKeys,
	hasGlossaryBoundary,
	tokenizeLessonText
} from './python-glossary.js';

describe('python glossary', () => {
	it('covers the Science PBL beginner terms', () => {
		const keys = glossaryKeys();
		for (const key of [
			'print',
			'variable',
			'==',
			'int',
			'float',
			'str',
			'bool',
			'True',
			'False',
			'list',
			'indexing',
			'slice',
			'len',
			'for',
			'range',
			'if',
			'elif',
			'else',
			'append',
			'sum',
			'min',
			'max',
			'def',
			'input',
			'while',
			'import',
			'math.sqrt',
			'dict',
			'f-string',
			'open'
		]) {
			expect(keys).toContain(key);
			const entry = PYTHON_GLOSSARY[key];
			expect(entry.name).toBeTruthy();
			expect(entry.summary).toBeTruthy();
			expect(entry.usefulFor).toBeTruthy();
			expect(entry.example).toBeTruthy();
			expect(entry.summary).not.toMatch(/\u2014/);
			expect(entry.usefulFor).not.toMatch(/\u2014/);
		}
	});

	it('prefers the longest alias at a position', () => {
		const segments = tokenizeLessonText('Use math.sqrt after import math.');
		const terms = segments.filter((s) => s.type === 'term').map((s) => s.key);
		expect(terms).toEqual(['math.sqrt', 'import']);
		expect(segments.some((s) => s.type === 'term' && s.value === 'math.sqrt')).toBe(true);
	});

	it('links every occurrence by default, including across repeated terms', () => {
		const segments = tokenizeLessonText('print once then print again');
		const prints = segments.filter((s) => s.type === 'term' && s.key === 'print');
		expect(prints).toHaveLength(2);
	});

	it('can limit to the first occurrence when oncePerTerm is true', () => {
		const segments = tokenizeLessonText('print once then print again', { oncePerTerm: true });
		const prints = segments.filter((s) => s.type === 'term' && s.key === 'print');
		expect(prints).toHaveLength(1);
		expect(segments.map((s) => (s.type === 'term' ? `[${s.value}]` : s.value)).join('')).toBe(
			'[print] once then print again'
		);
	});

	it('does not match mid-word tokens', () => {
		const segments = tokenizeLessonText('The printer and lengthening notes stay plain.');
		expect(segments.filter((s) => s.type === 'term')).toEqual([]);
	});

	it('matches == before = and skips comparison operators like <=', () => {
		const eq = tokenizeLessonText('Use == to compare. Use = to assign.');
		expect(eq.filter((s) => s.type === 'term').map((s) => s.key)).toEqual(['==', 'variable']);

		const bounds = tokenizeLessonText('if 10 <= reading <= 20: pass');
		const keys = bounds.filter((s) => s.type === 'term').map((s) => s.key);
		expect(keys).toContain('if');
		expect(keys).not.toContain('variable');
		expect(keys).not.toContain('==');
	});

	it('keeps True/False case-sensitive and skips lowercase true', () => {
		const segments = tokenizeLessonText('True and False beat true or false here.');
		expect(segments.filter((s) => s.type === 'term').map((s) => s.key)).toEqual(['True', 'False']);
	});

	it('matches prose aliases for lists, variables, and f-strings case-insensitively', () => {
		const segments = tokenizeLessonText('Variables, Lists, Dictionaries, and F-strings help.');
		expect(segments.filter((s) => s.type === 'term').map((s) => s.key)).toEqual([
			'variable',
			'list',
			'dict',
			'f-string'
		]);
	});

	it('matches float() and input() conversion forms', () => {
		const segments = tokenizeLessonText('Convert with float() after input().');
		expect(segments.filter((s) => s.type === 'term').map((s) => ({ key: s.key, value: s.value }))).toEqual([
			{ key: 'float', value: 'float()' },
			{ key: 'input', value: 'input()' }
		]);
	});

	it('returns an empty list for empty input', () => {
		expect(tokenizeLessonText('')).toEqual([]);
		expect(tokenizeLessonText(/** @type {any} */ (null))).toEqual([]);
	});

	it('exposes boundary helper for operators and words', () => {
		const assign = GLOSSARY_ALIASES.find((a) => a.match === '=');
		const printAlias = GLOSSARY_ALIASES.find((a) => a.match === 'print');
		expect(assign).toBeTruthy();
		expect(printAlias).toBeTruthy();
		expect(hasGlossaryBoundary('a = b', 2, 3, assign)).toBe(true);
		expect(hasGlossaryBoundary('a <= b', 3, 4, assign)).toBe(false);
		expect(hasGlossaryBoundary('printer', 0, 5, printAlias)).toBe(false);
		expect(hasGlossaryBoundary('print(', 0, 5, printAlias)).toBe(true);
		expect(hasGlossaryBoundary('x.print', 2, 7, printAlias)).toBe(false);
		expect(hasGlossaryBoundary('a == b', 2, 4, GLOSSARY_ALIASES.find((a) => a.match === '=='))).toBe(true);
		expect(hasGlossaryBoundary('a===b', 2, 3, assign)).toBe(false);
		expect(hasGlossaryBoundary('a==b', 1, 2, assign)).toBe(false);
		expect(hasGlossaryBoundary('a!=b', 2, 3, assign)).toBe(false);
	});
});
