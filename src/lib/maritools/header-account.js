/**
 * @param {string} name
 * @returns {string}
 */
export function initialsFromDisplayName(name) {
	const parts = String(name ?? '')
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (parts.length >= 2) {
		return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
	}
	const compact = String(name ?? '')
		.trim()
		.slice(0, 2)
		.toUpperCase();
	return compact || 'AC';
}

/**
 * @param {{ email: string, profileImageUrl?: string } | null | undefined} session
 * @param {{ displayName?: string | null, profileImageDataUrl?: string | null } | null | undefined} profile
 */
export function headerAccountView(session, profile) {
	if (!session?.email) return { kind: 'signed-out' };
	const displayName = profile?.displayName?.trim() || session.email.split('@')[0] || 'Account';
	const profileImageDataUrl =
		typeof profile?.profileImageDataUrl === 'string' && profile.profileImageDataUrl.trim()
			? profile.profileImageDataUrl
			: session.profileImageUrl ?? null;
	return {
		kind: 'signed-in',
		displayName,
		initials: initialsFromDisplayName(displayName),
		...(profileImageDataUrl ? { profileImageDataUrl } : {})
	};
}
