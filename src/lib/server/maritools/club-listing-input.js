import {
	CLUB_CATEGORIES,
	CLUB_CONTACT_TYPES,
	buildClubSubmissionPayload,
	normalizeSubmitterRole
} from '$lib/maritools/club-listing.js';
import { slugFromName } from '$lib/server/maritools/community-store.js';

const CONTACT_TYPES = new Set(CLUB_CONTACT_TYPES.map((option) => option.value));
const CATEGORIES = new Set(CLUB_CATEGORIES);

/** @param {FormData} data */
export function clubListingDraft(data) {
	const types = data.getAll('contactType').map(String);
	const labels = data.getAll('contactLabel').map(String);
	const values = data.getAll('contactValue').map(String);
	return {
		name: String(data.get('name') ?? ''),
		category: String(data.get('category') ?? ''),
		description: String(data.get('description') ?? ''),
		submitterRole: String(data.get('submitterRole') ?? ''),
		links: values.map((url, index) => ({
			type: types[index] ?? 'custom',
			label: labels[index] ?? '',
			url
		}))
	};
}

/** @param {FormData} data @param {{ slug?: string, category?: string | null, submitterRole?: string | null }} [existing] */
export function clubListingInput(data, existing = {}) {
	const name = String(data.get('name') ?? '').trim();
	const category = String(
		data.has('category') ? data.get('category') : (existing.category ?? '')
	).trim();
	const description = String(data.get('description') ?? '').trim();
	const submitterRole = normalizeSubmitterRole(
		data.has('submitterRole') ? data.get('submitterRole') : existing.submitterRole
	);
	if (!name || name.length > 160) return { error: 'Enter the club name.' };
	if (!submitterRole) return { error: 'Choose your role in this club.' };
	const existingCategory = String(existing.category ?? '').trim();
	if (
		!category ||
		category.length > 80 ||
		(!CATEGORIES.has(category) && category !== existingCategory)
	) {
		return { error: 'Choose a category.' };
	}
	if (description.length > 4000)
		return { error: 'Keep the club description under 4,000 characters.' };

	const types = data.getAll('contactType').map(String);
	const labels = data.getAll('contactLabel').map(String);
	const values = data.getAll('contactValue').map(String);
	if (types.length === 0 && data.has('linkUrl')) {
		types.push('custom');
		labels.push(String(data.get('linkLabel') ?? ''));
		values.push(String(data.get('linkUrl') ?? ''));
	}
	if (types.length !== labels.length || types.length !== values.length || types.length > 8) {
		return { error: 'Check the contact methods and try again.' };
	}
	const links = [];
	for (let index = 0; index < types.length; index += 1) {
		const type = types[index].trim().toLowerCase();
		const label = labels[index].trim();
		const value = values[index].trim();
		if (!CONTACT_TYPES.has(type) || label.length > 80 || value.length > 500) {
			return { error: 'Check the contact methods and try again.' };
		}
		if (!value) continue;
		if ((type === 'email' || type === 'mio') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
			return { error: `Enter a valid ${type === 'mio' ? 'MIO' : 'email'} address.` };
		}
		if (!['email', 'mio'].includes(type)) {
			try {
				const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
				if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
			} catch {
				return { error: 'Enter valid web links for each contact method.' };
			}
		}
		links.push({ type, label, url: value });
	}

	const slug = slugFromName(name) || String(existing.slug ?? '');
	if (!slug) return { error: 'Enter a club name we can use in a page link.' };
	return {
		payload: buildClubSubmissionPayload(null, {
			name,
			slug,
			category,
			description,
			submitterRole,
			links
		})
	};
}
