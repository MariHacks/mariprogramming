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
						weekday: 'Mon',
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
					{ weekday: 'Tue', overlap: false, meetings: [] },
					{ weekday: 'Wed', overlap: false, meetings: [] },
					{ weekday: 'Thu', overlap: false, meetings: [] },
					{ weekday: 'Fri', overlap: false, meetings: [] }
				]
			}
		});

		expect(screen.getByLabelText('Weekly course schedule')).toBeInTheDocument();
		expect(screen.getByText('Calculus II')).toBeInTheDocument();
		expect(screen.getByText('201-NYB-05')).toBeInTheDocument();
	});
});
