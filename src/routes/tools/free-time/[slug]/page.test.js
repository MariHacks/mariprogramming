import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BoardPage from './+page.svelte';

const BOARD = {
	id: '70000000-0000-4000-8000-000000000001',
	slug: 'study-group',
	title: 'Study group',
	termId: 'fall-2026',
	members: [{ id: 'm1', displayName: 'Ada', availability: {}, shareToken: null }]
};

afterEach(() => cleanup());

describe('free-time board page', () => {
	it('renders the paint grid and member list', () => {
		render(BoardPage, {
			props: {
				data: {
					board: BOARD,
					shareUrl: 'https://example.com/tools/free-time/study-group'
				}
			}
		});
		expect(screen.getByRole('heading', { level: 1, name: 'Study group' })).toBeInTheDocument();
		expect(screen.getByLabelText('Interactive free-time grid')).toBeInTheDocument();
		expect(screen.getByText('Ada')).toBeInTheDocument();
	});

	it('explains missing boards', () => {
		render(BoardPage, { props: { data: { board: null, notFound: true } } });
		expect(screen.getByText('That board is not available.')).toBeInTheDocument();
	});
});
