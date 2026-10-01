/** @typedef {SharedArrayBuffer | ArrayBuffer} StdinSharedBacking */

export const STDIN_BUFFER_CAPACITY = 8192;
const HEADER_BYTES = 8;

/** @returns {StdinSharedBacking | null} */
export function tryCreateInteractiveStdinBuffer() {
	try {
		if (typeof SharedArrayBuffer === 'undefined') return null;
		return new SharedArrayBuffer(HEADER_BYTES + STDIN_BUFFER_CAPACITY);
	} catch {
		return null;
	}
}

/**
 * @param {StdinSharedBacking} backing
 * @returns {{ control: Int32Array, bytes: Uint8Array }}
 */
export function viewInteractiveStdinBuffer(backing) {
	const control = new Int32Array(backing, 0, 2);
	const bytes = new Uint8Array(backing, HEADER_BYTES, STDIN_BUFFER_CAPACITY);
	return { control, bytes };
}

/**
 * Host-side: deliver one line to a blocked worker.
 * @param {StdinSharedBacking} backing
 * @param {string} line
 */
export function deliverInteractiveStdinLine(backing, line) {
	const { control, bytes } = viewInteractiveStdinBuffer(backing);
	const encoded = new TextEncoder().encode(String(line).replace(/\r?\n/gu, ''));
	if (encoded.length > STDIN_BUFFER_CAPACITY) {
		throw new Error('Console input is too long.');
	}
	bytes.set(encoded);
	Atomics.store(control, 1, encoded.length);
	Atomics.store(control, 0, 1);
	Atomics.notify(control, 0, 1);
}

/**
 * Worker-side: block until the host delivers a line (or keyboard interrupt).
 * @param {StdinSharedBacking} backing
 * @param {{ checkInterrupt?: () => void } | undefined} pyodide
 * @returns {string}
 */
export function readInteractiveStdinLine(backing, pyodide) {
	const { control, bytes } = viewInteractiveStdinBuffer(backing);
	const decoder = new TextDecoder();
	const timeoutMs = 100;
	while (true) {
		const status = Atomics.wait(control, 0, 0, timeoutMs);
		if (status === 'timed-out') {
			pyodide?.checkInterrupt?.();
			continue;
		}
		const length = Atomics.load(control, 1);
		const line = decoder.decode(bytes.subarray(0, length));
		Atomics.store(control, 0, 0);
		Atomics.store(control, 1, 0);
		return line;
	}
}
