/**
 * Copy merged-preview page CSS into production, dropping shell/home/preview-bar rules.
 * Re-run: node scripts/extract-maritools-preview-css.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, '.impeccable/arena/visual-preview/merged/styles.css');
const destPath = path.join(root, 'src/lib/maritools/styles/preview-pages.css');

const DROP = /^(html|body|:root|\*|button|input|select|textarea|a|h1|h2|h3|p|\[hidden\]|:focus-visible|\.skip-link|\.site-header|\.header-|\.club-brand|\.primary-nav|\.contact-link|\.social-link|\.account-demo|\.account-menu|\.account-state|\.signup-link|\.identity-button|\.header-menu|\.mobile-site|\.mobile-account|\.preview-bar|\.app-shell|\.tools-sidebar|\.tools-brand|\.tools-wordmark|\.tools-glyph|\.tools-context|\.tools-nav|\.tools-menu|\.sidebar-|\.back-club|\.home-intro|\.today-ticket|\.tool-index|\.page-home|\.workspace|\.tools-main)\b/;

const source = readFileSync(sourcePath, 'utf8');

function splitTopLevel(css) {
	const blocks = [];
	let i = 0;
	while (i < css.length) {
		while (i < css.length && /\s/.test(css[i])) i += 1;
		if (i >= css.length) break;
		if (css.startsWith('/*', i)) {
			const end = css.indexOf('*/', i + 2);
			i = end === -1 ? css.length : end + 2;
			continue;
		}
		const start = i;
		let depth = 0;
		let inString = null;
		for (; i < css.length; i += 1) {
			const ch = css[i];
			if (inString) {
				if (ch === '\\') {
					i += 1;
					continue;
				}
				if (ch === inString) inString = null;
				continue;
			}
			if (ch === '"' || ch === "'") {
				inString = ch;
				continue;
			}
			if (ch === '{') depth += 1;
			if (ch === '}') {
				depth -= 1;
				if (depth === 0) {
					i += 1;
					break;
				}
			}
			if (ch === ';' && depth === 0) {
				i += 1;
				break;
			}
		}
		blocks.push(css.slice(start, i).trim());
	}
	return blocks.filter(Boolean);
}

function keepSelector(selector) {
	const trimmed = selector.trim();
	if (!trimmed) return false;
	return !DROP.test(trimmed);
}

function filterRule(block) {
	if (block.startsWith('@media') || block.startsWith('@supports')) {
		const open = block.indexOf('{');
		const close = block.lastIndexOf('}');
		if (open === -1 || close === -1) return '';
		const prelude = block.slice(0, open).trim();
		const inner = splitTopLevel(block.slice(open + 1, close))
			.map(filterRule)
			.filter(Boolean)
			.join('\n\n');
		if (!inner) return '';
		return `${prelude} {\n${inner}\n}`;
	}
	if (block.startsWith('@')) return '';
	const open = block.indexOf('{');
	if (open === -1) return '';
	const selectors = block
		.slice(0, open)
		.split(',')
		.map((part) => part.trim())
		.filter(keepSelector);
	if (selectors.length === 0) return '';
	return `${selectors.join(',\n')} ${block.slice(open)}`;
}

const kept = splitTopLevel(source).map(filterRule).filter(Boolean);
const nested = kept
	.map((block) => block.replace(/^/gm, '\t'))
	.join('\n\n');

const output = `/* Generated from .impeccable/arena/visual-preview/merged/styles.css */
/* Do not edit by hand. Re-run: node scripts/extract-maritools-preview-css.mjs */

.mt-preview {
	--paper: #f7f9fc;
	--white: #ffffff;
	--ink: #0b1d34;
	--ink-rgb: 11 29 52;
	--blue: #1457d9;
	--blue-dark: #0c3eaa;
	--blue-pale: #eaf1ff;
	--ink-soft: #24354a;
	--mist: #edf1f6;
	--steel: #69798d;
	--line: #d7dfe9;
	--line-dark: #bdc9d7;
	--rule: #d7dee7;
	--rule-dark: #b6c1ce;
	--signal: #1264d8;
	--signal-dark: #0b4fae;
	--green: #177b59;
	--green-pale: #dff4ea;
	--green-soft: #e2f2e9;
	--red: #ba3040;
	--red-pale: #fff0f1;
	--amber: #9a5b04;
	--font-display: 'Inter Tight', Inter, Arial, sans-serif;
	--font-tight: 'Inter Tight', Inter, Arial, sans-serif;
	--font-body: Inter, Arial, sans-serif;
	--control-h: 2.25rem;
	--header-h: 0px;
	--preview-h: 0px;
	--sidebar-w: 214px;
	--hour-h: 70px;
	--fast: 160ms;
	--ease: cubic-bezier(0.2, 0.8, 0.2, 1);
	color: var(--ink);
	font-family: var(--font-body);
	font-size: 14px;
	line-height: 1.45;
	background: var(--paper);

${nested}
}
`;

writeFileSync(destPath, output);
console.log(`Wrote ${destPath} (${output.length} bytes, ${kept.length} rules)`);
