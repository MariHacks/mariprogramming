export const PYODIDE_ORIGIN = 'https://cdn.jsdelivr.net';
export const PYODIDE_VERSION = '0.27.5';
export const PYODIDE_INDEX_URL = `${PYODIDE_ORIGIN}/pyodide/v${PYODIDE_VERSION}/full/`;

const PBL_CSP_EXTRAS = Object.freeze({
	'script-src': Object.freeze(["'wasm-unsafe-eval'", PYODIDE_ORIGIN]),
	'connect-src': Object.freeze([PYODIDE_ORIGIN]),
	'worker-src': Object.freeze(["'self'", 'blob:', PYODIDE_ORIGIN]),
	// CodeMirror injects <style> tags; Firefox also rejects unknown wasm-src.
	'style-src': Object.freeze(["'unsafe-inline'"])
});

/** @param {unknown} pathname */
export function isPblDocumentPath(pathname) {
	if (typeof pathname !== 'string') return false;
	return pathname === '/pbl' || pathname.startsWith('/pbl/');
}

/** @param {unknown} pathname */
export function isPblStudioPath(pathname) {
	if (typeof pathname !== 'string') return false;
	const parts = pathname.split('/').filter(Boolean);
	return parts[0] === 'pbl' && parts.length >= 3;
}

/** @param {string} policy @param {string} name @param {readonly string[]} values */
function withDirective(policy, name, values) {
	const pattern = new RegExp(`(^|;\\s*)${name}\\s+([^;]+)`, 'u');
	const match = pattern.exec(policy);
	if (!match) {
		const trimmed = policy.replace(/;?\s*$/u, '');
		return `${trimmed}; ${name} ${values.join(' ')}`;
	}
	const existing = match[2];
	const missing = values.filter((value) => !existing.split(/\s+/u).includes(value));
	if (missing.length === 0) return policy;
	return `${policy.slice(0, match.index)}${match[1]}${name} ${existing} ${missing.join(' ')}${policy.slice(match.index + match[0].length)}`;
}

/** @param {unknown} policy */
export function expandPblCsp(policy) {
	if (typeof policy !== 'string' || policy.length === 0) return policy;
	let next = policy;
	for (const [name, values] of Object.entries(PBL_CSP_EXTRAS)) {
		next = withDirective(next, name, values);
	}
	return next;
}

/** @param {string} html */
export function expandPblCspInHtml(html) {
	return html.replace(
		/(http-equiv="content-security-policy" content=")([^"]*)(")/giu,
		(_full, prefix, policy, suffix) => `${prefix}${expandPblCsp(policy)}${suffix}`
	);
}

/** @param {Response} response */
export function applyPblCspHeader(response) {
	const policy = response.headers.get('content-security-policy');
	if (!policy) return response;
	const headers = new Headers(response.headers);
	headers.set('content-security-policy', expandPblCsp(policy));
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
