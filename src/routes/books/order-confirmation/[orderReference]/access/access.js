const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const ACCESS_PATH_PATTERN = /^(\/books\/order-confirmation\/(MPC-[A-HJ-NP-Z2-9]{12}))\/access$/u;

/**
 * @param {{
 *   location: { hash: string, pathname: string, search: string, replace: (url: string) => void },
 *   history: { replaceState: (data: unknown, unused: string, url?: string | URL | null) => void },
 *   fetchImpl?: typeof fetch
 * }} dependencies
 */
export async function openEmailedOrder({ location, history, fetchImpl = fetch }) {
	const capability = location.hash.startsWith('#') ? location.hash.slice(1) : '';
	const path = ACCESS_PATH_PATTERN.exec(location.pathname);
	if (!path || !CAPABILITY_PATTERN.test(capability)) return false;

	history.replaceState(null, '', `${location.pathname}${location.search}`);
	try {
		const response = await fetchImpl(location.pathname, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ capability })
		});
		if (!response.ok) return false;
		location.replace(path[1]);
		return true;
	} catch {
		return false;
	}
}
