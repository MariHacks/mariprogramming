import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { openHint, run } = vi.hoisted(() => ({
	openHint: vi.fn(),
	run: vi.fn()
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
					step: SCIENCE_STEPS[0],
					steps: SCIENCE_STEPS
				});
				return () => {};
			},
			join: async () => {},
			destroy() {},
			selectStep: vi.fn(),
			openHint,
			setSource: vi.fn(),
			setStdin: vi.fn(),
			run
		})
	};
});

import StudioPage from './+page.svelte';

afterEach(cleanup);

describe('PBL studio page', () => {
	it('shows the lesson and editor for a joined room', async () => {
		const user = userEvent.setup();
		render(StudioPage);
		expect(screen.getByRole('heading', { level: 1, name: 'Get something running' })).toBeVisible();
		expect(screen.getByRole('textbox', { name: 'Python' })).toHaveValue('print("hi")');
		expect(screen.getByRole('status')).toHaveTextContent('The program printed your message.');
		expect(screen.getByRole('heading', { name: 'report.txt' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Syntax' })).toBeEnabled();
		expect(screen.getByRole('button', { name: 'Partial code' })).toBeDisabled();
		await user.click(screen.getByRole('button', { name: 'Idea' }));
		expect(openHint).toHaveBeenCalledWith(1);
		await user.click(screen.getByRole('button', { name: 'Run' }));
		expect(run).toHaveBeenCalled();
		expect(screen.getByRole('link', { name: 'Facilitator view' })).toHaveAttribute(
			'href',
			'/pbl/science/AB23JK/facilitator'
		);
	});
});
