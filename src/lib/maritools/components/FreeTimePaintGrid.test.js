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
		expect(screen.getAllByText(':30').length).toBeGreaterThan(0);
		expect(screen.getByRole('button', { name: 'Mon 06:00' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Mon 05:30' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Fri 23:30' })).toBeInTheDocument();
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
});
