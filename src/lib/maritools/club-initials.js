/**
 * @param {string} name
 * @returns {string}
 */
export function initialsFromClubName(name) {
	const parts = String(name ?? '')
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (parts.length >= 2) {
		return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
	}
	return String(name ?? '')
		.trim()
		.slice(0, 2)
		.toUpperCase();
}
