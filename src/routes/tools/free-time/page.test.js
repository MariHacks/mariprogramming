import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import { explicitTermId } from '$lib/maritools/term/session.js';
import FreeTimePage from './+page.svelte';

afterEach(() => {
	cleanup();
	explicitTermId.set(null);
	vi.unstubAllGlobals();
});

function pasteTwo() {
	fireEvent.input(screen.getByLabelText('Schedule 1'), { target: { value: CANONICAL_OMNIVOX_SCHEDULE } });
	fireEvent.input(screen.getByLabelText('Schedule 2'), { target: { value: CANONICAL_OMNIVOX_SCHEDULE } });
}

describe('Common free time', () => {
	it('compares two lists on a week grid', () => {
		render(FreeTimePage);
		pasteTwo();
		fireEvent.click(screen.getByRole('button', { name: 'Find shared free time' }));
		expect(screen.getByRole('heading', { name: 'Week' })).toBeInTheDocument();
		expect(screen.getByText('Tue')).toBeInTheDocument();
	});

	it('explains unreadable pastes', () => {
		render(FreeTimePage);
		fireEvent.click(screen.getByRole('button', { name: 'Find shared free time' }));
		expect(screen.getByRole('alert')).toHaveTextContent('at least two compact Omnivox');
	});

	it('adds a third person and compares a 90-minute gap', () => {
		render(FreeTimePage);
		fireEvent.click(screen.getByRole('button', { name: 'Add another person' }));
		expect(screen.getByLabelText('Schedule 3')).toBeInTheDocument();
		fireEvent.input(screen.getByLabelText('Schedule 1'), { target: { value: CANONICAL_OMNIVOX_SCHEDULE } });
		fireEvent.input(screen.getByLabelText('Schedule 2'), { target: { value: CANONICAL_OMNIVOX_SCHEDULE } });
		fireEvent.click(screen.getByRole('radio', { name: '90 minutes' }));
		fireEvent.click(screen.getByRole('button', { name: 'Find shared free time' }));
		expect(screen.getByText('Tue')).toBeInTheDocument();
		fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
		expect(screen.getAllByLabelText(/^Schedule \d+$/).length).toBe(2);
	});

	it('uses a custom duration and an optional calendar date', () => {
		explicitTermId.set('fall-2026');
		render(FreeTimePage);
		pasteTwo();
		fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
		fireEvent.input(screen.getByLabelText('Custom minutes'), { target: { value: '30' } });
		fireEvent.input(screen.getByLabelText('Optional date'), { target: { value: '2026-09-08' } });
		fireEvent.click(screen.getByRole('button', { name: 'Find shared free time' }));
		expect(screen.getByText(/2026-09-08 follows Mon/)).toBeInTheDocument();
	});

	it('treats a no-class date as fully free', () => {
		explicitTermId.set('fall-2026');
		render(FreeTimePage);
		pasteTwo();
		fireEvent.input(screen.getByLabelText('Optional date'), { target: { value: '2026-09-07' } });
		fireEvent.click(screen.getByRole('button', { name: 'Find shared free time' }));
		expect(screen.getByText('08:00–18:00')).toBeInTheDocument();
	});

	it('rejects an out-of-range custom duration', () => {
		render(FreeTimePage);
		pasteTwo();
		fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
		fireEvent.input(screen.getByLabelText('Custom minutes'), { target: { value: '5' } });
		fireEvent.click(screen.getByRole('button', { name: 'Find shared free time' }));
		expect(screen.getByRole('alert')).toHaveTextContent('15 and 240');
	});

	it('asks for a term before filtering by date', () => {
		explicitTermId.set('not-a-term');
		render(FreeTimePage);
		pasteTwo();
		fireEvent.input(screen.getByLabelText('Optional date'), { target: { value: '2026-09-08' } });
		fireEvent.click(screen.getByRole('button', { name: 'Find shared free time' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Choose a term');
	});

	it('downloads busy intervals without course names', () => {
		const createObjectURL = vi.fn(() => 'blob:busy');
		const revokeObjectURL = vi.fn();
		vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
		const click = vi.fn();
		const realCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag) => {
			if (tag === 'a') {
				return /** @type {any} */ ({ click, set href(_value) {}, set download(_value) {} });
			}
			return realCreate(tag);
		});
		render(FreeTimePage);
		pasteTwo();
		fireEvent.click(screen.getByRole('button', { name: 'Download busy times (.json)' }));
		expect(createObjectURL).toHaveBeenCalled();
		expect(click).toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Download busy times (.json)' }));
	});

	it('explains a download without two pastes', () => {
		render(FreeTimePage);
		fireEvent.click(screen.getByRole('button', { name: 'Download busy times (.json)' }));
		expect(screen.getByRole('alert')).toHaveTextContent('at least two compact Omnivox');
	});
});
