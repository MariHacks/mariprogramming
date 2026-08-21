/** @typedef {'inquiry' | 'bug'} ClubContactIntent */

export const CLUB_TEAM_EMAIL = 'team@marihacks.com';

const CONTACT_SUBJECTS = Object.freeze({
	inquiry: 'Programming Club inquiry',
	bug: 'Programming Club bug report'
});

/**
 * @param {unknown} intent
 * @returns {string}
 */
export function clubContactMailto(intent) {
	if (intent !== 'inquiry' && intent !== 'bug') {
		throw new Error('Contact intent is invalid');
	}
	return `mailto:${CLUB_TEAM_EMAIL}?subject=${encodeURIComponent(CONTACT_SUBJECTS[intent])}`;
}

export function createClubContactLinks() {
	return Object.freeze({
		inquiry: Object.freeze({
			label: 'Email the team',
			href: clubContactMailto('inquiry'),
			rel: 'external'
		}),
		bug: Object.freeze({
			label: 'Report a bug',
			href: clubContactMailto('bug'),
			rel: 'external'
		})
	});
}
