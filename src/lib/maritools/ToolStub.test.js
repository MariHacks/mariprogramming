import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ToolStub from './ToolStub.svelte';

afterEach(cleanup);

describe('ToolStub', () => {
	it('renders the tool title and summary', () => {
		render(ToolStub, { props: { title: 'Forum', summary: 'Read first. Sign in to post.' } });
		expect(screen.getByRole('heading', { name: 'Forum' })).toBeInTheDocument();
		expect(screen.getByText('Read first. Sign in to post.')).toBeInTheDocument();
	});
});
