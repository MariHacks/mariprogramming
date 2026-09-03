/** @typedef {{ type?: string, label?: string, url?: string }} ClubLink */
/** @typedef {{ name?: string, slug?: string, category?: string | null, description?: string | null, links?: ClubLink[], submitterRole?: string }} ClubListingPayload */

export const CLUB_SUBMITTER_ROLES = [
	{ value: 'officer', label: 'Officer or organizer' },
	{ value: 'member', label: 'Member' },
	{ value: 'friend', label: 'Submitting for a friend' },
	{ value: 'correction', label: 'Correcting an existing listing' }
];

export const CLUB_CATEGORIES = [
	'Academic',
	'Arts and culture',
	'Community service',
	'Games and recreation',
	'Health and wellness',
	'Sports',
	'Technology',
	'Other'
];

export const CLUB_CONTACT_TYPES = [
	{ value: 'email', label: 'Email' },
	{ value: 'website', label: 'Website' },
	{ value: 'mio', label: 'MIO' },
	{ value: 'discord', label: 'Discord' },
	{ value: 'instagram', label: 'Instagram' },
	{ value: 'custom', label: 'Custom' }
];

const ROLE_VALUES = new Set(CLUB_SUBMITTER_ROLES.map((role) => role.value));
const CONTACT_TYPE_VALUES = new Set(CLUB_CONTACT_TYPES.map((type) => type.value));

/** @param {unknown} value */
export function normalizeContactType(value) {
	const type = String(value ?? '')
		.trim()
		.toLowerCase();
	return CONTACT_TYPE_VALUES.has(type) ? type : 'custom';
}

/** @param {unknown} value @param {unknown} type */
export function contactValueForInput(value, type) {
	const text = String(value ?? '');
	return normalizeContactType(type) === 'email' || normalizeContactType(type) === 'mio'
		? text.replace(/^mailto:/i, '')
		: text;
}

/** @param {ClubLink} link */
export function normalizeClubLink(link) {
	const type = normalizeContactType(link.type);
	const rawUrl = String(link.url ?? '').trim();
	if (!rawUrl) return null;
	const defaultLabel = CLUB_CONTACT_TYPES.find((option) => option.value === type)?.label ?? 'Link';
	const label = String(link.label ?? '').trim() || defaultLabel;
	if (type === 'email' || type === 'mio') {
		return { type, label, url: /^mailto:/i.test(rawUrl) ? rawUrl : `mailto:${rawUrl}` };
	}
	const url = /^[a-z][a-z\d+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
	if (!/^https?:\/\//i.test(url)) return null;
	return { type, label, url };
}

/** @param {ClubLink[]} links @returns {ClubLink[]} */
function normalizeClubLinks(links) {
	/** @type {ClubLink[]} */
	const normalizedLinks = [];
	for (const link of links) {
		const normalized = normalizeClubLink(link);
		if (normalized) normalizedLinks.push(normalized);
	}
	return normalizedLinks;
}

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
 * @param {{ name?: string, slug?: string, category?: string, description?: string, links?: ClubLink[], linkLabel?: string, linkUrl?: string, submitterRole?: string | null }} patch
 */
export function buildClubSubmissionPayload(existing, patch) {
	const base = clubListingFromPayload(existing);
	const name = patch.name !== undefined ? String(patch.name).trim() : base.name;
	const slug = patch.slug !== undefined ? String(patch.slug).trim() : base.slug;
	const category = patch.category !== undefined ? String(patch.category).trim() : base.category;
	const description =
		patch.description !== undefined ? String(patch.description).trim() : base.description;
	const links =
		patch.links !== undefined
			? normalizeClubLinks(patch.links)
			: patch.linkUrl !== undefined
				? String(patch.linkUrl).trim()
					? [
							{
								label: String(patch.linkLabel ?? '').trim() || 'Website',
								url: String(patch.linkUrl).trim()
							}
						]
					: []
				: base.links;
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
		links,
		...(role ? { submitterRole: role } : {})
	};
	return payload;
}
