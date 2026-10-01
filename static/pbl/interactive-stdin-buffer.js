(function () {
	const HEADER_BYTES = 8;
	const CAPACITY = 8192;

	/** @param {SharedArrayBuffer} backing @param {{ checkInterrupt?: () => void } | undefined} pyodide */
	self.readInteractiveStdinLine = function readInteractiveStdinLine(backing, pyodide) {
		const control = new Int32Array(backing, 0, 2);
		const bytes = new Uint8Array(backing, HEADER_BYTES, CAPACITY);
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
	};
})();
