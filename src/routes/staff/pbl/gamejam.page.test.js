import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import StaffPblPage from './+page.svelte';
import StaffRoomPage from './[code]/+page.svelte';

afterEach(cleanup);

const room = {
	code: 'GJ23JK',
	pblId: 'gamejam',
	teamName: 'Survive Squad',
	unlockedStep: 4,
	memberCount: 1,
	updatedAt: '2026-09-09T18:00:00.000Z',
	lastCheck: null,
	members: [],
	stepSources: { '0': 'print("x")', '4': 'print("y")' },
	submissions: [],
	source: 'print("y")'
};

describe('staff view of a PBL 2 team', () => {
	it('labels the workshop and shows progress out of twelve steps', () => {
		render(StaffPblPage, { data: { unavailable: false, rooms: [room] } });
		expect(screen.getByText('PBL 2: Game Jam: Survive the Day')).toBeInTheDocument();
		expect(screen.getByText('5 / 12')).toBeInTheDocument();
	});

	it('shows unknown workshops without a step total', () => {
		render(StaffPblPage, {
			data: { unavailable: false, rooms: [{ ...room, pblId: 'mystery' }] }
		});
		expect(screen.getByText('mystery')).toBeInTheDocument();
		expect(screen.queryByText('5 / 12')).toBeNull();
	});

	it('titles each saved step with the game jam step names', () => {
		render(StaffRoomPage, { data: { unavailable: false, room } });
		expect(screen.getByText(/Step 1: Get something running/)).toBeInTheDocument();
		expect(screen.getByText(/Step 5: Make a choice/)).toBeInTheDocument();
	});
});
