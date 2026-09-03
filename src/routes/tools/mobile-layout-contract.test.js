import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesDir = path.resolve('src/lib/maritools/styles');
const indexPages = readFileSync(path.join(stylesDir, 'index-pages.css'), 'utf8');
const mergedPages = readFileSync(path.join(stylesDir, 'merged-pages.css'), 'utf8');
const previewExtras = readFileSync(path.join(stylesDir, 'preview-extras.css'), 'utf8');
const toolsLayout = readFileSync(path.resolve('src/routes/tools/+layout.svelte'), 'utf8');

describe('tools mobile layout contract', () => {
	it('keeps the tools index within the page width', () => {
		expect(indexPages).toMatch(/\.mt-index-page\s*{[^}]*margin-inline:\s*0/s);
	});

	it('stacks the free-time board form below 700 pixels with a specific selector', () => {
		expect(mergedPages).toMatch(
			/@media \(max-width: 700px\)[\s\S]*?\.mt-preview \.page-free-boards > \.index-filters\s*{[^}]*grid-template-columns:\s*1fr/s
		);
	});

	it('gives mobile tools controls and dense index affordances a 44 pixel floor', () => {
		expect(mergedPages).toContain('.index-scroll-cue');
		expect(mergedPages).toMatch(/\.mt-preview \.catalog-count button[\s\S]*?min-height:\s*44px/s);
		expect(mergedPages).toMatch(/\.mt-preview \.catalog-toggle[\s\S]*?min-height:\s*44px/s);
		expect(previewExtras).toMatch(/\.mt-preview \.primary-button[\s\S]*?min-height:\s*44px/s);
		expect(previewExtras).toMatch(/\.mt-preview \.arrow-pair button[\s\S]*?min-height:\s*44px/s);
	});

	it('wraps forum thread rows and removes the desktop reply indent on mobile', () => {
		expect(mergedPages).toMatch(/\.mt-preview \.thread-header nav\s*{[^}]*flex-wrap:\s*wrap/s);
		expect(mergedPages).toMatch(/\.mt-preview \.reply-editor\s*{[^}]*margin-left:\s*0/s);
		expect(mergedPages).toMatch(
			/\.mt-preview \.post-body footer,[\s\S]*?\.mt-preview \.reply-editor footer\s*{[^}]*flex-wrap:\s*wrap/s
		);
	});

	it('keeps the closed drawer noninteractive and sizes it to the dynamic viewport', () => {
		expect(toolsLayout).toMatch(/\.tools-sidebar\s*{[^}]*height:\s*calc\(100dvh[^}]*visibility:\s*hidden[^}]*pointer-events:\s*none/s);
		expect(toolsLayout).toMatch(/\.tools-sidebar\[data-open='true'\]\s*{[^}]*visibility:\s*visible[^}]*pointer-events:\s*auto/s);
	});
});
