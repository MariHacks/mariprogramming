import { describe, expect, it } from 'vitest';
import {
	deliverInteractiveStdinLine,
	readInteractiveStdinLine,
	tryCreateInteractiveStdinBuffer,
	viewInteractiveStdinBuffer
} from './interactive-stdin-buffer.js';

describe('interactive stdin buffer', () => {
	it('delivers and reads a line through the shared buffer', () => {
		const backing = tryCreateInteractiveStdinBuffer();
		expect(backing).not.toBeNull();
		const readPromise = Promise.resolve().then(() =>
			readInteractiveStdinLine(/** @type {SharedArrayBuffer} */ (backing), {
				checkInterrupt: () => {}
			})
		);
		deliverInteractiveStdinLine(/** @type {SharedArrayBuffer} */ (backing), 'goofy excuse');
		return expect(readPromise).resolves.toBe('goofy excuse');
	});

	it('rejects lines that exceed capacity', () => {
		const backing = tryCreateInteractiveStdinBuffer();
		expect(() =>
			deliverInteractiveStdinLine(/** @type {SharedArrayBuffer} */ (backing), 'x'.repeat(9000))
		).toThrow(/too long/i);
	});

	it('views control and byte regions', () => {
		const backing = tryCreateInteractiveStdinBuffer();
		const { control, bytes } = viewInteractiveStdinBuffer(/** @type {SharedArrayBuffer} */ (backing));
		expect(control).toHaveLength(2);
		expect(bytes.byteLength).toBeGreaterThan(0);
	});
});
