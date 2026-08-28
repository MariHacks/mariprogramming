import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import BoardPage from './+page.svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/forms', () => ({
	enhance: () => () => {}
}));

const BOARD = {
	id: '70000000-0000-4000-8000-000000000001',
	slug: 'study-group',
	title: 'Study group',
	termId: 'fall-2026',
	members: [{ id: 'm1', displayName: 'Ada', availability: {}, shareToken: null }]
};

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('free-time board page', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => null),
			setItem: vi.fn(),
			removeItem: vi.fn()
		});
	});

	it('renders the paint grid and member list', () => {
		render(BoardPage, {
			props: {
				data: {
					board: BOARD,
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		expect(screen.getByRole('heading', { name: 'Study group' })).toBeInTheDocument();
		expect(screen.getByLabelText('Interactive free-time grid')).toBeInTheDocument();
		expect(screen.getByText('Ada')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save availability' })).toBeInTheDocument();
		expect(screen.getByText(/Mon–Fri pattern/i)).toBeInTheDocument();
	});

	it('restores painted cells and display name from the local share token', () => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => 'tok-ada'),
			setItem: vi.fn(),
			removeItem: vi.fn()
		});
		render(BoardPage, {
			props: {
				data: {
					board: {
						...BOARD,
						members: [
							{
								id: 'm1',
								displayName: 'Ada',
								shareToken: 'tok-ada',
								availability: { version: 1, free: ['Mon-09:00', 'Tue-11:00'] }
							}
						]
					},
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		expect(screen.getByPlaceholderText('How others will see you')).toHaveValue('Ada');
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Tue 11:00' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByText(/editing as Guest, Ada/i)).toBeInTheDocument();
	});

	it('keeps painted cells when switching weeks', () => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => 'tok-ada'),
			setItem: vi.fn(),
			removeItem: vi.fn()
		});
		render(BoardPage, {
			props: {
				data: {
					board: {
						...BOARD,
						members: [
							{
								id: 'm1',
								displayName: 'Ada',
								shareToken: 'tok-ada',
								availability: { version: 1, free: ['Mon-09:00'] }
							}
						]
					},
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		const before = screen.getByRole('heading', { level: 1 }).textContent;
		fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
		expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(before);
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('labels signed-in editors differently from guests', () => {
		render(BoardPage, {
			props: {
				data: {
					board: {
						...BOARD,
						members: [
							{ id: 'm1', displayName: 'MayaGuest', availability: {}, shareToken: null },
							{ id: 'm2', displayName: 'Zhicheng', availability: {}, shareToken: null }
						]
					},
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: 'Zhicheng'
				}
			}
		});
		expect(screen.getByPlaceholderText('How others will see you')).toHaveValue('Zhicheng');
		expect(screen.getByText(/editing as Zhicheng \(signed in\)/i)).toBeInTheDocument();
		expect(screen.getByText('MayaGuest')).toBeInTheDocument();
		expect(screen.getAllByText('Zhicheng').length).toBeGreaterThan(0);
		expect(screen.getByText('Account')).toBeInTheDocument();
		expect(screen.queryByText(/editing as Guest/i)).not.toBeInTheDocument();
	});

	it('guides an empty board before anyone paints', () => {
		render(BoardPage, {
			props: {
				data: {
					board: { ...BOARD, members: [] },
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		expect(screen.getByText(/No one has saved yet/i)).toBeInTheDocument();
		expect(
			screen.getByText(/add a display name, then Save so the group can see overlaps/i)
		).toBeInTheDocument();
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
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
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
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				},
				form: { saveSuccess: true, saveError: null }
			}
		});
		expect(screen.getByText('Availability saved.')).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Save availability' })).toHaveLength(1);
	});

	it('explains missing boards', () => {
		render(BoardPage, { props: { data: { board: null, notFound: true } } });
		expect(screen.getByText('That board is not available.')).toBeInTheDocument();
	});
});
