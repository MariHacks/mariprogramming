import { describe, expect, it } from 'vitest';
import {
	GAMEJAM_PBL_ID,
	PBL_CATALOG,
	getPblById,
	getPblByPath,
	resolvePblHeaderLabel,
	SCIENCE_PBL_ID
} from './catalog.js';

describe('PBL catalog', () => {
	it('ships PBL 1 and PBL 2 as joinable workshops, not archive items', () => {
		expect(SCIENCE_PBL_ID).toBe('science');
		expect(GAMEJAM_PBL_ID).toBe('gamejam');
		expect(PBL_CATALOG).toEqual([
			{
				id: 'science',
				title: 'Speedrun Programming in Science',
				series: 'PBL 1',
				href: '/pbl/science',
				summary:
					'Little or no Python needed — your team builds one scientific data analyzer that grows step by step from a first print to a short report.'
			},
			{
				id: 'gamejam',
				title: 'Game Jam: Survive the Day',
				series: 'PBL 2',
				href: '/pbl/gamejam',
				summary:
					'Your team builds one text adventure that grows scene by scene, from a first print to a game with choices, dice rolls and a surprise quiz, then adds a scene of its own.'
			}
		]);
		expect(Object.isFrozen(PBL_CATALOG)).toBe(true);
		expect(Object.isFrozen(PBL_CATALOG[0])).toBe(true);
		expect(Object.isFrozen(PBL_CATALOG[1])).toBe(true);
	});

	it('looks up a PBL by id without assuming there will only ever be one', () => {
		expect(getPblById('science')?.title).toBe('Speedrun Programming in Science');
		expect(getPblById('gamejam')?.series).toBe('PBL 2');
		expect(getPblById('missing')).toBeNull();
		expect(getPblById(1)).toBeNull();
	});
});

describe('getPblByPath', () => {
	it('finds the workshop a /pbl path belongs to', () => {
		expect(getPblByPath('/pbl/science')?.id).toBe('science');
		expect(getPblByPath('/pbl/gamejam/AB23JK')?.id).toBe('gamejam');
		expect(getPblByPath('/pbl')).toBeNull();
		expect(getPblByPath('/pbl/missing')).toBeNull();
		expect(getPblByPath('/about-us/gamejam')).toBeNull();
		expect(getPblByPath(undefined)).toBeNull();
	});
});

describe('resolvePblHeaderLabel', () => {
	it('uses Workshops on the hub and unknown series, and the catalog title on known paths', () => {
		expect(resolvePblHeaderLabel('/pbl')).toBe('Workshops');
		expect(resolvePblHeaderLabel('/pbl/science')).toBe('Speedrun Programming in Science');
		expect(resolvePblHeaderLabel('/pbl/science/ABC123')).toBe('Speedrun Programming in Science');
		expect(resolvePblHeaderLabel('/pbl/gamejam')).toBe('Game Jam: Survive the Day');
		expect(resolvePblHeaderLabel('/pbl/gamejam/ABC123')).toBe('Game Jam: Survive the Day');
		expect(resolvePblHeaderLabel('/pbl/missing')).toBe('Workshops');
		expect(resolvePblHeaderLabel('/about-us')).toBe('Workshops');
		expect(resolvePblHeaderLabel(null)).toBe('Workshops');
	});
});
