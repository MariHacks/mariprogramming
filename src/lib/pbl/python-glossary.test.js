import { describe, expect, it } from 'vitest';
import {
	GLOSSARY_ALIASES,
	PYTHON_GLOSSARY,
	glossaryKeys,
	resolveGlossaryMark,
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

	it('does not auto-link bare prose, including English for', () => {
		const prose = 'This step only proves the shared editor and Run button work for your team.';
		expect(tokenizeLessonText(prose).filter((s) => s.type === 'term')).toEqual([]);
		expect(tokenizeLessonText('print once then if True else for while def').filter((s) => s.type === 'term')).toEqual(
			[]
		);
	});

	it('links only explicit backtick marks', () => {
		const segments = tokenizeLessonText('Use a `for` loop, then `range` and `input()`.');
		expect(segments.filter((s) => s.type === 'term').map((s) => ({ key: s.key, value: s.value }))).toEqual([
			{ key: 'for', value: 'for' },
			{ key: 'range', value: 'range' },
			{ key: 'input', value: 'input()' }
		]);
	});

	it('links marked for and leaves unmarked for plain', () => {
		const unmarked = tokenizeLessonText('work for your team');
		expect(unmarked.filter((s) => s.type === 'term')).toHaveLength(0);
		expect(unmarked.map((s) => s.value).join('')).toBe('work for your team');

		const marked = tokenizeLessonText('walk with `for` x in items');
		expect(marked.filter((s) => s.type === 'term').map((s) => s.key)).toEqual(['for']);
	});

	it('links every marked occurrence by default', () => {
		const segments = tokenizeLessonText('`print` once then `print` again');
		const prints = segments.filter((s) => s.type === 'term' && s.key === 'print');
		expect(prints).toHaveLength(2);
	});

	it('can limit to the first marked occurrence when oncePerTerm is true', () => {
		const segments = tokenizeLessonText('`print` once then `print` again', { oncePerTerm: true });
		const prints = segments.filter((s) => s.type === 'term' && s.key === 'print');
		expect(prints).toHaveLength(1);
		expect(segments.map((s) => (s.type === 'term' ? `[${s.value}]` : s.value)).join('')).toBe(
			'[print] once then print again'
		);
	});

	it('keeps unknown backtick marks as literal text', () => {
		const segments = tokenizeLessonText('See `notATerm` in prose.');
		expect(segments.filter((s) => s.type === 'term')).toEqual([]);
		expect(segments.map((s) => s.value).join('')).toBe('See `notATerm` in prose.');
	});

	it('resolves case-insensitive prose aliases inside marks', () => {
		expect(resolveGlossaryMark('Variables')?.key).toBe('variable');
		expect(resolveGlossaryMark('F-strings')?.key).toBe('f-string');
		expect(resolveGlossaryMark('math.sqrt')?.key).toBe('math.sqrt');
		expect(resolveGlossaryMark('True')?.key).toBe('True');
		expect(resolveGlossaryMark('true')).toBeNull();
		expect(resolveGlossaryMark('==')?.key).toBe('==');
		expect(resolveGlossaryMark('=')?.key).toBe('variable');
	});

	it('prefers the longest alias when resolving a mark', () => {
		expect(resolveGlossaryMark('math.sqrt')?.key).toBe('math.sqrt');
		expect(GLOSSARY_ALIASES.some((a) => a.match === 'math.sqrt')).toBe(true);
	});

	it('returns an empty list for empty input', () => {
		expect(tokenizeLessonText('')).toEqual([]);
		expect(tokenizeLessonText(/** @type {any} */ (null))).toEqual([]);
	});
});
