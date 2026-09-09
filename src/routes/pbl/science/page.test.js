import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScienceJoinPage from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('PBL 1 join page', () => {
	it('creates a room then goes to the studio', async () => {
		const user = userEvent.setup();
		const goto = (await import('$app/navigation')).goto;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ code: 'AB23JK' }), { status: 201 }))
		);
		render(ScienceJoinPage);
		expect(
			screen.getByRole('heading', { level: 1, name: 'Speedrun Programming in Science' })
		).toBeInTheDocument();
		await user.type(screen.getByLabelText('Team name'), 'Lab table 3');
		await user.click(screen.getByRole('button', { name: 'Create room' }));
		expect(goto).toHaveBeenCalledWith('/pbl/science/AB23JK');
	});

	it('rejects a bad join code before calling the server', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		render(ScienceJoinPage);
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
		render(ScienceJoinPage);
		await user.type(screen.getByLabelText('Team name'), 'Lab');
		await user.click(screen.getByRole('button', { name: 'Create room' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Enter a team name.');
		await user.type(screen.getByLabelText('Room code'), 'ab23jk');
		await user.click(screen.getByRole('button', { name: 'Join room' }));
		expect(goto).toHaveBeenCalledWith('/pbl/science/AB23JK');
	});
});
