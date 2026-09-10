/**
 * Collect Pyodide stdout/stderr via setStdout({ write }) / setStderr({ write }).
 * Prefer write over batched: Pyodide 0.27.x StringWriter drops the newline byte
 * when invoking batched(), which concatenates print() lines in the Output panel.
 */
export function createStdioCollector() {
	let text = '';
	const decoder = new TextDecoder();
	return {
		/** @param {Uint8Array} buffer */
		write(buffer) {
			text += decoder.decode(buffer);
			return buffer.length;
		},
		get value() {
			return text;
		}
	};
}
