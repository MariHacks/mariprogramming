import { describe, expect, it } from 'vitest';
import {
	SCIENCE_FINAL_READINGS,
	SCIENCE_READINGS,
	SCIENCE_STARTER_SOURCE,
	SCIENCE_STEPS,
	SCIENCE_VALID_MAX,
	SCIENCE_VALID_MIN,
	getScienceStep,
	scienceAverage,
	scienceValidReadings
} from './science-workshop.js';

describe('PBL 1 science workshop', () => {
	it('is one growing analyzer across twelve timed steps', () => {
		expect(SCIENCE_STEPS.map((step) => step.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
		expect(SCIENCE_STEPS[0].starter).toBe(SCIENCE_STARTER_SOURCE);
		expect(SCIENCE_READINGS).toEqual([12.1, 11.8, 12.3, 48.7, 12.0, 11.9]);
		expect(SCIENCE_FINAL_READINGS).toEqual([12.4, 12.6, 26.1, 12.5, 12.8, 12.3]);
		expect(SCIENCE_VALID_MIN).toBe(10);
		expect(SCIENCE_VALID_MAX).toBe(20);
		expect(scienceValidReadings()).toEqual([12.1, 11.8, 12.3, 12.0, 11.9]);
		expect(scienceAverage(scienceValidReadings())).toBeCloseTo(12.02);
		expect(scienceAverage(scienceValidReadings(SCIENCE_FINAL_READINGS))).toBeCloseTo(12.52);
		expect(scienceAverage([])).toBeNull();
		expect(getScienceStep(-1)).toBeNull();
		expect(getScienceStep(1.2)).toBeNull();
	});

	it('gives three hint levels and never puts a full solution in hint 1', () => {
		for (const step of SCIENCE_STEPS) {
			expect(step.hints).toHaveLength(3);
			expect(step.hints[0].length).toBeGreaterThan(20);
			expect(step.hints[0]).not.toMatch(/\n/);
			expect(step.hints[0]).not.toMatch(/^\s*(?:def |print\(|import |for |while )/u);
			expect(step.hints[2]).toMatch(/print\(|def |for |while |import |append\(|sqrt|=|open\(/u);
			expect(step.body.length).toBeLessThan(900);
		}
		expect(getScienceStep(0)?.title).toBe('Get something running');
		expect(getScienceStep(11)?.title).toBe('Final boss');
		expect(getScienceStep(12)).toBeNull();
		expect(SCIENCE_STEPS[11].stretch).toMatch(/matplotlib/i);
		for (const step of SCIENCE_STEPS) {
			const blob = [step.title, step.body, ...(step.notes ?? []), ...step.hints, step.stretch ?? ''].join('\n');
			expect(blob).not.toMatch(/[\u2013\u2014]/u);
		}
	});
});
