#!/usr/bin/env node
/**
 * Rebuild static/maritools/omnivox/step-NN.webp from Scribe raw captures.
 * Solid chrome-matched blocks cover student name/number, login values, faces,
 * and the Omnivox header college watermark that OCR misreads as "Mariano*".
 *
 * Usage:
 *   node scripts/redact-omnivox-tutorial-frames.mjs
 *   RAW_DIR=.artifacts/scribe-omnivox-raw node scripts/redact-omnivox-tutorial-frames.mjs
 *
 * Requires: tesseract, cwebp, Python Pillow.
 * Exits non-zero if post-redaction OCR still finds student PII.
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = process.env.RAW_DIR
	? join(root, process.env.RAW_DIR)
	: join(root, '.artifacts', 'scribe-omnivox-raw');
const OUT_DIR = join(root, 'static', 'maritools', 'omnivox');
const WORK_DIR = join(root, '.artifacts', 'scribe-omnivox-work');
const TARGET = [1200, 872];

/** @type {Record<number, Array<[number, number, number, number, string]>>} */
// Boxes on raw 2252x1638: [x0, y0, x1, y1, fill]
// fill: white | panel | header
const REDACTIONS = {
	1: [
		// Login-side person photo / campus imagery
		[0, 0, 1120, 1638, 'panel'],
		// Student number value (placeholders / typed digits) + underline
		[1320, 630, 2050, 780, 'white'],
		// Password dots + eye toggle
		[1320, 820, 2050, 980, 'white']
	],
	2: [
		[0, 0, 1120, 1638, 'panel'],
		[1320, 630, 2050, 780, 'white'],
		[1320, 820, 2050, 980, 'white']
	],
	3: [
		[0, 0, 1120, 1638, 'panel'],
		// Scribe capture tip popup (top-right)
		[1680, 40, 2220, 320, 'white'],
		[1320, 630, 2050, 780, 'white'],
		[1320, 820, 2050, 980, 'white']
	],
	4: [
		// Student display name + Marianopolis College header watermark
		// (watermark OCR's as Mariano* and failed PII review)
		[1180, 8, 1620, 120, 'white']
	],
	5: [
		// Header student name + college watermark (name sits farther right than step 4)
		[1440, 8, 1800, 120, 'white']
	],
	6: [
		[1380, 8, 1780, 120, 'white'],
		// Personal Data name + student number values
		[860, 560, 1140, 660, 'white']
	],
	7: [
		// "Zhi Cheng Ma" before "· Fall 2026" under Printer-friendly version
		[940, 95, 1160, 145, 'white']
	],
	8: [
		[940, 95, 1160, 145, 'white']
	],
	9: [
		// Printable schedule name + student number under title
		[900, 105, 1360, 170, 'white']
	]
};

const FILLS = {
	white: '255,255,255',
	panel: '232,236,240',
	header: '255,255,255'
};

/** Patterns that must not appear in shipped OCR (institution "Marianopolis" allowed). */
const FORBIDDEN = [
	/\bzhi\b/i,
	/\bcheng\b/i,
	/\b2530622\b/,
	/\bmarianoj\b/i,
	/\bmarianoy\b/i,
	/\bmariano\b(?!polis)/i
];

mkdirSync(WORK_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

if (!existsSync(join(RAW_DIR, 'step-01.png'))) {
	console.error(`Missing raw frames in ${RAW_DIR}`);
	process.exit(1);
}

const py = `
from pathlib import Path
from PIL import Image, ImageDraw
import sys

raw_dir = Path(${JSON.stringify(RAW_DIR)})
work = Path(${JSON.stringify(WORK_DIR)})
out_dir = Path(${JSON.stringify(OUT_DIR)})
target = ${JSON.stringify(TARGET)}
redactions = ${JSON.stringify(REDACTIONS)}
fills = {
    'white': (255, 255, 255, 255),
    'panel': (232, 236, 240, 255),
    'header': (255, 255, 255, 255),
}

for step, boxes in redactions.items():
    src = raw_dir / f'step-{int(step):02d}.png'
    im = Image.open(src).convert('RGBA')
    draw = ImageDraw.Draw(im)
    for x0, y0, x1, y1, fill in boxes:
        draw.rectangle([x0, y0, x1, y1], fill=fills[fill])
    rgb = im.convert('RGB').resize(tuple(target), Image.Resampling.LANCZOS)
    png_path = work / f'redacted-{int(step):02d}.png'
    rgb.save(png_path)
    print(png_path)
`;

const pyRun = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
if (pyRun.status !== 0) {
	console.error(pyRun.stderr || pyRun.stdout);
	process.exit(pyRun.status ?? 1);
}

const proof = [];
let failed = false;

for (let step = 1; step <= 9; step++) {
	const pad = String(step).padStart(2, '0');
	const pngPath = join(WORK_DIR, `redacted-${pad}.png`);
	const webpPath = join(OUT_DIR, `step-${pad}.webp`);
	const jpgPath = join(WORK_DIR, `ocr-${pad}.jpg`);
	const tsvBase = join(WORK_DIR, `gate-${pad}`);

	const webp = spawnSync('cwebp', ['-quiet', '-q', '90', pngPath, '-o', webpPath], {
		encoding: 'utf8'
	});
	if (webp.status !== 0) {
		console.error(webp.stderr || webp.stdout);
		process.exit(webp.status ?? 1);
	}

	// OCR via JPEG (tesseract+leptonica is unreliable on some PNG paths)
	spawnSync('python3', ['-c', `from PIL import Image; Image.open(${JSON.stringify(pngPath)}).convert('RGB').save(${JSON.stringify(jpgPath)}, quality=92)`], {
		encoding: 'utf8'
	});
	spawnSync('tesseract', [jpgPath, tsvBase, '--psm', '6', 'tsv'], {
		encoding: 'utf8',
		stdio: ['ignore', 'ignore', 'ignore']
	});

	const tsv = readFileSync(`${tsvBase}.tsv`, 'utf8');
	const words = tsv
		.split('\n')
		.slice(1)
		.map((line) => line.split('\t')[11] || '')
		.filter(Boolean);
	const text = words.join(' ');
	const hits = FORBIDDEN.filter((re) => re.test(text)).map((re) => String(re));

	const line = {
		step,
		webp: webpPath,
		hits,
		marianoFamily: (text.match(/mariano\w*/gi) || []).slice(0, 8),
		sample: words.filter((w) => /mari|zhi|cheng|2530|student/i.test(w)).slice(0, 12)
	};
	proof.push(line);
	console.log(
		`step-${pad}: hits=${hits.length ? hits.join(',') : 'none'} mariano*=${JSON.stringify(line.marianoFamily)}`
	);
	if (hits.length) failed = true;
}

const proofPath = join(WORK_DIR, 'ocr-gate-proof.json');
writeFileSync(proofPath, JSON.stringify({ ok: !failed, proof }, null, 2));
console.log('wrote', proofPath);

if (failed) {
	console.error('OCR gate FAILED: forbidden PII still present');
	process.exit(2);
}

console.log('OCR gate PASS');
