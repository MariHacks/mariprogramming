import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import { addDays, mondayOfWeek } from '$lib/maritools/schedule/academicWeekView.js';
import { calendarDate } from '$lib/maritools/term/calendar.js';
import BoardPage from './+page.svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/forms', () => ({
	enhance: () => () => {}
}));

const THIS_WEEK = mondayOfWeek(calendarDate());
const NEXT_WEEK = addDays(THIS_WEEK, 7);

const BOARD = {
	id: '70000000-0000-4000-8000-000000000001',
	slug: 'study-group',
	title: 'Study group',
	termId: 'fall-2026',
	members: [
		{
			id: 'm1',
			displayName: 'Ada',
			availability: {},
			shareToken: null,
			userId: null,
			accountKind: /** @type {'guest'} */ ('guest')
		}
	]
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
		vi.stubGlobal('sessionStorage', {
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
		expect(screen.getByText(/Availability is saved per week/i)).toBeInTheDocument();
	});

	it('shows distinct account-kind icons and toggles members in the common-free overlap', async () => {
		const members = [
			{
				id: 'guest',
				displayName: 'Guest Ada',
				accountKind: /** @type {'guest'} */ ('guest'),
				availability: {
					version: 2,
					byWeek: { [THIS_WEEK]: ['Mon-09:00', 'Tue-11:00'] }
				}
			},
			{
				id: 'account',
				displayName: 'Signed Sam',
				accountKind: /** @type {'signed_in'} */ ('signed_in'),
				availability: { version: 2, byWeek: { [THIS_WEEK]: ['Mon-09:00'] } }
			},
			{
				id: 'exec',
				displayName: 'Exec Eve',
				accountKind: /** @type {'executive'} */ ('executive'),
				availability: { version: 2, byWeek: { [THIS_WEEK]: ['Mon-09:00'] } }
			}
		];
		render(BoardPage, {
			props: {
				data: {
					board: { ...BOARD, members },
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});

		expect(screen.getByLabelText('Guest')).toBeInTheDocument();
		expect(screen.getByLabelText('Signed in')).toBeInTheDocument();
		expect(screen.getByLabelText('Executive')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveClass('common');
		expect(screen.getByRole('button', { name: 'Tue 11:00' })).not.toHaveClass('common');

		await fireEvent.click(
			screen.getByRole('button', { name: 'Exclude Signed Sam from common free' })
		);
		await fireEvent.click(
			screen.getByRole('button', { name: 'Exclude Exec Eve from common free' })
		);
		expect(screen.getByRole('button', { name: 'Tue 11:00' })).toHaveClass('common');
		expect(sessionStorage.setItem).toHaveBeenCalledWith(
			`maritools.free-time.${BOARD.id}.included-members`,
			JSON.stringify(['guest'])
		);
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
								availability: {
									version: 2,
									byWeek: { [THIS_WEEK]: ['Mon-09:00', 'Tue-11:00'] }
								}
							}
						]
					},
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Save availability' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveClass('heat');
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveAttribute(
			'data-free-count',
			'1'
		);
		expect(screen.getByRole('button', { name: 'Tue 11:00' })).toHaveAttribute(
			'data-free-count',
			'1'
		);
		expect(screen.getByText(/editing as Guest, Ada/i)).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(screen.getByPlaceholderText('How others will see you')).toHaveValue('Ada');
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getByRole('button', { name: 'Tue 11:00' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getByRole('button', { name: 'Save availability' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Import Omnivox' })).toBeInTheDocument();
	});

	it('loads a different week when switching away from a painted week', () => {
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
								availability: {
									version: 2,
									byWeek: {
										[THIS_WEEK]: ['Mon-09:00'],
										[NEXT_WEEK]: ['Wed-14:00']
									}
								}
							}
						]
					},
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveAttribute(
			'data-free-count',
			'1'
		);
		expect(screen.getByRole('button', { name: 'Wed 14:00' })).toHaveAttribute(
			'data-free-count',
			'0'
		);
		const before = screen.getByRole('heading', { level: 1 }).textContent;
		fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
		expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(before);
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveAttribute(
			'data-free-count',
			'0'
		);
		expect(screen.getByRole('button', { name: 'Wed 14:00' })).toHaveAttribute(
			'data-free-count',
			'1'
		);
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(screen.getByRole('button', { name: 'Wed 14:00' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('labels signed-in editors differently from guests', () => {
		render(BoardPage, {
			props: {
				data: {
					board: {
						...BOARD,
						members: [
							{
								id: 'm1',
								displayName: 'MayaGuest',
								availability: {},
								shareToken: null,
								accountKind: /** @type {'guest'} */ ('guest')
							},
							{
								id: 'm2',
								displayName: 'Zhicheng',
								availability: {},
								shareToken: null,
								accountKind: /** @type {'signed_in'} */ ('signed_in')
							}
						]
					},
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: 'Zhicheng'
				}
			}
		});
		expect(screen.queryByPlaceholderText('How others will see you')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
		expect(screen.getByText(/editing as Zhicheng \(signed in\)/i)).toBeInTheDocument();
		expect(screen.getByText('MayaGuest')).toBeInTheDocument();
		expect(screen.getAllByText('Zhicheng').length).toBeGreaterThan(0);
		expect(screen.getByLabelText('Signed in')).toBeInTheDocument();
		expect(screen.queryByText('Account')).not.toBeInTheDocument();
		expect(screen.queryByText(/editing as Guest/i)).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(document.querySelector('input[name="displayName"][type="hidden"]')).not.toBeNull();
		expect(screen.getByRole('button', { name: 'Save availability' })).toBeInTheDocument();
	});

	it('keeps the display name field for guests', () => {
		render(BoardPage, {
			props: {
				data: {
					board: BOARD,
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		expect(screen.getByPlaceholderText('How others will see you')).toBeInTheDocument();
		expect(document.querySelector('input[name="displayName"][type="hidden"]')).toBeNull();
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

	it('omits the display-name tip on empty boards when signed in', () => {
		render(BoardPage, {
			props: {
				data: {
					board: { ...BOARD, members: [] },
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: 'Zhicheng'
				}
			}
		});
		expect(screen.getByText(/Paint free slots, then Save/i)).toBeInTheDocument();
		expect(screen.queryByText(/add a display name/i)).not.toBeInTheDocument();
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

	it('imports the account schedule immediately without showing a duplicate textbox', () => {
		render(BoardPage, {
			props: {
				data: {
					board: BOARD,
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: 'Zhicheng',
					savedSchedulePaste: CANONICAL_OMNIVOX_SCHEDULE
				}
			}
		});
		fireEvent.click(screen.getByRole('button', { name: 'Import Omnivox' }));
		expect(screen.queryByLabelText('Omnivox course list')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Read schedule' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Mon 08:00' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
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
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Save availability' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Import Omnivox' })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(screen.getAllByRole('button', { name: 'Save availability' })).toHaveLength(1);
		expect(screen.getByRole('button', { name: 'Import Omnivox' })).toBeInTheDocument();
	});

	it('starts in edit mode when this visitor has never saved', () => {
		render(BoardPage, {
			props: {
				data: {
					board: BOARD,
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		expect(screen.getByRole('button', { name: 'Save availability' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Import Omnivox' })).toBeInTheDocument();
		expect(screen.getByText('Drag to paint your free time')).toBeInTheDocument();
	});

	it('recomputes the heat map when included members change in view mode', async () => {
		const members = [
			{
				id: 'guest',
				displayName: 'Guest Ada',
				accountKind: /** @type {'guest'} */ ('guest'),
				shareToken: 'tok-ada',
				availability: {
					version: 2,
					byWeek: { [THIS_WEEK]: ['Mon-09:00', 'Tue-11:00'] }
				}
			},
			{
				id: 'account',
				displayName: 'Signed Sam',
				accountKind: /** @type {'signed_in'} */ ('signed_in'),
				availability: { version: 2, byWeek: { [THIS_WEEK]: ['Mon-09:00'] } }
			}
		];
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => 'tok-ada'),
			setItem: vi.fn(),
			removeItem: vi.fn()
		});
		render(BoardPage, {
			props: {
				data: {
					board: { ...BOARD, members },
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveAttribute(
			'data-free-count',
			'2'
		);
		expect(screen.getByRole('button', { name: 'Tue 11:00' })).toHaveAttribute(
			'data-free-count',
			'1'
		);
		await fireEvent.click(
			screen.getByRole('button', { name: 'Exclude Signed Sam from common free' })
		);
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toHaveAttribute(
			'data-free-count',
			'1'
		);
		expect(screen.getByRole('button', { name: 'Tue 11:00' })).toHaveAttribute(
			'data-free-count',
			'1'
		);
		fireEvent.pointerEnter(screen.getByRole('button', { name: 'Mon 09:00' }));
		expect(screen.getByRole('tooltip')).toHaveTextContent('Available');
		expect(screen.getByRole('tooltip')).toHaveTextContent('Guest Ada');
		expect(screen.queryByRole('tooltip')?.textContent).not.toMatch(/Signed Sam/);
	});

	it('explains missing boards', () => {
		render(BoardPage, { props: { data: { board: null, notFound: true } } });
		expect(screen.getByText('That board is not available.')).toBeInTheDocument();
	});

	it('grays Labour Day on the Fall 2026 board week', () => {
		render(BoardPage, {
			props: {
				data: {
					board: BOARD,
					shareUrl: 'https://example.com/tools/free-time/study-group',
					signedInDisplayName: null
				}
			}
		});
		const labourWeek = mondayOfWeek('2026-09-07');
		let cursor = THIS_WEEK;
		while (cursor < labourWeek) {
			fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
			cursor = addDays(cursor, 7);
		}
		while (cursor > labourWeek) {
			fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
			cursor = addDays(cursor, -7);
		}
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/September 7/i);
		expect(screen.getByText('No class')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Mon 09:00' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Tue 09:00' })).not.toBeDisabled();
	});
});
