/**
 * @typedef {{ label: string, type: string, detail?: string }} PythonSymbol
 */

/** @type {readonly PythonSymbol[]} */
export const PYTHON_SYMBOLS = Object.freeze([
	Object.freeze({ label: 'False', type: 'constant' }),
	Object.freeze({ label: 'None', type: 'constant' }),
	Object.freeze({ label: 'True', type: 'constant' }),
	Object.freeze({ label: 'and', type: 'keyword' }),
	Object.freeze({ label: 'append', type: 'method' }),
	Object.freeze({ label: 'average', type: 'function' }),
	Object.freeze({ label: 'bool', type: 'function' }),
	Object.freeze({ label: 'break', type: 'keyword' }),
	Object.freeze({ label: 'continue', type: 'keyword' }),
	Object.freeze({ label: 'def', type: 'keyword' }),
	Object.freeze({ label: 'dict', type: 'function' }),
	Object.freeze({ label: 'elif', type: 'keyword' }),
	Object.freeze({ label: 'else', type: 'keyword' }),
	Object.freeze({ label: 'float', type: 'function' }),
	Object.freeze({ label: 'for', type: 'keyword' }),
	Object.freeze({ label: 'from', type: 'keyword' }),
	Object.freeze({ label: 'if', type: 'keyword' }),
	Object.freeze({ label: 'import', type: 'keyword' }),
	Object.freeze({ label: 'in', type: 'keyword' }),
	Object.freeze({ label: 'input', type: 'function' }),
	Object.freeze({ label: 'int', type: 'function' }),
	Object.freeze({ label: 'is_valid', type: 'function' }),
	Object.freeze({ label: 'len', type: 'function' }),
	Object.freeze({ label: 'list', type: 'function' }),
	Object.freeze({ label: 'math', type: 'namespace' }),
	Object.freeze({ label: 'max', type: 'function' }),
	Object.freeze({ label: 'min', type: 'function' }),
	Object.freeze({ label: 'not', type: 'keyword' }),
	Object.freeze({ label: 'open', type: 'function' }),
	Object.freeze({ label: 'or', type: 'keyword' }),
	Object.freeze({ label: 'print', type: 'function', detail: 'print(...)' }),
	Object.freeze({ label: 'range', type: 'function' }),
	Object.freeze({ label: 'readings', type: 'variable' }),
	Object.freeze({ label: 'return', type: 'keyword' }),
	Object.freeze({ label: 'str', type: 'function' }),
	Object.freeze({ label: 'sum', type: 'function' }),
	Object.freeze({ label: 'valid_readings', type: 'variable' }),
	Object.freeze({ label: 'while', type: 'keyword' })
]);

/**
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 */
export function pythonCompletions(context) {
	const token = context.matchBefore(/[A-Za-z_]\w*$/u);
	if (!token && !context.explicit) return null;
	const typed = token ? token.text : '';
	const from = token ? token.from : context.pos;
	const options = PYTHON_SYMBOLS.filter((item) =>
		item.label.toLowerCase().startsWith(typed.toLowerCase())
	).map((item) => ({ label: item.label, type: item.type, detail: item.detail }));
	if (options.length === 0) return null;
	return { from, options };
}
