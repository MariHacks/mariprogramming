import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import { explicitTermId } from '$lib/maritools/term/session.js';
import SchedulePage from './+page.svelte';

vi.mock('$app/environment', () => ({ browser: false }));

const defaultData = {
	signedIn: false,
	googleCalendarConnected: false,
	gcalStatus: null
};

afterEach(() => {
	cleanup();
	explicitTermId.set(null);
});

describe('My schedule', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => '1'),
			setItem: vi.fn(),
			removeItem: vi.fn()
		});
	});

	it('opens the Omnivox tutorial from the import drawer helper', () => {
		render(SchedulePage, { props: { data: defaultData } });
		fireEvent.click(screen.getAllByRole('button', { name: 'Import Omnivox' })[0]);
		fireEvent.click(screen.getByRole('button', { name: 'Show tutorial again' }));
		expect(screen.getByRole('heading', { name: 'Open Omnivox' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Compact list' })).toBeInTheDocument();
		expect(screen.queryByText(/scribe/i)).not.toBeInTheDocument();
	});

	it('shows a clear empty-state CTA before any paste', () => {
		render(SchedulePage, { props: { data: defaultData } });
		expect(screen.getByText('Import your Omnivox schedule')).toBeInTheDocument();
		expect(
			screen.getByText(/Paste the compact numbered course list to fill this week view/)
		).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Import Omnivox' }).length).toBeGreaterThan(0);
	});

	it('reads the canonical paste into a positioned calendar', () => {
		render(SchedulePage, { props: { data: defaultData } });
		fireEvent.click(screen.getAllByRole('button', { name: 'Import Omnivox' })[0]);
		fireEvent.input(screen.getByLabelText('Omnivox course list'), {
			target: { value: CANONICAL_OMNIVOX_SCHEDULE }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Read schedule' }));
		expect(screen.getByLabelText('Weekly course schedule')).toBeInTheDocument();
		expect(screen.getByText('Badminton and Conditioning')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add to Google Calendar' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Week of January 20');
		expect(screen.getByText('7 classes detected')).toHaveClass('parse-count');
	});

	it('keeps the import drawer open after a successful parse so the green count stays visible', () => {
		const { container } = render(SchedulePage, { props: { data: defaultData } });
		fireEvent.click(screen.getAllByRole('button', { name: 'Import Omnivox' })[0]);
		fireEvent.input(screen.getByLabelText('Omnivox course list'), {
			target: { value: CANONICAL_OMNIVOX_SCHEDULE }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Read schedule' }));
		expect(container.querySelector('.schedule-stage')?.classList.contains('drawer-hidden')).toBe(
			false
		);
		expect(screen.getByText('7 classes detected')).toBeVisible();
	});

	it('warns when a student number is in the paste', () => {
		render(SchedulePage, { props: { data: defaultData } });
		fireEvent.click(screen.getAllByRole('button', { name: 'Import Omnivox' })[0]);
		fireEvent.input(screen.getByLabelText('Omnivox course list'), {
			target: { value: `Zhi Cheng Ma - 2530622\n${CANONICAL_OMNIVOX_SCHEDULE}` }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Read schedule' }));
		expect(
			screen.getByText(
				'That paste looks like it includes a student number. Copy only the numbered course list on the right, and leave the student number out.'
			)
		).toBeInTheDocument();
	});
});
