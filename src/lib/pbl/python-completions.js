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
	Object.freeze({ label: 'return', type: 'keyword' }),
	Object.freeze({ label: 'str', type: 'function' }),
	Object.freeze({ label: 'sum', type: 'function' }),
	Object.freeze({ label: 'while', type: 'keyword' })
]);

const IDENT_RE = /[A-Za-z_]\w*/gu;

/**
 * Collect identifier-like names from editor text, optionally skipping a span
 * (the token under the caret so the partial being typed is not suggested alone).
 * @param {string} text
 * @param {{ from: number, to: number } | null} [skip]
 * @returns {string[]}
 */
export function collectDocumentIdentifiers(text, skip = null) {
	/** @type {Set<string>} */
	const names = new Set();
	IDENT_RE.lastIndex = 0;
	let match;
	while ((match = IDENT_RE.exec(text))) {
		const from = match.index;
		const to = from + match[0].length;
		if (skip && from === skip.from && to === skip.to) continue;
		names.add(match[0]);
	}
	return [...names];
}

/**
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 */
export function pythonCompletions(context) {
	const token = context.matchBefore(/[A-Za-z_]\w*$/u);
	if (!token && !context.explicit) return null;
	const typed = token ? token.text : '';
	const from = token ? token.from : context.pos;
	const typedLower = typed.toLowerCase();

	/** @type {Map<string, { label: string, type: string, detail?: string }>} */
	const byLabel = new Map();

	for (const item of PYTHON_SYMBOLS) {
		if (!item.label.toLowerCase().startsWith(typedLower)) continue;
		byLabel.set(item.label, {
			label: item.label,
			type: item.type,
			detail: item.detail
		});
	}

	const skip = token ? { from: token.from, to: token.to } : null;
	for (const name of collectDocumentIdentifiers(context.state.doc.toString(), skip)) {
		if (byLabel.has(name)) continue;
		if (!name.toLowerCase().startsWith(typedLower)) continue;
		byLabel.set(name, { label: name, type: 'variable' });
	}

	const options = [...byLabel.values()];
	if (options.length === 0) return null;
	return { from, options };
}
