import { cleanup, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { openHint, run, selectStep, setCollab, ejectMember, studio } = vi.hoisted(() => ({
	openHint: vi.fn(),
	run: vi.fn(),
	selectStep: vi.fn(),
	setCollab: vi.fn(),
	ejectMember: vi.fn(async () => ({ memberCount: 1 })),
	studio: { patch: /** @type {Record<string, unknown>} */ ({}) }
}));

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			params: { code: 'AB23JK' },
			url: new URL('http://localhost/pbl/science/AB23JK')
		})
	};
});

vi.mock('$lib/pbl/PythonEditor.svelte', async () => {
	const { default: Stub } = await import('./PythonEditor.stub.svelte');
	return { default: Stub };
});

vi.mock('$lib/pbl/workshop-controller.js', async () => {
	const { SCIENCE_STEPS } = await import('$lib/pbl/science-workshop.js');
	return {
		createWorkshopController: () => ({
			subscribe(listener) {
				listener({
					code: 'AB23JK',
					teamName: 'Lab table 3',
					source: 'print("hi")',
					currentStep: 0,
					unlockedStep: 0,
					openedHints: { '0': 1 },
					lastCheck: { passed: true, message: 'Printed a custom message. Starter text is gone.', step: 0 },
					memberCount: 2,
					driverMemberId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
					members: [
						{
							memberId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
							name: 'Lead',
							email: 'lead@marihacks.com'
						},
						{
							memberId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
							name: 'Teammate',
							email: 'mate@marihacks.com'
						}
					],
					stdinText: '',
					output: 'hi\n',
					files: { 'report.txt': 'ok' },
					running: false,
					pythonError: '',
					roomError: '',
					readOnly: false,
					blocked: '',
					isDriver: true,
					nextAction: 'Open the next step.',
					step: SCIENCE_STEPS[0],
					steps: SCIENCE_STEPS,
					...studio.patch
				});
				return () => {};
			},
			join: async () => {},
			destroy() {},
			selectStep,
			openHint,
			setCollab,
			ejectMember,
			setSource: vi.fn(),
			setStdin: vi.fn(),
			run
		})
	};
});

import StudioPage from './+page.svelte';

async function renderReady(props) {
	const view = render(StudioPage, props);
	await waitFor(() => {
		expect(screen.queryByText('Joining the team room…')).toBeNull();
	});
	return view;
}

afterEach(() => {
	cleanup();
	studio.patch = {};
	selectStep.mockClear();
	run.mockClear();
	ejectMember.mockClear();
});

describe('PBL studio page', () => {
	it('keeps team info once in the lesson footer with clear hierarchy', async () => {
		const { container } = await renderReady();
		const footer = container.querySelector('.lesson-footer');
		const toolbar = container.querySelector('.toolbar');
		expect(footer).not.toBeNull();
		expect(toolbar).not.toBeNull();
		const team = within(footer);
		expect(team.getByText('PBL 1')).toBeVisible();
		expect(team.getByText('Lab table 3')).toBeVisible();
		const codeChip = team.getByRole('button', { name: 'Copy share link AB23JK' });
		expect(codeChip).toBeVisible();
		expect(codeChip).toHaveTextContent('AB23JK');
		expect(team.queryByRole('button', { name: 'Copy link' })).toBeNull();
		const countChip = team.getByRole('button', { name: 'Open team roster, 2 of 10 on this team' });
		expect(countChip).toBeVisible();
		expect(countChip).toHaveTextContent('2/10');
		expect(countChip.querySelector('svg.person-icon')).not.toBeNull();
		const row = footer?.querySelector('.team-row');
		const chips = footer?.querySelector('.team-chips');
		expect(row).not.toBeNull();
		expect(chips).not.toBeNull();
		expect(chips?.querySelectorAll('.team-chip')).toHaveLength(2);
		expect(footer?.textContent ?? '').not.toMatch(/PBL 1\s*[—·]/u);
		expect(footer?.textContent ?? '').not.toMatch(/Lab table 3\s*[—·]/u);
		expect(within(toolbar).queryByText('Share')).toBeNull();
		expect(within(toolbar).queryByText('AB23JK')).toBeNull();
		expect(within(toolbar).queryByRole('button', { name: /Copy/ })).toBeNull();
		expect(within(toolbar).queryByText(/\/10/)).toBeNull();
		expect(screen.getAllByText('AB23JK')).toHaveLength(1);
		expect(screen.getAllByText('Lab table 3')).toHaveLength(1);
		expect(screen.getAllByRole('button', { name: /Open team roster/ })).toHaveLength(1);
		expect(container.querySelector('.lesson-scroll .team-name')).toBeNull();
	});

	it('copies the share link from the room code chip', async () => {
		const user = userEvent.setup();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText }
		});
		await renderReady();
		const codeChip = screen.getByRole('button', { name: 'Copy share link AB23JK' });
		await user.click(codeChip);
		expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pbl/science/AB23JK`);
		expect(screen.getByRole('button', { name: 'Copied share link' })).toHaveTextContent('Copied');
	});

	it('shows the lesson and editor for a joined room', async () => {
		const user = userEvent.setup();
		await renderReady();
		expect(screen.getByRole('heading', { level: 1, name: 'Get something running' })).toBeVisible();
		expect(screen.getByRole('textbox', { name: 'Python' })).toHaveTextContent('print("hi")');
		expect(screen.getByRole('status')).toHaveTextContent('Printed a custom message. Starter text is gone.');
		expect(screen.getByRole('heading', { name: 'report.txt' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Syntax' })).toBeEnabled();
		expect(screen.getByRole('button', { name: 'Partial code' })).toBeDisabled();
		await user.click(screen.getByRole('button', { name: 'Idea' }));
		expect(openHint).toHaveBeenCalledWith(1);
		await user.click(screen.getByRole('button', { name: 'Run' }));
		expect(run).toHaveBeenCalled();
		expect(screen.queryByRole('link', { name: 'Facilitator view' })).toBeNull();
		expect(screen.getByText('Open the next step.')).toBeVisible();
		expect(
			screen.getAllByRole('button').some((button) => /^\d+$/u.test(button.textContent ?? ''))
		).toBe(true);
		expect(screen.getByRole('button', { name: '11', exact: true })).toBeDisabled();
		const next = screen.getByRole('button', { name: 'Next' });
		expect(next).toBeEnabled();
		await user.click(next);
		expect(selectStep).toHaveBeenCalledWith(1);
	});

	it('keeps Lesson Code Output chips and opens output after Run', async () => {
		const user = userEvent.setup();
		const { container } = await renderReady();
		const studio = container.querySelector('.studio');
		const panes = screen.getByRole('navigation', { name: 'Studio sections' });
		const paneButtons = within(panes);
		expect(studio).toHaveAttribute('data-pane', 'lesson');
		expect(paneButtons.getAllByRole('button')).toHaveLength(3);
		await user.click(paneButtons.getByRole('button', { name: 'Code' }));
		expect(studio).toHaveAttribute('data-pane', 'code');
		await user.click(screen.getByRole('button', { name: 'Run' }));
		expect(run).toHaveBeenCalled();
		expect(studio).toHaveAttribute('data-pane', 'output');
		await user.click(paneButtons.getByRole('button', { name: 'Lesson' }));
		expect(studio).toHaveAttribute('data-pane', 'lesson');
		expect(screen.queryByRole('link', { name: 'Facilitator view' })).toBeNull();
	});

	it('hides the editor when the team is full', async () => {
		studio.patch = {
			blocked: 'full',
			roomError: 'This team is full (10 people).',
			memberCount: 10,
			joinable: false,
			readOnly: true,
			isDriver: false,
			nextAction: 'This team is full.',
			files: {}
		};
		await renderReady();
		expect(screen.getByRole('alert')).toHaveTextContent('This team is full (10 people).');
		expect(screen.queryByRole('textbox', { name: 'Python' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
	});

	it('lets every teammate type', async () => {
		studio.patch = {
			isDriver: true,
			readOnly: false,
			nextAction: '',
			lastCheck: null,
			files: {}
		};
		await renderReady();
		expect(screen.getByRole('textbox', { name: 'Python' })).toHaveAttribute(
			'aria-readonly',
			'false'
		);
		expect(screen.queryByText('Everyone can type.')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Take keyboard' })).toBeNull();
		expect(screen.queryByText('Press Run.')).toBeNull();
		expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
	});

	it('keeps Next disabled until the step check passes', async () => {
		const { SCIENCE_STEPS } = await import('$lib/pbl/science-workshop.js');
		studio.patch = {
			currentStep: 2,
			unlockedStep: 2,
			lastCheck: { passed: false, message: 'Try again.', step: 2 },
			nextAction: 'Try again.',
			step: SCIENCE_STEPS[2],
			files: {}
		};
		await renderReady();
		expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
	});

	it('shows Finished on the last passed step', async () => {
		const { SCIENCE_STEPS } = await import('$lib/pbl/science-workshop.js');
		const last = SCIENCE_STEPS[SCIENCE_STEPS.length - 1];
		studio.patch = {
			currentStep: last.id,
			unlockedStep: last.id,
			lastCheck: { passed: true, message: 'Done.', step: last.id },
			nextAction: '',
			step: last,
			files: {}
		};
		await renderReady();
		expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
		expect(screen.getByText('Finished')).toBeVisible();
	});

	it('hides Accepted banner and next-step status after advancing', async () => {
		const { SCIENCE_STEPS } = await import('$lib/pbl/science-workshop.js');
		studio.patch = {
			currentStep: 1,
			unlockedStep: 1,
			openedHints: {},
			lastCheck: { passed: true, message: 'Printed a custom message. Starter text is gone.', step: 0 },
			nextAction: '',
			step: SCIENCE_STEPS[1],
			files: {}
		};
		await renderReady();
		expect(screen.queryByText('Accepted')).toBeNull();
		expect(screen.queryByText('Printed a custom message. Starter text is gone.')).toBeNull();
		expect(screen.queryByText('Open the next step.')).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('renders python glossary chips in the lesson body', async () => {
		await renderReady();
		const printTerm = screen.getByRole('button', { name: /print: show beginner docs/i });
		expect(printTerm).toBeVisible();
		expect(printTerm).toHaveClass('python-term');
	});


	it('opens a member roster from the count chip and lets the leader eject others', async () => {
		const user = userEvent.setup();
		await renderReady();
		await user.click(screen.getByRole('button', { name: 'Open team roster, 2 of 10 on this team' }));
		const dialog = screen.getByRole('dialog', { name: 'Lab table 3' });
		expect(dialog).toBeVisible();
		expect(within(dialog).getByText('Lead')).toBeVisible();
		expect(within(dialog).getByText('Leader')).toBeVisible();
		expect(within(dialog).getByText('Teammate')).toBeVisible();
		expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeNull();
		// Leader row should not offer self-eject.
		const removeButtons = within(dialog).getAllByRole('button', { name: 'Remove' });
		expect(removeButtons).toHaveLength(1);
		await user.click(removeButtons[0]);
		expect(ejectMember).toHaveBeenCalledWith('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
	});

	it('shows a read-only roster for non-leaders', async () => {
		const user = userEvent.setup();
		studio.patch = {
			isDriver: false,
			driverMemberId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
			members: [
				{
					memberId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
					name: 'Lead',
					email: 'lead@marihacks.com'
				},
				{
					memberId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
					name: 'Teammate',
					email: 'mate@marihacks.com'
				}
			],
			files: {}
		};
		await renderReady();
		await user.click(screen.getByRole('button', { name: /Open team roster/ }));
		const dialog = screen.getByRole('dialog', { name: 'Lab table 3' });
		expect(within(dialog).queryByRole('button', { name: 'Remove' })).toBeNull();
		expect(within(dialog).getByText('Only the team leader can remove teammates.')).toBeVisible();
	});


});
