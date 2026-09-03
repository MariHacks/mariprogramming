import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ScheduleCalendar from './ScheduleCalendar.svelte';

afterEach(cleanup);

describe('ScheduleCalendar', () => {
	it('renders positioned events for a parsed week grid', () => {
		render(ScheduleCalendar, {
			props: {
				now: new Date(2026, 8, 8, 10, 18),
				grid: [
					{
						date: '2026-09-07',
						weekday: 'Mon',
						dayNumber: 7,
						isToday: false,
						isNoClass: false,
						outOfTerm: false,
						overlap: false,
						meetings: [
							{
								title: 'Calculus II',
								courseCode: '201-NYB-05',
								section: '00001',
								teacher: 'Teacher',
								weekday: 'Mon',
								startTime: '09:00',
								endTime: '10:30',
								classroom: 'A-301'
							}
						]
					},
					{
						date: '2026-09-08',
						weekday: 'Tue',
						dayNumber: 8,
						isToday: true,
						isNoClass: false,
						outOfTerm: false,
						overlap: false,
						meetings: []
					},
					{
						date: '2026-09-09',
						weekday: 'Wed',
						dayNumber: 9,
						isToday: false,
						isNoClass: false,
						outOfTerm: false,
						overlap: false,
						meetings: []
					},
					{
						date: '2026-09-10',
						weekday: 'Thu',
						dayNumber: 10,
						isToday: false,
						isNoClass: false,
						outOfTerm: false,
						overlap: false,
						meetings: []
					},
					{
						date: '2026-09-11',
						weekday: 'Fri',
						dayNumber: 11,
						isToday: false,
						isNoClass: false,
						outOfTerm: false,
						overlap: false,
						meetings: []
					}
				]
			}
		});

		expect(screen.getByLabelText('Weekly course schedule')).toBeInTheDocument();
		expect(screen.getByText('Calculus II')).toBeInTheDocument();
		expect(screen.getByText('201-NYB-05')).toBeInTheDocument();
		expect(screen.getByText('Today')).toBeInTheDocument();
		expect(document.querySelector('.now-line')).toBeTruthy();
	});

	it('marks a no-class day and overlapping meetings', () => {
		render(ScheduleCalendar, {
			props: {
				now: new Date(2026, 8, 8, 19, 0),
				grid: [
					{
						date: '2026-09-07',
						weekday: 'Mon',
						dayNumber: 7,
						isToday: false,
						isNoClass: true,
						outOfTerm: false,
						overlap: false,
						meetings: []
					},
					{
						date: '2026-09-08',
						weekday: 'Tue',
						dayNumber: 8,
						isToday: true,
						isNoClass: false,
						outOfTerm: false,
						overlap: true,
						meetings: [
							{
								title: 'A',
								courseCode: '201-NYA-05',
								startTime: '09:00',
								endTime: '10:30',
								classroom: 'A'
							},
							{
								title: 'B',
								courseCode: '201-NYB-05',
								startTime: '09:30',
								endTime: '11:00',
								classroom: 'B'
							}
						]
					}
				]
			}
		});
		expect(screen.getByText('No class')).toBeInTheDocument();
		expect(screen.getAllByText('Conflict')).toHaveLength(2);
		expect(document.querySelector('.now-line')).toBeNull();
	});

	it('offers a weekday-only layout without calendar dates for compact previews', () => {
		render(ScheduleCalendar, {
			props: {
				weekdayOnly: true,
				grid: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((weekday, index) => ({
					date: `2026-09-${String(index + 7).padStart(2, '0')}`,
					weekday,
					dayNumber: index + 7,
					isToday: index === 1,
					isNoClass: false,
					outOfTerm: false,
					overlap: false,
					meetings: []
				}))
			}
		});

		const calendar = screen.getByLabelText('Weekly course schedule');
		expect(calendar).toHaveClass('weekday-only');
		for (const weekday of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
			expect(screen.getByText(weekday)).toBeInTheDocument();
		}
		expect(screen.queryByText('7')).not.toBeInTheDocument();
		expect(screen.queryByText('Today')).not.toBeInTheDocument();
	});
});
