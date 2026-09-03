// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
	CLUB_SUBMITTER_ROLES,
	buildClubSubmissionPayload,
	clubListingFromPayload,
	clubSubmissionView,
	contactValueForInput,
	formatClubLinkLabel,
	joinLinkFromClub,
	normalizeSubmitterRole
} from './club-listing.js';

describe('club listing helpers', () => {
	it('normalizes known submitter roles only', () => {
		expect(normalizeSubmitterRole('officer')).toBe('officer');
		expect(normalizeSubmitterRole(' stranger ')).toBeNull();
		expect(CLUB_SUBMITTER_ROLES.map((role) => role.value)).toContain('member');
	});

	it('strips submitterRole from the public listing shape', () => {
		expect(
			clubListingFromPayload({
				name: 'Chess',
				slug: 'chess',
				category: 'games',
				description: 'Play',
				links: [{ label: 'Site', url: 'https://example.com' }],
				submitterRole: 'officer'
			})
		).toEqual({
			name: 'Chess',
			slug: 'chess',
			category: 'games',
			description: 'Play',
			links: [{ label: 'Site', url: 'https://example.com' }]
		});
		expect(clubListingFromPayload(null)).toEqual({
			name: '',
			slug: '',
			category: '',
			description: '',
			links: []
		});
	});

	it('builds a submission view with role kept beside listing fields', () => {
		expect(
			clubSubmissionView({
				id: 'sub-1',
				status: 'pending',
				submitterUserId: 'user-1',
				payload: {
					name: 'Chess',
					slug: 'chess',
					submitterRole: 'member'
				}
			})
		).toEqual({
			id: 'sub-1',
			status: 'pending',
			submitterUserId: 'user-1',
			submitterRole: 'member',
			name: 'Chess',
			slug: 'chess',
			category: '',
			description: '',
			links: []
		});
	});

	it('formats links and finds a join CTA', () => {
		expect(formatClubLinkLabel({ label: 'Discord', url: 'https://example.com' })).toBe('Discord ↗');
		expect(formatClubLinkLabel({ url: 'https://example.com/join' })).toBe(
			'https://example.com/join ↗'
		);
		expect(
			joinLinkFromClub({
				links: [
					{ label: 'Site', url: 'https://example.com' },
					{ label: 'Join form', url: 'https://example.com/join' }
				]
			})?.url
		).toBe('https://example.com/join');
		expect(joinLinkFromClub({ links: [] })).toBeNull();
	});

	it('merges edits without dropping the submitter role', () => {
		expect(
			buildClubSubmissionPayload(
				{ name: 'Chess', slug: 'chess', submitterRole: 'officer' },
				{ description: 'Play weekly', linkUrl: 'https://example.com', linkLabel: 'Site' }
			)
		).toEqual({
			name: 'Chess',
			slug: 'chess',
			description: 'Play weekly',
			links: [{ label: 'Site', url: 'https://example.com' }],
			submitterRole: 'officer'
		});
	});

	it('keeps several typed contact methods and drops empty rows', () => {
		expect(
			buildClubSubmissionPayload(
				{ name: 'Chess', submitterRole: 'member' },
				{
					links: [
						{ type: 'email', label: 'Email', url: 'mailto:chess@example.com' },
						{ type: 'discord', label: 'Discord', url: 'https://discord.gg/chess' },
						{ type: 'custom', label: 'Linktree', url: 'https://linktr.ee/chess' },
						{ type: 'website', label: 'Website', url: '' }
					]
				}
			)
		).toMatchObject({
			links: [
				{ type: 'email', label: 'Email', url: 'mailto:chess@example.com' },
				{ type: 'discord', label: 'Discord', url: 'https://discord.gg/chess' },
				{ type: 'custom', label: 'Linktree', url: 'https://linktr.ee/chess' }
			]
		});
	});

	it('only removes mailto from address-based contact inputs', () => {
		expect(contactValueForInput('mailto:club@example.com', 'email')).toBe('club@example.com');
		expect(contactValueForInput('mailto:club@example.com', 'custom')).toBe(
			'mailto:club@example.com'
		);
	});
});
