import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import { explicitTermId } from '$lib/maritools/term/session.js';
import SchedulePage from './+page.svelte';

vi.mock('$app/environment', () => ({ browser: true }));

const defaultData = {
	signedIn: false,
	googleCalendarConnected: false,
	gcalStatus: null,
	savedPaste: ''
};

afterEach(() => {
	cleanup();
	explicitTermId.set(null);
	vi.unstubAllGlobals();
});

describe('My schedule', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn((key) => (String(key).includes('tutorial') ? '1' : null)),
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

	it('restores a signed-in schedule from account data', () => {
		render(SchedulePage, {
			props: {
				data: { ...defaultData, signedIn: true, savedPaste: CANONICAL_OMNIVOX_SCHEDULE }
			}
		});

		expect(screen.getByLabelText('Weekly course schedule')).toBeInTheDocument();
		expect(screen.getByText('Badminton and Conditioning')).toBeInTheDocument();
		expect(screen.getByText('7 classes detected')).toBeInTheDocument();
		expect(
			screen.queryByRole('heading', { name: 'Programming Club meeting planning' })
		).not.toBeInTheDocument();
		expect(
			screen.queryByText('Imported schedules are available to club staff.')
		).not.toBeInTheDocument();
		expect(
			screen.queryByText(/Staff use class times to find meeting times/u)
		).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
	});

	it('does not offer a schedule-sharing choice', () => {
		render(SchedulePage, {
			props: {
				data: {
					...defaultData,
					signedIn: true,
					savedPaste: CANONICAL_OMNIVOX_SCHEDULE
				}
			}
		});
		expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /stop sharing/i })).not.toBeInTheDocument();
		expect(screen.getByLabelText('Weekly course schedule')).toBeInTheDocument();
	});

	it('sends a valid signed-in schedule to account persistence', async () => {
		const fetch = vi.fn(async () => ({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		render(SchedulePage, { props: { data: { ...defaultData, signedIn: true } } });
		fireEvent.click(screen.getAllByRole('button', { name: 'Import Omnivox' })[0]);
		fireEvent.input(screen.getByLabelText('Omnivox course list'), {
			target: { value: CANONICAL_OMNIVOX_SCHEDULE }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Read schedule' }));

		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
		const [url, options] = fetch.mock.calls[0];
		expect(url).toBe('?/saveSchedule');
		expect(options).toMatchObject({ method: 'POST', keepalive: true });
		expect(options.body.get('paste')).toBe(CANONICAL_OMNIVOX_SCHEDULE);
		expect(localStorage.setItem).not.toHaveBeenCalled();
	});

	it('keeps the parsed schedule visible when account saving fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: false }))
		);
		render(SchedulePage, { props: { data: { ...defaultData, signedIn: true } } });
		fireEvent.click(screen.getAllByRole('button', { name: 'Import Omnivox' })[0]);
		fireEvent.input(screen.getByLabelText('Omnivox course list'), {
			target: { value: CANONICAL_OMNIVOX_SCHEDULE }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Read schedule' }));

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Your schedule is shown here, but it could not be saved to your account.'
		);
		expect(screen.getByLabelText('Weekly course schedule')).toBeInTheDocument();
	});

	it('reports a network failure without discarding the parsed schedule', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Promise.reject(new Error('offline')))
		);
		render(SchedulePage, { props: { data: { ...defaultData, signedIn: true } } });
		fireEvent.click(screen.getAllByRole('button', { name: 'Import Omnivox' })[0]);
		fireEvent.input(screen.getByLabelText('Omnivox course list'), {
			target: { value: CANONICAL_OMNIVOX_SCHEDULE }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Read schedule' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
		expect(screen.getByLabelText('Weekly course schedule')).toBeInTheDocument();
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
