import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import { explicitTermId } from '$lib/maritools/term/session.js';
import SchedulePage from './+page.svelte';

afterEach(() => {
	cleanup();
	explicitTermId.set(null);
});

describe('My schedule', () => {
	it('shows the native Omnivox steps', () => {
		render(SchedulePage);
		expect(screen.getByText('How do I get my schedule?')).toBeInTheDocument();
		expect(screen.getAllByText(/Obtain my schedule/).length).toBeGreaterThan(0);
		expect(screen.getByText(/Compact printable semester schedule/)).toBeInTheDocument();
		expect(screen.queryByText(/scribe/i)).not.toBeInTheDocument();
	});

	it('reads the canonical paste into seven course titles', () => {
		render(SchedulePage);
		fireEvent.input(screen.getByLabelText('Omnivox course list'), {
			target: { value: CANONICAL_OMNIVOX_SCHEDULE }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Read schedule' }));
		expect(screen.getByDisplayValue('Badminton and Conditioning')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Object-Oriented Programming')).toBeInTheDocument();
		expect(screen.getByDisplayValue("Comparaison d'oeuvres littéraires")).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Week' })).toBeInTheDocument();
	});

	it('warns when a student number is in the paste', () => {
		render(SchedulePage);
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
