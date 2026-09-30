import { cleanup, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { created, run, selectStep } = vi.hoisted(() => ({
	created: /** @type {Array<Record<string, unknown>>} */ ([]),
	run: vi.fn(),
	selectStep: vi.fn()
}));

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			params: { code: 'GJ23JK' },
			url: new URL('http://localhost/pbl/gamejam/GJ23JK')
		})
	};
});

vi.mock('$lib/pbl/PythonEditor.svelte', async () => {
	const { default: Stub } = await import('../../science/[code]/PythonEditor.stub.svelte');
	return { default: Stub };
});

vi.mock('$lib/pbl/workshop-controller.js', async () => {
	const { GAMEJAM_STEPS } = await import('$lib/pbl/gamejam-workshop.js');
	return {
		createWorkshopController: (options) => {
			created.push(options);
			return {
				subscribe(listener) {
					listener({
						code: 'GJ23JK',
						teamName: 'Survive Squad',
						source: 'print("Game loaded")\n',
						currentStep: 4,
						viewStep: 4,
						unlockedStep: 5,
						openedHints: { '4': 1 },
						lastCheck: null,
						memberCount: 1,
						members: [],
						stdinText: '',
						output: '',
						files: {},
						running: false,
						pythonError: '',
						roomError: '',
						readOnly: false,
						blocked: '',
						isDriver: true,
						nextAction: '',
						step: GAMEJAM_STEPS[4],
						steps: GAMEJAM_STEPS
					});
					return () => {};
				},
				join: async () => {},
				destroy() {},
				selectStep,
				openHint: vi.fn(),
				setCollab: vi.fn(),
				ejectMember: vi.fn(),
				setSource: vi.fn(),
				setStdin: vi.fn(),
				run
			};
		}
	};
});

import StudioPage from './+page.svelte';

const signedIn = { collabUser: { userId: 'user-lead', email: 'lead@marihacks.com', name: 'Lead' } };

afterEach(() => {
	cleanup();
	created.length = 0;
	selectStep.mockClear();
});

describe('PBL 2 studio page', () => {
	it('opens the game jam studio for the team room in the URL', async () => {
		const { container } = render(StudioPage, { data: signedIn });
		await waitFor(() => expect(screen.queryByText('Joining the team room…')).toBeNull());
		expect(created).toEqual([{ code: 'GJ23JK', pblId: 'gamejam' }]);
		expect(document.title).toMatch(/^PBL 2 studio \|/);
		const footer = container.querySelector('.lesson-footer');
		expect(within(footer).getByText('PBL 2')).toBeVisible();
		expect(within(footer).getByText('Survive Squad')).toBeVisible();
	});

	it('shows the step lesson with its Output notes and hint ladder', async () => {
		render(StudioPage, { data: signedIn });
		await waitFor(() => expect(screen.queryByText('Joining the team room…')).toBeNull());
		expect(screen.getByRole('heading', { name: /Make a choice/ })).toBeInTheDocument();
		expect(screen.getByText(/A different outcome line for each choice/)).toBeInTheDocument();
		expect(
			screen.getByText(/Read the choice once, then let a chain of conditions/)
		).toBeInTheDocument();
	});

	it('lists twelve steps and locks the ones the team has not reached', async () => {
		const { container } = render(StudioPage, { data: signedIn });
		await waitFor(() => expect(screen.queryByText('Joining the team room…')).toBeNull());
		const buttons = [...container.querySelectorAll('.steps button')];
		expect(buttons).toHaveLength(12);
		expect(buttons.map((button) => button.disabled)).toEqual(
			Array.from({ length: 12 }, (_, index) => index > 5)
		);
		expect(container.querySelector('.steps button.current')?.textContent?.trim()).toBe('4');
	});

	it('shares the room link under the game jam path', async () => {
		const writeText = vi.fn(async () => {});
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		render(StudioPage, { data: signedIn });
		await waitFor(() => expect(screen.queryByText('Joining the team room…')).toBeNull());
		screen.getByRole('button', { name: 'Copy share link GJ23JK' }).click();
		await waitFor(() => expect(writeText).toHaveBeenCalled());
		expect(String(writeText.mock.calls[0][0])).toMatch(/\/pbl\/gamejam\/GJ23JK$/);
		vi.unstubAllGlobals();
	});
});
