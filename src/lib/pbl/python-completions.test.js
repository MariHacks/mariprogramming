import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { pythonCompletions } from './python-completions.js';

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
		expect(result?.options.map((item) => item.label)).toContain('len');
		expect(result?.options.map((item) => item.label)).toContain('readings');
	});

	it('stays quiet when the caret is not in a name', () => {
		expect(pythonCompletions(contextAt('', 0, false))).toBeNull();
		expect(pythonCompletions(contextAt('x ', 2, false))).toBeNull();
	});

	it('returns nothing when no symbol matches', () => {
		expect(pythonCompletions(contextAt('zzz', 3, false))).toBeNull();
	});
});
