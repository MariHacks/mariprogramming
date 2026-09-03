// @vitest-environment node

import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { extractPdfText, isPdfHeader } from './pdf-text.js';

/**
 * @param {string} content
 * @param {{ flate?: boolean, extraObjects?: string }} [options]
 */
function buildPdf(content, options = {}) {
	const payload = options.flate
		? deflateSync(Buffer.from(content, 'latin1'))
		: Buffer.from(content, 'latin1');
	const filter = options.flate ? '/Filter /FlateDecode' : '';
	const extra = options.extraObjects ?? '';
	const objects = [
		'1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
		'2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
		'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
		`4 0 obj << /Length ${payload.length} ${filter} >> stream\n${payload.toString('latin1')}\nendstream endobj`,
		'5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
		extra
	].filter(Boolean);
	const body = objects.join('\n');
	return Buffer.from(`%PDF-1.4\n${body}\ntrailer << /Root 1 0 R >>\n%%EOF\n`, 'latin1');
}

describe('isPdfHeader', () => {
	it('accepts a PDF header and rejects other bytes', () => {
		expect(isPdfHeader(Buffer.from('%PDF-1.4\n'))).toBe(true);
		expect(isPdfHeader(Buffer.from('not a pdf'))).toBe(false);
		expect(isPdfHeader(new Uint8Array())).toBe(false);
	});
});

describe('extractPdfText', () => {
	it('returns empty text for non-PDF bytes', () => {
		const bytes = Buffer.from('hello');
		const result = extractPdfText(bytes);
		expect(result.text).toBe('');
		expect(result.byteLength).toBe(5);
		expect(result.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
	});

	it('reads uncompressed Tj strings', () => {
		const pdf = buildPdf('BT /F1 12 Tf 72 720 Td (Midterm 30%) Tj ET');
		expect(extractPdfText(pdf).text).toContain('Midterm 30%');
	});

	it('inflates FlateDecode content and reads TJ arrays', () => {
		const pdf = buildPdf('BT [(Hello) 40 ( world)] TJ ET', { flate: true });
		expect(extractPdfText(pdf).text).toContain('Hello world');
	});

	it('unescapes parentheses in literal strings', () => {
		const pdf = buildPdf('BT (Cost \\(CAD\\) 20%) Tj ET');
		expect(extractPdfText(pdf).text).toContain('Cost (CAD) 20%');
	});

	it('unescapes newlines, tabs, and backslashes', () => {
		const pdf = buildPdf('BT (line\\nreturn\\rtab\\tback\\\\slash) Tj ET');
		expect(extractPdfText(pdf).text).toBe('line\nreturn\rtab\tback\\slash');
	});

	it('removes NUL control bytes from extracted text', () => {
		const pdf = buildPdf('BT (Object\u0000-Oriented Programming) Tj ET');
		expect(extractPdfText(pdf).text).toBe('Object-Oriented Programming');
	});

	it('reads a stream with no dictionary and no newline after the marker', () => {
		const pdf = Buffer.from(
			'%PDF-1.4\nstream(Hello) Tj\nendstream\n6 0 obj << /Type /XObject /Length 1 >> stream\nA\nendstream\n',
			'latin1'
		);
		expect(extractPdfText(pdf).text).toContain('Hello');
	});

	it('skips an image stream that is not an XObject type', () => {
		const image =
			'6 0 obj << /Subtype /Image /Width 1 /Height 1 /Length 3 >> stream\nABC\nendstream endobj';
		const pdf = buildPdf('BT ET', { extraObjects: image });
		expect(extractPdfText(pdf).text.trim()).toBe('');
	});

	it('skips image streams so scanned PDFs look empty', () => {
		const image =
			'6 0 obj << /Type /XObject /Subtype /Image /Width 1 /Height 1 /Length 3 >> stream\nABC\nendstream endobj';
		const pdf = buildPdf('BT ET', { extraObjects: image });
		expect(extractPdfText(pdf).text.trim()).toBe('');
	});

	it('ignores a truncated stream without endstream', () => {
		const pdf = Buffer.from('%PDF-1.4\n4 0 obj << /Length 10 >> stream\nno-end', 'latin1');
		expect(extractPdfText(pdf).text).toBe('');
	});

	it('reads hexadecimal Tj strings', () => {
		const pdf = buildPdf('BT <48656C6C6F> Tj ET');
		expect(extractPdfText(pdf).text).toContain('Hello');
	});

	it('skips odd-length hexadecimal Tj strings', () => {
		const pdf = buildPdf('BT <48656C6C6> Tj ET');
		expect(extractPdfText(pdf).text).toBe('');
	});

	it('rejects oversized FlateDecode output', () => {
		const huge = deflateSync(Buffer.alloc(2_000_001, 65));
		const pdf = Buffer.from(
			`%PDF-1.4\n4 0 obj << /Filter /FlateDecode /Length ${huge.length} >> stream\n${huge.toString('latin1')}\nendstream endobj\n`,
			'latin1'
		);
		expect(extractPdfText(pdf).text).toBe('');
	});

	it('accepts a lone CR after the stream marker', () => {
		const pdf = Buffer.from(
			'%PDF-1.4\n4 0 obj << /Length 11 >> stream\r(Hello) Tj\nendstream endobj\n',
			'latin1'
		);
		expect(extractPdfText(pdf).text).toContain('Hello');
	});
});
