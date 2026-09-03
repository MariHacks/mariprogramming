/** @param {unknown} value @returns {string | null} */
export function googleProfileImageUrl(value) {
	if (typeof value !== 'string' || value.length > 2048) return null;
	try {
		const url = new URL(value);
		if (
			url.protocol !== 'https:' ||
			!/^lh\d+\.googleusercontent\.com$/u.test(url.hostname) ||
			url.username ||
			url.password ||
			url.port
		)
			return null;
		return url.href;
	} catch {
		return null;
	}
}
