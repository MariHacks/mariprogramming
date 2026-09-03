import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import MembersPage from './+page.svelte';

afterEach(cleanup);

describe('staff members page', () => {
	it('shows the staff-only roster and class-free counts', () => {
		render(MembersPage, {
			props: {
				data: {
					unavailable: false,
					availability: {
						denominator: 2,
						invalidScheduleCount: 1,
						cells: [
							{ weekday: 'Mon', time: '08:00', freeCount: 2 },
							{ weekday: 'Tue', time: '08:00', freeCount: 1 }
						]
					},
					listing: {
						rows: [
							{
								userId: 'member-1',
								displayName: 'Ada',
								program: 'Computer Science',
								scheduleSharedAt: new Date()
							}
						],
						totalCount: 27,
						query: ''
					}
				}
			}
		});
		expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
		expect(screen.getByText('27 members')).toBeInTheDocument();
		expect(screen.getByLabelText('Search members')).toBeInTheDocument();
		expect(
			screen.getByRole('table', { name: 'Members without class at each time' })
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Ada' })).toHaveAttribute(
			'href',
			'/staff/members/member-1'
		);
	});

	it('links to adjacent roster pages while preserving the search query', () => {
		render(MembersPage, {
			props: {
				data: {
					unavailable: false,
					availability: { denominator: 0, invalidScheduleCount: 0, cells: [] },
					listing: {
						rows: [{ userId: 'member-26', displayName: 'Ada', program: 'Science' }],
						totalCount: 70,
						query: 'Ada Lovelace',
						page: 2,
						pageSize: 25
					}
				}
			}
		});

		expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
			'href',
			'/staff/members?q=Ada+Lovelace&page=1'
		);
		expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
			'href',
			'/staff/members?q=Ada+Lovelace&page=3'
		);
	});
});
