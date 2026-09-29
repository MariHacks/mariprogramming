import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readable } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GamejamJoinPage from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
	page: readable({
		url: new URL('https://club.example/pbl/gamejam')
	})
}));
vi.mock('$lib/auth/student-sign-in.js', () => ({
	requestStudentAuthorization: vi.fn(async () => 'https://accounts.google.com/o/oauth2/v2/auth?x=1')
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('PBL 2 join page', () => {
	it('introduces the game jam, not the science workshop', () => {
		render(GamejamJoinPage, { data: { signedIn: false, email: null } });
		expect(
			screen.getByRole('heading', { level: 1, name: 'Game Jam: Survive the Day' })
		).toBeInTheDocument();
		expect(screen.getByText('PBL 2')).toBeInTheDocument();
		expect(screen.getByText(/text adventure that grows scene by scene/)).toBeInTheDocument();
		expect(screen.queryByText('Speedrun Programming in Science')).toBeNull();
		expect(document.title).toMatch(/^PBL 2 \|/);
		expect(screen.getByRole('button', { name: 'Create room' })).toBeDisabled();
	});

	it('creates a game jam room, then opens it under /pbl/gamejam', async () => {
		const user = userEvent.setup();
		const goto = (await import('$app/navigation')).goto;
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ code: 'AB23JK' }), { status: 201 })
		);
		vi.stubGlobal('fetch', fetchMock);
		render(GamejamJoinPage, { data: { signedIn: true, email: 'jam@marihacks.com' } });
		await user.type(screen.getByLabelText('Team name'), 'Survive Squad');
		await user.click(screen.getByRole('button', { name: 'Create room' }));
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			pblId: 'gamejam',
			teamName: 'Survive Squad'
		});
		expect(goto).toHaveBeenCalledWith('/pbl/gamejam/AB23JK');
	});

	it('joins an existing team under /pbl/gamejam', async () => {
		const user = userEvent.setup();
		const goto = (await import('$app/navigation')).goto;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ code: 'AB23JK' }), { status: 200 }))
		);
		render(GamejamJoinPage, { data: { signedIn: true, email: 'jam@marihacks.com' } });
		await user.type(screen.getByLabelText('Room code'), 'ab23jk');
		await user.click(screen.getByRole('button', { name: 'Join room' }));
		expect(goto).toHaveBeenCalledWith('/pbl/gamejam/AB23JK');
	});
});
