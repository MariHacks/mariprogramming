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
		expect(screen.getByText('8 AM')).toBeInTheDocument();
		expect(screen.getAllByText(':30').length).toBeGreaterThan(0);
	});
});
