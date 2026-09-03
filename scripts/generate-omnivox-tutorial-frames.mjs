#!/usr/bin/env node
/**
 * Fallback generator for static/maritools/omnivox/step-NN.webp.
 * Production frames are redacted real Omnivox captures from the Scribe guide.
 * Re-run this only if those assets are missing; never embed student number / legal name.
 */
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'static', 'maritools', 'omnivox');

const STEPS = [
	{
		n: 1,
		title: 'Open Omnivox',
		cue: 'marianopolis.omnivox.ca',
		detail: 'Use the college Omnivox login page in your browser.'
	},
	{
		n: 2,
		title: 'Student number',
		cue: 'Student number',
		detail: 'Sign in with your student number here. MariTools never asks for it.'
	},
	{
		n: 3,
		title: 'Log in',
		cue: 'Log In',
		detail: 'Submit the Omnivox login form to continue.'
	},
	{
		n: 4,
		title: 'Course Schedule',
		cue: 'Course Schedule',
		detail: 'Open Course Schedule from the left Omnivox menu.'
	},
	{
		n: 5,
		title: 'Obtain my schedule',
		cue: 'Obtain my schedule',
		detail: 'Choose the semester, then open Obtain my schedule.'
	},
	{
		n: 6,
		title: 'Printer-friendly version',
		cue: 'printer-friendly version',
		detail: 'Click the yellow banner for the printer-friendly view.'
	},
	{
		n: 7,
		title: 'Compact list',
		cue: 'Compact printable semester schedule',
		detail: 'Pick the compact list, not the full grid format.'
	},
	{
		n: 8,
		title: 'View',
		cue: 'View',
		detail: 'Open the compact list so you can copy it.'
	},
	{
		n: 9,
		title: 'Copy the list',
		cue: '1  Course title…',
		detail: 'Copy only the numbered courses. Leave out name and student number.'
	}
];

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function svgFor(step) {
	const title = escapeXml(step.title);
	const cue = escapeXml(step.cue);
	const detail = escapeXml(step.detail);
	const sidebarActive = step.n === 4 ? '#1457d9' : '#5b6b7c';
	const sidebarWeight = step.n === 4 ? '700' : '400';
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">
  <rect width="800" height="420" fill="#ffffff"/>
  <rect x="0" y="0" width="800" height="420" fill="none" stroke="#bdc9d7"/>
  <rect x="0" y="0" width="168" height="420" fill="#f5f7fa" stroke="#d7dfe9"/>
  <text x="22" y="42" fill="#14233a" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18" font-weight="700">Omnivox</text>
  <text x="22" y="78" fill="#5b6b7c" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12">Services</text>
  <text x="22" y="108" fill="${sidebarActive}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="${sidebarWeight}">Course Schedule</text>
  <text x="22" y="138" fill="#5b6b7c" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12">Documents</text>
  <text x="484" y="48" text-anchor="middle" fill="#708199" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12">Step ${step.n} of 9</text>
  <text x="484" y="92" text-anchor="middle" fill="#14233a" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" font-weight="700">${title}</text>
  <text x="484" y="122" text-anchor="middle" fill="#516278" font-family="Inter, Helvetica, Arial, sans-serif" font-size="13">${detail}</text>
  <rect x="220" y="160" width="528" height="200" rx="4" fill="#f7f9fc" stroke="#1457d9" stroke-width="2"/>
  <text x="484" y="210" text-anchor="middle" fill="#708199" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12">Look for</text>
  <text x="484" y="250" text-anchor="middle" fill="#1457d9" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" font-weight="700">${cue}</text>
  <text x="484" y="290" text-anchor="middle" fill="#516278" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12">Labeled guide · no personal data</text>
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
	console.log('wrote', webpPath);
}
