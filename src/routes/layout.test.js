import { describe, expect, it } from 'vitest';
import layoutSource from './+layout.svelte?raw';

describe('root route chrome boundary', () => {
	it('keeps the skip target but suppresses public chrome throughout staff routes', () => {
		expect(layoutSource).toContain("pathname === '/staff' || pathname.startsWith('/staff/')");
		expect(layoutSource).toContain('{#if !isStaffRoute}<SiteHeader {pathname} headerAccount={data.headerAccount} />{/if}');
		expect(layoutSource).toContain('{#if !isStaffRoute && !isPblStudio}<SiteFooter />{/if}');
		expect(layoutSource).toContain('<main id="main-content" tabindex="-1">');
	});
});
