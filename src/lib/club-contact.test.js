import { describe, expect, it } from 'vitest';
import { CLUB_TEAM_EMAIL, clubContactMailto, createClubContactLinks } from './club-contact.js';

describe('club contact', () => {
	it('keeps the public team mailbox as a mailto constant', () => {
		expect(CLUB_TEAM_EMAIL).toBe('team@marihacks.com');
	});

	it('builds distinct inquiry and bug mailto hrefs', () => {
		expect(clubContactMailto('inquiry')).toBe(
			'mailto:team@marihacks.com?subject=Programming%20Club%20inquiry'
		);
		expect(clubContactMailto('bug')).toBe(
			'mailto:team@marihacks.com?subject=Programming%20Club%20bug%20report'
		);
	});

	it.each([null, '', 'support', 'Inquiry'])('rejects an unknown intent %j', (intent) => {
		expect(() => clubContactMailto(intent)).toThrow('Contact intent is invalid');
	});

	it('returns frozen labeled links for pages that render contact without JavaScript', () => {
		const links = createClubContactLinks();
		expect(links.inquiry).toEqual({
			label: 'Email the team',
			href: 'mailto:team@marihacks.com?subject=Programming%20Club%20inquiry'
		});
		expect(links.bug).toEqual({
			label: 'Report a bug',
			href: 'mailto:team@marihacks.com?subject=Programming%20Club%20bug%20report'
		});
		expect(Object.isFrozen(links)).toBe(true);
		expect(Object.isFrozen(links.inquiry)).toBe(true);
		expect(Object.isFrozen(links.bug)).toBe(true);
	});
});
