import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ScheduleCalendar from './ScheduleCalendar.svelte';

afterEach(cleanup);

describe('ScheduleCalendar', () => {
	it('renders positioned events for a parsed week grid', () => {
		render(ScheduleCalendar, {
			props: {
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
	});
});
