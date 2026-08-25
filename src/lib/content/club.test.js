import { describe, expect, it } from 'vitest';
import { clubContent, getUpcomingEvents, getWorkshopTracks, isExternalSignupUrl } from './club';

describe('club destinations', () => {
	it('publishes the team mailbox for public contact', () => {
		expect(clubContent.contactEmail).toBe('team@marihacks.com');
	});

	it('describes beginner access in a complete metadata sentence', () => {
		expect(clubContent.mission).toBe(
			'Learn programming with other Marianopolis students. You do not need programming experience to join.'
		);
	});

	it('routes sign up to MariTools account creation', () => {
		expect(clubContent.signupUrl).toBe('/tools/account');
		expect(isExternalSignupUrl()).toBe(false);
		expect(isExternalSignupUrl('https://example.com')).toBe(true);
	});

	it('includes the verified Instagram and Discord metadata', () => {
		expect(clubContent.socialLinks).toEqual(
			expect.arrayContaining([
				{
					label: 'Instagram',
					url: 'https://www.instagram.com/mari_programming_club/',
					icon: '/socials/instagram.svg'
				},
				{
					label: 'Discord',
					url: 'https://discord.gg/c6JJw9d',
					icon: '/socials/discord.svg'
				}
			])
		);
	});
});

describe('club resources', () => {
	it('keeps a useful description for every resource group', () => {
		expect(clubContent.resources.map(({ id, description }) => ({ id, description }))).toEqual([
			{
				id: 'guided-learning',
				description: 'Follow a structured course when you want a clear place to begin.'
			},
			{
				id: 'web-development',
				description: 'Learn web development by creating complete, practical projects.'
			},
			{
				id: 'problem-solving',
				description: 'Strengthen algorithms and implementation skills with focused challenges.'
			},
			{
				id: 'video-and-community',
				description: 'Use focused video guides, then research questions when you get stuck.'
			}
		]);
	});
});

describe('getUpcomingEvents', () => {
	it('excludes an event that has already started', () => {
		const events = [{ id: 'old', startsAt: '2024-08-19T09:00:00-04:00' }];

		expect(getUpcomingEvents(events, new Date('2026-08-01T12:00:00-04:00'))).toEqual([]);
	});

	it('keeps an event that starts at or after the cutoff', () => {
		const events = [
			{ id: 'now', startsAt: '2026-08-01T12:00:00-04:00' },
			{ id: 'next', startsAt: '2026-08-02T09:00:00-04:00' }
		];

		expect(getUpcomingEvents(events, new Date('2026-08-01T12:00:00-04:00'))).toEqual(events);
	});
});

describe('getWorkshopTracks', () => {
	it('groups workshops by their named learning track', () => {
		const pythonIntro = { id: 'python-1', track: 'Python foundations' };
		const webIntro = { id: 'web-1', track: 'Web development' };
		const pythonFunctions = { id: 'python-2', track: 'Python foundations' };

		expect(getWorkshopTracks([pythonIntro, webIntro, pythonFunctions])).toEqual({
			'Python foundations': [pythonIntro, pythonFunctions],
			'Web development': [webIntro]
		});
	});
});
