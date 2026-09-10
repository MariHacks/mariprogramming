import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import LessonRichText from './LessonRichText.svelte';

afterEach(() => {
	cleanup();
});

describe('LessonRichText', () => {
	it('styles glossary terms as hoverable buttons and shows docs on click', async () => {
		const user = userEvent.setup();
		render(LessonRichText, {
			props: { text: 'Change the starter print and Run again.' }
		});

		const term = screen.getByRole('button', { name: /print: show beginner docs/i });
		expect(term).toHaveTextContent('print');
		expect(term).toHaveClass('python-term');

		await user.click(term);
		expect(screen.getByRole('tooltip')).toBeVisible();
		expect(screen.getByText('What it is')).toBeVisible();
		expect(screen.getByText(/Shows a value in the output panel/i)).toBeVisible();
		expect(screen.getByText('Useful for')).toBeVisible();
		expect(screen.getByText('Example')).toBeVisible();

		await user.keyboard('{Escape}');
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('links every repeated term in the same string', () => {
		render(LessonRichText, {
			props: { text: 'print one print two' }
		});
		expect(screen.getAllByRole('button', { name: /print: show beginner docs/i })).toHaveLength(2);
	});

	it('renders plain text when nothing matches', () => {
		const { container } = render(LessonRichText, {
			props: { text: 'Nothing special here.' }
		});
		expect(container.textContent).toBe('Nothing special here.');
		expect(screen.queryByRole('button')).toBeNull();
	});
});
