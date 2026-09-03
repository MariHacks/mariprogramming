import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
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
	});
});
