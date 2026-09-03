import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CalendarExportModal from './CalendarExportModal.svelte';

afterEach(() => cleanup());

describe('CalendarExportModal', () => {
	it('gates guests to .ics download without a Connect CTA', () => {
		render(CalendarExportModal, {
			props: {
				open: true,
				signedIn: false,
				googleCalendarConnected: false
			}
		});
		expect(screen.getByRole('button', { name: 'Download for Google Calendar' })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Connect Google Calendar' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Push to Google Calendar' })).not.toBeInTheDocument();
	});

	it('offers Connect Google Calendar when signed in without a grant', () => {
		render(CalendarExportModal, {
			props: {
				open: true,
				signedIn: true,
				googleCalendarConnected: false,
				connectHref: '/tools/schedule/google-calendar/connect'
			}
		});
		expect(screen.getByRole('link', { name: 'Connect Google Calendar' })).toHaveAttribute(
			'href',
			'/tools/schedule/google-calendar/connect'
		);
		expect(screen.getByRole('button', { name: 'Download for Google Calendar' })).toBeInTheDocument();
	});

	it('shows the push slot when Google Calendar is connected', () => {
		render(CalendarExportModal, {
			props: {
				open: true,
				signedIn: true,
				googleCalendarConnected: true,
				pushTermId: 'fall-2026'
			}
		});
		expect(screen.queryByRole('link', { name: 'Connect Google Calendar' })).not.toBeInTheDocument();
		expect(screen.getByText(/Push this semester into Google Calendar/i)).toBeInTheDocument();
	});
});
