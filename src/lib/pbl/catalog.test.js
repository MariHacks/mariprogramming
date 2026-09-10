import { describe, expect, it } from 'vitest';
import { PBL_CATALOG, getPblById, SCIENCE_PBL_ID } from './catalog.js';

describe('PBL catalog', () => {
	it('ships PBL 1 as a joinable workshop, not an archive item', () => {
		expect(SCIENCE_PBL_ID).toBe('science');
		expect(PBL_CATALOG).toEqual([
			{
				id: 'science',
				title: 'Speedrun Programming in Science',
				series: 'PBL 1',
				href: '/pbl/science',
				summary:
					'Little or no Python needed. Your team builds one scientific data analyzer that grows step by step.'
			}
		]);
		expect(Object.isFrozen(PBL_CATALOG)).toBe(true);
		expect(Object.isFrozen(PBL_CATALOG[0])).toBe(true);
	});

	it('looks up a PBL by id without assuming there will only ever be one', () => {
		expect(getPblById('science')?.title).toBe('Speedrun Programming in Science');
		expect(getPblById('missing')).toBeNull();
		expect(getPblById(1)).toBeNull();
	});
});
