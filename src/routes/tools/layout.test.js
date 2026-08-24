import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { explicitTermId } from '$lib/maritools/term/session.js';
import ToolsLayout from './+layout.svelte';

afterEach(() => {
	cleanup();
	explicitTermId.set(null);
});

describe('tools layout', () => {
	it('names the Programming Club initiative', () => {
		render(ToolsLayout);
		expect(screen.getByText('A Programming Club initiative.')).toBeInTheDocument();
	});

	it('lets the visitor pin a historical term', () => {
		render(ToolsLayout);
		fireEvent.change(screen.getByLabelText('Term'), { target: { value: 'fall-2026' } });
		expect(screen.getByRole('status')).toHaveTextContent('Showing Fall 2026.');
	});
});
