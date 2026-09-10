import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { openHint, run, selectStep, setCollab, studio } = vi.hoisted(() => ({
	openHint: vi.fn(),
	run: vi.fn(),
	selectStep: vi.fn(),
	setCollab: vi.fn(),
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
					lastCheck: { passed: true, message: 'The program printed your message.', step: 0 },
					memberCount: 2,
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
			setSource: vi.fn(),
			setStdin: vi.fn(),
			run
		})
	};
});

import StudioPage from './+page.svelte';

afterEach(() => {
	cleanup();
	studio.patch = {};
	selectStep.mockClear();
});

describe('PBL studio page', () => {
	it('shows the lesson and editor for a joined room', async () => {
		const user = userEvent.setup();
		render(StudioPage);
		expect(screen.getByRole('heading', { level: 1, name: 'Get something running' })).toBeVisible();
		expect(screen.getByRole('textbox', { name: 'Python' })).toHaveTextContent('print("hi")');
		expect(screen.getByRole('status')).toHaveTextContent('The program printed your message.');
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

	it('hides the editor when the team is full', () => {
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
		render(StudioPage);
		expect(screen.getByRole('alert')).toHaveTextContent('This team is full (10 people).');
		expect(screen.queryByRole('textbox', { name: 'Python' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
	});

	it('lets every teammate type', () => {
		studio.patch = {
			isDriver: true,
			readOnly: false,
			nextAction: 'Press Run.',
			lastCheck: null,
			files: {}
		};
		render(StudioPage);
		expect(screen.getByRole('textbox', { name: 'Python' })).toHaveAttribute(
			'aria-readonly',
			'false'
		);
		expect(screen.queryByText('Everyone can type.')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Take keyboard' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
	});

	it('keeps Next disabled until the step check passes', async () => {
		const { SCIENCE_STEPS } = await import('$lib/pbl/science-workshop.js');
		studio.patch = {
			currentStep: 2,
			unlockedStep: 2,
			lastCheck: { passed: false, message: 'Try again.', step: 2 },
			nextAction: 'Not yet. Try again.',
			step: SCIENCE_STEPS[2],
			files: {}
		};
		render(StudioPage);
		expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
	});

	it('shows Finished on the last passed step', async () => {
		const { SCIENCE_STEPS } = await import('$lib/pbl/science-workshop.js');
		const last = SCIENCE_STEPS[SCIENCE_STEPS.length - 1];
		studio.patch = {
			currentStep: last.id,
			unlockedStep: last.id,
			lastCheck: { passed: true, message: 'Done.', step: last.id },
			nextAction: 'Press Run.',
			step: last,
			files: {}
		};
		render(StudioPage);
		expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
		expect(screen.getByText('Finished')).toBeVisible();
	});
});
