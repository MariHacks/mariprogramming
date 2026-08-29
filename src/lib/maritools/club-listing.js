/** @typedef {{ label?: string, url?: string }} ClubLink */
/** @typedef {{ name?: string, slug?: string, category?: string | null, description?: string | null, links?: ClubLink[], submitterRole?: string }} ClubListingPayload */

export const CLUB_SUBMITTER_ROLES = [
	{ value: 'officer', label: 'Officer or organizer' },
	{ value: 'member', label: 'Member' },
	{ value: 'friend', label: 'Submitting for a friend' },
	{ value: 'correction', label: 'Correcting an existing listing' }
];

const ROLE_VALUES = new Set(CLUB_SUBMITTER_ROLES.map((role) => role.value));

/** @param {unknown} value */
export function normalizeSubmitterRole(value) {
	const role = String(value ?? '').trim();
	return ROLE_VALUES.has(role) ? role : null;
}

/** @param {ClubListingPayload | null | undefined} payload */
export function clubListingFromPayload(payload) {
	const raw = payload && typeof payload === 'object' ? payload : {};
	return {
		name: String(raw.name ?? '').trim(),
		slug: String(raw.slug ?? '').trim(),
		category: String(raw.category ?? '').trim(),
		description: String(raw.description ?? '').trim(),
		links: Array.isArray(raw.links) ? raw.links : []
	};
}

/**
 * Club page fields plus optional submitter role for pending rows.
 * Role stays off published club rows.
 * @param {{ id: string, status?: string, submitterUserId?: string | null, payload?: ClubListingPayload | null }} row
 */
export function clubSubmissionView(row) {
	const listing = clubListingFromPayload(row.payload);
	return {
		id: row.id,
		status: row.status ?? 'pending',
		submitterUserId: row.submitterUserId ?? null,
		submitterRole: normalizeSubmitterRole(row.payload?.submitterRole),
		name: listing.name,
		slug: listing.slug,
		category: listing.category,
		description: listing.description,
		links: listing.links
	};
}

/** @param {ClubLink} link */
export function formatClubLinkLabel(link) {
	const label = String(link.label ?? '').trim();
	if (label) return `${label} ↗`;
	return `${link.url ?? 'Open link'} ↗`;
}

/** @param {{ links?: ClubLink[] }} club */
export function joinLinkFromClub(club) {
	const links = Array.isArray(club.links) ? club.links : [];
	return (
		links.find((link) =>
			/join|sign\s?up|form|register/i.test(`${link.label ?? ''} ${link.url ?? ''}`)
		) ?? null
	);
}

/**
 * @param {ClubListingPayload | null | undefined} existing
 * @param {{ name?: string, slug?: string, category?: string, description?: string, linkLabel?: string, linkUrl?: string, submitterRole?: string | null }} patch
 */
export function buildClubSubmissionPayload(existing, patch) {
	const base = clubListingFromPayload(existing);
	const name = patch.name !== undefined ? String(patch.name).trim() : base.name;
	const slug = patch.slug !== undefined ? String(patch.slug).trim() : base.slug;
	const category = patch.category !== undefined ? String(patch.category).trim() : base.category;
	const description =
		patch.description !== undefined ? String(patch.description).trim() : base.description;
	const linkUrl =
		patch.linkUrl !== undefined ? String(patch.linkUrl).trim() : (base.links[0]?.url ?? '');
	const linkLabel =
		patch.linkLabel !== undefined
			? String(patch.linkLabel).trim()
			: (base.links[0]?.label ?? '');
	const role =
		patch.submitterRole !== undefined
			? normalizeSubmitterRole(patch.submitterRole)
			: normalizeSubmitterRole(existing?.submitterRole);

	/** @type {ClubListingPayload} */
	const payload = {
		name,
		...(slug ? { slug } : {}),
		...(category ? { category } : {}),
		...(description ? { description } : {}),
		...(linkUrl ? { links: [{ label: linkLabel || 'Website', url: linkUrl }] } : { links: [] }),
		...(role ? { submitterRole: role } : {})
	};
	return payload;
}
