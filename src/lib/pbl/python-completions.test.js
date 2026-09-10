import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { PYTHON_SYMBOLS, collectDocumentIdentifiers, pythonCompletions } from './python-completions.js';

/** @param {string} doc @param {number} pos @param {boolean} explicit */
function contextAt(doc, pos, explicit) {
	return new CompletionContext(EditorState.create({ doc }), pos, explicit);
}

describe('python completions', () => {
	it('suggests print for a pr prefix', () => {
		const result = pythonCompletions(contextAt('pr', 2, false));
		expect(result?.from).toBe(0);
		expect(result?.options.map((item) => item.label)).toEqual(['print']);
	});

	it('lists symbols when the user asks explicitly after a space', () => {
		const result = pythonCompletions(contextAt('x ', 2, true));
		expect(result?.from).toBe(2);
		const labels = result?.options.map((item) => item.label) ?? [];
		expect(labels).toContain('len');
		expect(labels).toContain('print');
		expect(labels).not.toContain('readings');
		expect(labels).not.toContain('valid_readings');
		expect(labels).not.toContain('is_valid');
	});

	it('does not hardcode workshop variable names in PYTHON_SYMBOLS', () => {
		const labels = PYTHON_SYMBOLS.map((item) => item.label);
		expect(labels).not.toContain('readings');
		expect(labels).not.toContain('valid_readings');
		expect(labels).not.toContain('lower_bound');
		expect(labels).not.toContain('upper_bound');
		expect(labels).not.toContain('is_valid');
		expect(labels).toContain('print');
		expect(labels).toContain('len');
	});

	it('stays quiet when the caret is not in a name', () => {
		expect(pythonCompletions(contextAt('', 0, false))).toBeNull();
		expect(pythonCompletions(contextAt('x ', 2, false))).toBeNull();
	});

	it('returns nothing when no symbol matches', () => {
		expect(pythonCompletions(contextAt('zzz', 3, false))).toBeNull();
	});

	it('collects identifier-like names from the buffer', () => {
		const names = collectDocumentIdentifiers('lower_bound = 1\nupper_bound = 2\nprint(lower_bound)');
		expect(names).toContain('lower_bound');
		expect(names).toContain('upper_bound');
		expect(names).toContain('print');
	});

	it('suggests a previously declared name like lower_bound', () => {
		const doc = 'lower_bound = 11.9\nlow';
		const result = pythonCompletions(contextAt(doc, doc.length, false));
		expect(result?.from).toBe(doc.lastIndexOf('low'));
		const labels = result?.options.map((item) => item.label) ?? [];
		expect(labels).toContain('lower_bound');
		// Deduped: static symbols still merge cleanly.
		expect(new Set(labels).size).toBe(labels.length);
	});

	it('does not treat the incomplete token under the caret as a declaration', () => {
		const doc = 'zzzzy';
		expect(pythonCompletions(contextAt(doc, doc.length, false))).toBeNull();
	});
});
