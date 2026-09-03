import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import MemberPage from './+page.svelte';

afterEach(cleanup);

describe('staff member detail page', () => {
	it('shows account, signup, and parsed schedule information to staff', () => {
		render(MemberPage, {
			props: {
				data: {
					unavailable: false,
					member: {
						displayName: 'Ada',
						username: 'ada_member',
						firstName: 'Ada',
						lastName: 'Member',
						profileImageDataUrl: 'data:image/png;base64,aGVsbG8=',
						email: 'ada@gmail.com',
						studentId: '2530622',
						program: 'Science, Pure and Applied Science',
						yearLevel: 'second',
						experienceLevel: 'learning',
						interests: ['web'],
						clubGoals: 'Project nights',
						role: 'moderator',
						isMuted: true,
						mutedUntil: new Date(Date.now() + 3_600_000),
						isBanned: false,
						bannedPermanent: false,
						scheduleSharedAt: new Date(),
						scheduleInvalid: false,
						courses: [
							{
								code: '420-101',
								title: 'Programming',
								section: '1',
								meetings: [{ weekday: 'Mon', startTime: '09:00', endTime: '10:30' }]
							}
						]
					}
				}
			}
		});
		expect(screen.getByRole('heading', { name: 'Ada Member' })).toBeInTheDocument();
		expect(screen.getByText('ada@gmail.com')).toBeInTheDocument();
		expect(screen.getByText('2530622')).toBeInTheDocument();
		expect(screen.getByText('@ada_member')).toBeInTheDocument();
		expect(screen.getByText('Second year')).toBeInTheDocument();
		expect(screen.getByText('Project nights')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: "Ada Member's profile" })).toHaveAttribute(
			'src',
			'data:image/png;base64,aGVsbG8='
		);
		expect(screen.getByText('420-101: Programming')).toBeInTheDocument();
		expect(screen.getByText('Mon, 09:00 to 10:30')).toBeInTheDocument();
		expect(screen.getAllByText('Executive')).toHaveLength(2);
		expect(screen.getByRole('button', { name: 'Demote to member' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Ban' })).toBeInTheDocument();
	});

	it('opens duration dialogs and exposes promotion for a member', async () => {
		const user = userEvent.setup();
		render(MemberPage, {
			props: {
				data: {
					unavailable: false,
					member: {
						userId: 'member-1',
						displayName: 'Ada Member',
						firstName: 'Ada',
						lastName: 'Member',
						role: 'student',
						isMuted: false,
						isBanned: false,
						interests: [],
						courses: []
					}
				}
			}
		});

		expect(screen.getAllByText('Member').length).toBeGreaterThan(0);
		expect(screen.getByRole('button', { name: 'Promote to executive' })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Mute' }));
		expect(screen.getByRole('dialog', { name: 'Mute duration' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Confirm mute' })).toHaveAttribute(
			'formaction',
			'?/mute'
		);
	});

	it('does not render controls for a protected account', () => {
		render(MemberPage, {
			props: {
				data: {
					unavailable: false,
					member: {
						displayName: 'Protected Account',
						firstName: 'Protected',
						lastName: 'Account',
						role: 'staff',
						interests: [],
						courses: []
					}
				}
			}
		});

		expect(screen.getByText('This protected account cannot be changed.')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Ban' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /executive/iu })).not.toBeInTheDocument();
	});
});
