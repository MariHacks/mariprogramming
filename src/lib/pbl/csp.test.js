import { describe, expect, it } from 'vitest';
import {
	PYODIDE_INDEX_URL,
	applyPblCspHeader,
	expandPblCsp,
	expandPblCspInHtml,
	isPblDocumentPath,
	isPblStudioPath
} from './csp.js';

const BASE = "default-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self'";

describe('PBL Python CSP', () => {
	it('identifies workshop documents and studio routes', () => {
		expect(isPblDocumentPath('/pbl')).toBe(true);
		expect(isPblDocumentPath('/pbl/science')).toBe(true);
		expect(isPblDocumentPath('/our-workshops')).toBe(false);
		expect(isPblDocumentPath('/api/pbl/rooms')).toBe(false);
		expect(isPblStudioPath('/pbl/science/AB23JK')).toBe(true);
		expect(isPblStudioPath('/pbl/science/AB23JK/facilitator')).toBe(true);
		expect(isPblStudioPath('/pbl/science')).toBe(false);
		expect(isPblStudioPath('/pbl')).toBe(false);
		expect(isPblDocumentPath(null)).toBe(false);
		expect(isPblStudioPath(null)).toBe(false);
	});

	it('adds Pyodide sources without rewriting the rest of the site policy', () => {
		const expanded = expandPblCsp(BASE);
		expect(expanded).toContain("'wasm-unsafe-eval'");
		expect(expanded).toContain('https://cdn.jsdelivr.net');
		expect(expanded).toContain('blob:');
		expect(expanded).toMatch(/worker-src[^;]*https:\/\/cdn\.jsdelivr\.net/u);
		expect(expandPblCsp(expanded)).toBe(expanded);
		expect(expandPblCsp('')).toBe('');
		expect(PYODIDE_INDEX_URL).toContain('/pyodide/v0.27.5/full/');
		expect(
			expandPblCspInHtml(`<meta http-equiv="content-security-policy" content="${BASE}">`)
		).toContain('wasm-unsafe-eval');
	});

	it('copies response headers when a Content-Security-Policy is present', async () => {
		const original = new Response('ok', {
			headers: { 'content-security-policy': BASE, 'x-test': 'kept' }
		});
		const updated = applyPblCspHeader(original);
		expect(updated.headers.get('x-test')).toBe('kept');
		expect(updated.headers.get('content-security-policy')).toContain('wasm-unsafe-eval');
		expect(await updated.text()).toBe('ok');
		const plain = new Response('plain');
		expect(applyPblCspHeader(plain)).toBe(plain);
	});
});
