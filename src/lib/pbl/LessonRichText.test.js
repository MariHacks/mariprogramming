import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import LessonRichText from './LessonRichText.svelte';

afterEach(() => {
	cleanup();
});

describe('LessonRichText', () => {
	it('styles marked glossary terms as buttons and shows docs on click only', async () => {
		const user = userEvent.setup();
		render(LessonRichText, {
			props: { text: 'Change the starter `print` and Run again.' }
		});

		const term = screen.getByRole('button', { name: /print: show beginner docs/i });
		expect(term).toHaveTextContent('print');
		expect(term).toHaveClass('python-term');
		expect(screen.queryByRole('tooltip')).toBeNull();

		await user.hover(term);
		expect(screen.queryByRole('tooltip')).toBeNull();

		await user.click(term);
		const tip = screen.getByRole('tooltip');
		expect(tip).toBeVisible();
		expect(screen.getByText('What it is')).toBeVisible();
		expect(screen.getByText(/Shows a value in the output panel/i)).toBeVisible();
		expect(screen.getByText('Useful for')).toBeVisible();
		expect(screen.getByText('Example')).toBeVisible();
		expect(tip).toHaveTextContent('print("hello")');
		expect(screen.getByText('Output')).toBeVisible();
		expect(tip).toHaveTextContent('hello');
		expect(tip).toHaveTextContent('7');
		expect(tip.className).toMatch(/popover/);

		await user.keyboard('{Escape}');
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('toggles the docs popover with keyboard activation', async () => {
		const user = userEvent.setup();
		render(LessonRichText, {
			props: { text: 'Try `for` here.' }
		});
		const term = screen.getByRole('button', { name: /for: show beginner docs/i });
		term.focus();
		expect(screen.queryByRole('tooltip')).toBeNull();
		await user.keyboard('{Enter}');
		expect(screen.getByRole('tooltip')).toBeVisible();
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('links every repeated marked term in the same string', () => {
		render(LessonRichText, {
			props: { text: '`print` one `print` two' }
		});
		expect(screen.getAllByRole('button', { name: /print: show beginner docs/i })).toHaveLength(2);
	});

	it('renders unmarked English for as plain text with no chips', () => {
		const { container } = render(LessonRichText, {
			props: { text: 'work for your team' }
		});
		expect(container.textContent).toBe('work for your team');
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('renders plain text when nothing is marked', () => {
		const { container } = render(LessonRichText, {
			props: { text: 'Nothing special here.' }
		});
		expect(container.textContent).toBe('Nothing special here.');
		expect(screen.queryByRole('button')).toBeNull();
	});
});
