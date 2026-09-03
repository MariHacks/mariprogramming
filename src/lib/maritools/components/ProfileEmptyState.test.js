import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ProfileEmptyState from './ProfileEmptyState.svelte';

const source = readFileSync('src/lib/maritools/components/ProfileEmptyState.svelte', 'utf8');

afterEach(cleanup);

describe('ProfileEmptyState', () => {
	it.each(['posts', 'outlines'])('renders the %s graphic as decoration', (kind) => {
		render(ProfileEmptyState, {
			props: {
				kind,
				title: 'Nothing here yet',
				description: 'New activity will appear here.'
			}
		});

		expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
		expect(screen.getByText('New activity will appear here.')).toBeInTheDocument();
		expect(document.querySelector(`.profile-empty-state--${kind} svg`)).toHaveAttribute(
			'aria-hidden',
			'true'
		);
	});

	it('reserves useful height on desktop and narrow screens', () => {
		expect(source).toMatch(/min-height:\s*14rem/);
		expect(source).toMatch(/@media \(max-width: 44rem\)[\s\S]*min-height:\s*11rem/);
	});
});
