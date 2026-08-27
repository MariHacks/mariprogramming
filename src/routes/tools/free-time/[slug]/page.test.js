import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
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
		expect(screen.getByRole('heading', { name: 'Study group' })).toBeInTheDocument();
		expect(screen.getByLabelText('Interactive free-time grid')).toBeInTheDocument();
		expect(screen.getByText('Ada')).toBeInTheDocument();
	});

	it('explains unavailable boards', () => {
		render(BoardPage, { props: { data: { board: null, unavailable: true } } });
		expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
	});

	it('imports an Omnivox paste into the paint grid', () => {
		render(BoardPage, {
			props: {
				data: {
					board: BOARD,
					shareUrl: 'https://example.com/tools/free-time/study-group'
				}
			}
		});
		fireEvent.click(screen.getByRole('button', { name: 'Import Omnivox' }));
		fireEvent.click(screen.getByRole('button', { name: 'Read schedule' }));
		expect(screen.getByRole('alert')).toHaveTextContent(/could not read/i);
		fireEvent.input(screen.getByLabelText('Omnivox course list'), {
			target: { value: CANONICAL_OMNIVOX_SCHEDULE }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Read schedule' }));
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('confirms a saved availability', () => {
		render(BoardPage, {
			props: {
				data: {
					board: BOARD,
					shareUrl: 'https://example.com/tools/free-time/study-group'
				},
				form: { saveSuccess: true, saveError: null }
			}
		});
		expect(screen.getByText('Availability saved.')).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Save availability' })).toHaveLength(2);
	});

	it('explains missing boards', () => {
		render(BoardPage, { props: { data: { board: null, notFound: true } } });
		expect(screen.getByText('That board is not available.')).toBeInTheDocument();
	});
});
