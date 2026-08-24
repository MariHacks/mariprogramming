import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import FreeTimePage from './+page.svelte';

afterEach(cleanup);

describe('Common Free Time', () => {
	it('compares two lists', () => {
		render(FreeTimePage);
		const areas = screen.getAllByRole('textbox');
		fireEvent.input(areas[0], { target: { value: CANONICAL_OMNIVOX_SCHEDULE } });
		fireEvent.input(areas[1], { target: { value: CANONICAL_OMNIVOX_SCHEDULE } });
		fireEvent.click(screen.getByRole('button', { name: 'Find shared free time' }));
		expect(screen.getByText('Tue')).toBeInTheDocument();
	});

	it('explains unreadable pastes', () => {
		render(FreeTimePage);
		fireEvent.click(screen.getByRole('button', { name: 'Find shared free time' }));
		expect(screen.getByRole('alert')).toHaveTextContent('compact Omnivox');
	});
});
