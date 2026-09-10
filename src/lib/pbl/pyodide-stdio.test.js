import { describe, expect, it } from 'vitest';
import { createStdioCollector } from './pyodide-stdio.js';

describe('pyodide stdio collector', () => {
	it('keeps newlines between print() chunks (no concatenation)', () => {
		const out = createStdioCollector();
		const enc = new TextEncoder();
		out.write(enc.encode('11.9\n'));
		out.write(enc.encode('12.299999999999999\n'));
		expect(out.value).toBe('11.9\n12.299999999999999\n');
		expect(out.value).not.toBe('11.912.299999999999999');
	});
});
