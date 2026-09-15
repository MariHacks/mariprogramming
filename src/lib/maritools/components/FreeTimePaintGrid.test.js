import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { paintCellKey } from '$lib/maritools/schedule/freeTimeBoard.js';
import FreeTimePaintGrid from './FreeTimePaintGrid.svelte';

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('FreeTimePaintGrid', () => {
	it('toggles a cell with the keyboard', () => {
		let cells = new Set();
		render(FreeTimePaintGrid, {
			props: {
				freeCells: cells,
				commonCells: new Set(),
				onChange: (next) => {
					cells = next;
				}
			}
		});
		const key = paintCellKey('Mon', '09:00');
		const cell = screen.getByRole('button', { name: 'Mon 09:00' });
		fireEvent.keyDown(cell, { key: 'Enter' });
		expect(cell.getAttribute('aria-pressed')).toBe('true');
		fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
		expect(cell.getAttribute('aria-pressed')).toBe('false');
	});

	it('marks common overlap cells', () => {
		const shared = paintCellKey('Wed', '12:00');
		render(FreeTimePaintGrid, {
			props: {
				freeCells: new Set([shared]),
				commonCells: new Set([shared])
			}
		});
		expect(screen.getByRole('button', { name: 'Wed 12:00' }).className).toContain('common');
	});

	it('labels the time rail like the preview grid', () => {
		render(FreeTimePaintGrid, {
			props: {
				freeCells: new Set(),
				commonCells: new Set(),
				dayHeaders: ['Mon 20', 'Tue 21', 'Wed 22', 'Thu 23', 'Fri 24']
			}
		});
		expect(screen.getByText('Time')).toBeInTheDocument();
		expect(screen.getByText('Mon 20')).toBeInTheDocument();
		expect(screen.getByText('6 AM')).toBeInTheDocument();
		expect(screen.getByText('8 AM')).toBeInTheDocument();
		expect(screen.getAllByText(':15').length).toBeGreaterThan(0);
		expect(screen.getAllByText(':30').length).toBeGreaterThan(0);
		expect(screen.getAllByText(':45').length).toBeGreaterThan(0);
		expect(screen.getByRole('button', { name: 'Mon 06:00' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Mon 08:15' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Mon 05:45' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Fri 23:45' })).toBeInTheDocument();
	});

	it('grays college-closed days and ignores paint on them', () => {
		let cells = new Set();
		render(FreeTimePaintGrid, {
			props: {
				freeCells: cells,
				commonCells: new Set(),
				dayColumns: [
					{ weekday: 'Mon', header: 'Mon 7', isNoClass: true, outOfTerm: false },
					{ weekday: 'Tue', header: 'Tue 8', isNoClass: false, outOfTerm: false },
					{ weekday: 'Wed', header: 'Wed 9', isNoClass: false, outOfTerm: false },
					{ weekday: 'Thu', header: 'Thu 10', isNoClass: false, outOfTerm: false },
					{ weekday: 'Fri', header: 'Fri 11', isNoClass: false, outOfTerm: false }
				],
				onChange: (next) => {
					cells = next;
				}
			}
		});
		expect(screen.getByText('No class')).toBeInTheDocument();
		const closed = screen.getByRole('button', { name: 'Mon 09:00' });
		expect(closed.className).toContain('no-class');
		expect(closed).toBeDisabled();
		fireEvent.keyDown(closed, { key: 'Enter' });
		expect(closed.getAttribute('aria-pressed')).toBe('false');
		expect(cells.has(paintCellKey('Mon', '09:00'))).toBe(false);
	});

	it('does not show the empty-grid import hint', () => {
		render(FreeTimePaintGrid, {
			props: {
				freeCells: new Set(),
				commonCells: new Set()
			}
		});
		expect(
			screen.queryByText(/Paint free slots below, or import an Omnivox schedule/i)
		).not.toBeInTheDocument();
		expect(
			screen.queryByText(/import an Omnivox schedule from the side panel/i)
		).not.toBeInTheDocument();
	});

	it('paints a heat map in view mode and lists members on hover and focus', () => {
		const shared = paintCellKey('Mon', '09:00');
		const onlyAda = paintCellKey('Tue', '11:00');
		render(FreeTimePaintGrid, {
			props: {
				mode: 'view',
				freeCells: new Set([shared]),
				commonCells: new Set([shared]),
				cellStats: {
					[shared]: {
						free: ['Ada', 'Blake'],
						busy: [],
						freeCount: 2,
						total: 2,
						ratio: 1
					},
					[onlyAda]: {
						free: ['Ada'],
						busy: ['Blake'],
						freeCount: 1,
						total: 2,
						ratio: 0.5
					}
				}
			}
		});
		expect(screen.getByText('Group free time')).toBeInTheDocument();
		expect(screen.getByLabelText('Heat scale')).toBeInTheDocument();
		expect(screen.queryByText('Your free time')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
		const bothFree = screen.getByRole('button', { name: 'Mon 09:00' });
		expect(bothFree).toHaveClass('heat');
		expect(bothFree).not.toHaveClass('selected');
		expect(bothFree).not.toHaveClass('common');
		expect(bothFree).not.toHaveAttribute('aria-pressed');
		expect(bothFree).toHaveAttribute('data-free-count', '2');
		expect(bothFree.style.getPropertyValue('--heat-ratio')).toBe('1');

		fireEvent.pointerEnter(bothFree);
		const tooltip = screen.getByRole('tooltip');
		expect(tooltip).toHaveTextContent('Available');
		expect(tooltip).toHaveTextContent('Ada');
		expect(tooltip).toHaveTextContent('Blake');
		expect(tooltip).toHaveTextContent('Unavailable');
		expect(tooltip).toHaveTextContent('None');
		fireEvent.pointerLeave(bothFree);
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

		const mixed = screen.getByRole('button', { name: 'Tue 11:00' });
		mixed.focus();
		fireEvent.focus(mixed);
		expect(screen.getByRole('tooltip')).toHaveTextContent('Ada');
		expect(screen.getByRole('tooltip')).toHaveTextContent('Blake');
		fireEvent.keyDown(mixed, { key: 'Enter' });
		expect(mixed).not.toHaveClass('selected');
		fireEvent.keyDown(mixed, { key: 'Escape' });
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
	});

	it('shows none on both sides and ignores paint while viewing', () => {
		let cells = new Set();
		const empty = paintCellKey('Wed', '12:00');
		render(FreeTimePaintGrid, {
			props: {
				mode: 'view',
				freeCells: cells,
				commonCells: new Set(),
				cellStats: {
					[empty]: {
						free: [],
						busy: ['Ada', 'Blake'],
						freeCount: 0,
						total: 2,
						ratio: 0
					}
				},
				onChange: (next) => {
					cells = next;
				}
			}
		});
		const cell = screen.getByRole('button', { name: 'Wed 12:00' });
		fireEvent.pointerDown(cell);
		fireEvent.keyDown(cell, { key: ' ' });
		expect(cells.size).toBe(0);
		fireEvent.pointerEnter(cell);
		expect(screen.getByRole('tooltip')).toHaveTextContent('Available');
		expect(screen.getByRole('tooltip')).toHaveTextContent('None');
		expect(screen.getByRole('tooltip')).toHaveTextContent('Ada');
	});

	it('explains an empty included-member set on hover', () => {
		render(FreeTimePaintGrid, {
			props: {
				mode: 'view',
				freeCells: new Set(),
				commonCells: new Set(),
				cellStats: {}
			}
		});
		fireEvent.pointerEnter(screen.getByRole('button', { name: 'Mon 09:00' }));
		expect(screen.getByRole('tooltip')).toHaveTextContent('No members included');
	});

	it('does not show a member tooltip while editing', () => {
		render(FreeTimePaintGrid, {
			props: {
				mode: 'edit',
				freeCells: new Set(),
				commonCells: new Set(),
				cellStats: {
					[paintCellKey('Mon', '09:00')]: {
						free: ['Ada'],
						busy: [],
						freeCount: 1,
						total: 1,
						ratio: 1
					}
				}
			}
		});
		fireEvent.pointerEnter(screen.getByRole('button', { name: 'Mon 09:00' }));
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
	});

	it('keeps the open tooltip when leaving a different cell', () => {
		const mon = paintCellKey('Mon', '09:00');
		const tue = paintCellKey('Tue', '09:00');
		render(FreeTimePaintGrid, {
			props: {
				mode: 'view',
				freeCells: new Set(),
				commonCells: new Set(),
				cellStats: {
					[mon]: {
						free: ['Ada'],
						busy: [],
						freeCount: 1,
						total: 1,
						ratio: 1
					},
					[tue]: {
						free: [],
						busy: ['Ada'],
						freeCount: 0,
						total: 1,
						ratio: 0
					}
				}
			}
		});
		fireEvent.pointerEnter(screen.getByRole('button', { name: 'Mon 09:00' }));
		fireEvent.pointerEnter(screen.getByRole('button', { name: 'Tue 09:00' }));
		fireEvent.pointerLeave(screen.getByRole('button', { name: 'Mon 09:00' }));
		expect(screen.getByRole('tooltip')).toHaveTextContent('Unavailable');
		expect(screen.getByRole('tooltip')).toHaveTextContent('Ada');
	});
});
