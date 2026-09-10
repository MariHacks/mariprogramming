import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { readable } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScienceJoinPage from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
	page: readable({
		url: new URL('https://club.example/pbl/science')
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

describe('PBL 1 join page', () => {
	it('prompts for club sign-in before create or join', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const assign = vi.fn();
		vi.stubGlobal('location', { assign });
		render(ScienceJoinPage, { data: { signedIn: false, email: null } });
		expect(screen.getByRole('heading', { name: 'Club account required' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Create room' })).toBeDisabled();
		expect(screen.getByRole('link', { name: /Open club account page/i })).toHaveAttribute(
			'href',
			'/tools/account'
		);
		await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));
		const { requestStudentAuthorization } = await import('$lib/auth/student-sign-in.js');
		expect(requestStudentAuthorization).toHaveBeenCalled();
		expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('creates a room then goes to the studio when signed in', async () => {
		const user = userEvent.setup();
		const goto = (await import('$app/navigation')).goto;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ code: 'AB23JK' }), { status: 201 }))
		);
		render(ScienceJoinPage, {
			data: { signedIn: true, email: 'lab@marihacks.com' }
		});
		expect(
			screen.getByRole('heading', { level: 1, name: 'Speedrun Programming in Science' })
		).toBeInTheDocument();
		expect(screen.getByText(/Signed in as lab@marihacks.com/)).toBeInTheDocument();
		await user.type(screen.getByLabelText('Team name'), 'Lab table 3');
		await user.click(screen.getByRole('button', { name: 'Create room' }));
		expect(goto).toHaveBeenCalledWith('/pbl/science/AB23JK');
	});

	it('rejects a bad join code before calling the server', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		render(ScienceJoinPage, { data: { signedIn: true, email: 'lab@marihacks.com' } });
		await user.type(screen.getByLabelText('Room code'), 'nope');
		await user.click(screen.getByRole('button', { name: 'Join room' }));
		expect(fetchMock).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent('Enter a 6-character room code.');
	});

	it('joins with a valid code and surfaces API errors', async () => {
		const user = userEvent.setup();
		const goto = (await import('$app/navigation')).goto;
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url) => {
				if (String(url).includes('/join')) {
					return new Response(JSON.stringify({ code: 'AB23JK' }), { status: 200 });
				}
				return new Response(JSON.stringify({ error: 'Enter a team name.' }), { status: 400 });
			})
		);
		render(ScienceJoinPage, { data: { signedIn: true, email: 'lab@marihacks.com' } });
		await user.type(screen.getByLabelText('Team name'), 'Lab');
		await user.click(screen.getByRole('button', { name: 'Create room' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Enter a team name.');
		await user.type(screen.getByLabelText('Room code'), 'ab23jk');
		await user.click(screen.getByRole('button', { name: 'Join room' }));
		expect(goto).toHaveBeenCalledWith('/pbl/science/AB23JK');
	});
});
