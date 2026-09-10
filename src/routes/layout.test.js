import { describe, expect, it } from 'vitest';
import layoutSource from './+layout.svelte?raw';

describe('root route chrome boundary', () => {
	it('keeps the skip target but suppresses public chrome throughout staff routes', () => {
		expect(layoutSource).toContain("pathname === '/staff' || pathname.startsWith('/staff/')");
		expect(layoutSource).toContain('isPblDocumentPath');
		expect(layoutSource).toContain('compactPbl={isPblRoute}');
		expect(layoutSource).toMatch(
			/\{#if !isStaffRoute\}<SiteHeader[\s\S]*?compactPbl=\{isPblRoute\}[\s\S]*?headerAccount=\{data\.headerAccount\}[\s\S]*?\{\/if\}/u
		);
		expect(layoutSource).toContain('{#if !isStaffRoute && !isPblStudio}<SiteFooter />{/if}');
		expect(layoutSource).toContain('<main id="main-content" tabindex="-1">');
	});
});
