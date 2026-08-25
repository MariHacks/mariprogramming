/**
 * Live NIM cold/warm proof. Does not print the API key or document body.
 * Usage: NVIDIA_NIM_API_KEY=… node scripts/prove-nim-cache.mjs
 * Or: node scripts/prove-nim-cache.mjs  (reads ~/Desktop/key)
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createOutlineExtractionProvider } from '../src/lib/maritools/extract/provider.js';
import { extractPdfText } from '../src/lib/server/maritools/pdf-text.js';

function loadKey() {
	const fromEnv = String(process.env.NVIDIA_NIM_API_KEY ?? '').trim();
	if (fromEnv) return fromEnv;
	for (const name of ['key', 'key.txt']) {
		const path = join(homedir(), 'Desktop', name);
		if (existsSync(path)) return readFileSync(path, 'utf8').trim();
	}
	return '';
}

function buildTextPdf(content) {
	const payload = Buffer.from(content, 'latin1');
	const objects = [
		'1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
		'2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
		'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
		`4 0 obj << /Length ${payload.length} >> stream\n${payload.toString('latin1')}\nendstream endobj`,
		'5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
	];
	return Buffer.from(`%PDF-1.4\n${objects.join('\n')}\ntrailer << /Root 1 0 R >>\n%%EOF\n`, 'latin1');
}

const key = loadKey();
if (!key) {
	console.error('NIM proof skipped: no NVIDIA_NIM_API_KEY or ~/Desktop/key');
	process.exit(2);
}

const pdf = buildTextPdf(
	'BT /F1 12 Tf 72 720 Td (Course Outline Modern Physics) Tj T* (Midterm 30% due 2026-10-15) Tj T* (Required book: University Physics) Tj ET'
);
const extracted = extractPdfText(pdf);
if (!extracted.text || extracted.text.length < 40) {
	console.error('NIM proof failed: PDF text extraction empty');
	process.exit(1);
}

const provider = createOutlineExtractionProvider({
	getKey: () => key,
	getModel: () => process.env.NVIDIA_NIM_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b'
});

const cold = await provider.extract({
	text: extracted.text,
	sha256: extracted.sha256,
	byteLength: extracted.byteLength,
	offeringKey: 'fall-2026:proof:00001'
});
const warm = await provider.extract({
	text: extracted.text,
	sha256: extracted.sha256,
	byteLength: extracted.byteLength
});
const offeringReuse = await provider.extract({
	text: extracted.text + '\n',
	offeringKey: 'fall-2026:proof:00001',
	byteLength: extracted.byteLength
});

const report = {
	coldOk: cold.ok,
	coldReason: cold.reason,
	coldInferenceCount: cold.inferenceCount,
	coldCacheHit: Boolean(cold.cacheHit),
	warmOk: warm.ok,
	warmInferenceCount: warm.inferenceCount,
	warmCacheHit: Boolean(warm.cacheHit),
	offeringReuseOk: offeringReuse.ok,
	offeringReuseInferenceCount: offeringReuse.inferenceCount,
	offeringReuseCacheHit: Boolean(offeringReuse.cacheHit),
	sha256Prefix: extracted.sha256.slice(0, 12),
	textLength: extracted.text.length
};

console.log(JSON.stringify(report, null, 2));

if (!cold.ok) {
	console.error('NIM cold call failed');
	process.exit(1);
}
if (cold.inferenceCount !== 1 || cold.cacheHit) {
	console.error('NIM cold call did not increment inference count');
	process.exit(1);
}
if (!warm.ok || !warm.cacheHit || warm.inferenceCount !== 1) {
	console.error('NIM warm call should be a cache hit with unchanged inference count');
	process.exit(1);
}
if (!offeringReuse.ok || !offeringReuse.cacheHit || offeringReuse.inferenceCount !== 1) {
	console.error('NIM offering-key reuse should be a cache hit with unchanged inference count');
	process.exit(1);
}

console.log('NIM cold/warm/offering-reuse cache proof passed');
