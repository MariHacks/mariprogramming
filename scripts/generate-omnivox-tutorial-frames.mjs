#!/usr/bin/env node
/**
 * Builds illustrative Omnivox tutorial frames at static/maritools/omnivox/step-NN.webp.
 * These are labeled guide diagrams (same intent as the HTML mock), not live Omnivox captures.
 * Replace with cropped real screenshots when available (never ship student number / legal name).
 */
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'static', 'maritools', 'omnivox');

const STEPS = [
	{ n: 1, title: 'Open Omnivox', focus: 'main' },
	{ n: 2, title: 'Student number', focus: 'field' },
	{ n: 3, title: 'Log in', focus: 'field' },
	{ n: 4, title: 'Course Schedule', focus: 'sidebar' },
	{ n: 5, title: 'Obtain my schedule', focus: 'action' },
	{ n: 6, title: 'Printer-friendly version', focus: 'action' },
	{ n: 7, title: 'Compact list', focus: 'action' },
	{ n: 8, title: 'View', focus: 'action' },
	{ n: 9, title: 'Copy the list', focus: 'action' }
];

/** @param {'main'|'field'|'sidebar'|'action'} kind */
function focusRect(kind) {
	if (kind === 'sidebar') return { x: 12, y: 148, w: 120, h: 38 };
	if (kind === 'field') return { x: 220, y: 168, w: 360, h: 38 };
	if (kind === 'action') return { x: 210, y: 248, w: 380, h: 52 };
	return { x: 250, y: 220, w: 280, h: 38 };
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function svgFor(step) {
	const focus = focusRect(step.focus);
	const title = escapeXml(step.title);
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">
  <rect width="800" height="420" fill="#ffffff"/>
  <rect x="0" y="0" width="800" height="420" fill="none" stroke="#bdc9d7"/>
  <rect x="0" y="0" width="168" height="420" fill="#f5f7fa" stroke="#d7dfe9"/>
  <text x="22" y="42" fill="#14233a" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" font-weight="700">Omnivox</text>
  <text x="22" y="78" fill="#5b6b7c" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12">Services</text>
  <text x="22" y="108" fill="#5b6b7c" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12">Course Schedule</text>
  <text x="22" y="138" fill="#5b6b7c" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12">Documents</text>
  <text x="400" y="150" text-anchor="middle" fill="#5b6b7c" font-family="Inter, Helvetica, Arial, sans-serif" font-size="13">Step ${step.n}</text>
  <text x="400" y="188" text-anchor="middle" fill="#14233a" font-family="Inter, Helvetica, Arial, sans-serif" font-size="28" font-weight="700">${title}</text>
  <text x="400" y="218" text-anchor="middle" fill="#708199" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12">Illustrative guide frame</text>
  <rect x="${focus.x}" y="${focus.y}" width="${focus.w}" height="${focus.h}" fill="rgba(20,87,217,0.08)" stroke="#1457d9" stroke-width="2"/>
</svg>`;
}

mkdirSync(outDir, { recursive: true });

for (const step of STEPS) {
	const pad = String(step.n).padStart(2, '0');
	const svgPath = join(outDir, `step-${pad}.svg`);
	const pngPath = join(outDir, `step-${pad}.png`);
	const webpPath = join(outDir, `step-${pad}.webp`);
	writeFileSync(svgPath, svgFor(step));

	const convert = spawnSync('magick', [svgPath, pngPath], { encoding: 'utf8' });
	if (convert.status !== 0) {
		console.error(convert.stderr || convert.stdout);
		process.exit(convert.status ?? 1);
	}

	const webp = spawnSync('cwebp', ['-quiet', '-q', '90', pngPath, '-o', webpPath], {
		encoding: 'utf8'
	});
	if (webp.status !== 0) {
		console.error(webp.stderr || webp.stdout);
		process.exit(webp.status ?? 1);
	}

	unlinkSync(svgPath);
	unlinkSync(pngPath);
	console.log(`wrote ${webpPath}`);
}
