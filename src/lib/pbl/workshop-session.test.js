import { describe, expect, it } from 'vitest';
import {
	canOpenStep,
	nextUnlockedStep,
	studioNextAction,
	teamPace,
	timeOnStepLabel,
	withOpenedHint
} from './workshop-session.js';

describe('workshop session helpers', () => {
	it('opens unlocked steps and records hint levels in order', () => {
		expect(canOpenStep(0, 0)).toBe(true);
		expect(canOpenStep(1, 0)).toBe(false);
		expect(canOpenStep(11, 11)).toBe(true);
		expect(canOpenStep(12, 20)).toBe(false);
		expect(withOpenedHint({}, 3, 2)).toEqual({});
		expect(withOpenedHint({}, 3, 1)).toEqual({ '3': 1 });
		expect(withOpenedHint({ '3': 1 }, 3, 2)).toEqual({ '3': 2 });
		expect(withOpenedHint({ '3': 2 }, 3, 1)).toEqual({ '3': 2 });
		expect(withOpenedHint({ '3': 2 }, 3, 3)).toEqual({ '3': 3 });
		expect(withOpenedHint({}, 3, 0)).toEqual({});
		expect(withOpenedHint({}, -1, 1)).toEqual({});
	});

	it('unlocks the next step only after a passing check', () => {
		expect(nextUnlockedStep(2, false)).toBe(2);
		expect(nextUnlockedStep(2, true)).toBe(3);
		expect(nextUnlockedStep(11, true)).toBe(11);
	});

	it('labels time on the current step', () => {
		const start = '2026-09-08T15:00:00.000Z';
		expect(timeOnStepLabel(start, Date.parse(start) + 20_000)).toBe('under 1 min');
		expect(timeOnStepLabel(start, Date.parse(start) + 60_000)).toBe('1 min');
		expect(timeOnStepLabel(start, Date.parse(start) + 180_000)).toBe('3 min');
		expect(timeOnStepLabel('nope', 1)).toBe('0 min');
		expect(timeOnStepLabel(start, Date.parse(start) - 1000)).toBe('0 min');
	});

	it('tells a facilitator when the team is stuck or over time', () => {
		const start = '2026-09-08T15:00:00.000Z';
		const step = { id: 2, minutes: 7, title: 'Collections, indexing, len()' };
		expect(
			teamPace(
				step,
				{ step: 2, passed: false, message: 'Print the first reading.' },
				start,
				Date.parse(start) + 1000
			)
		).toMatchObject({ label: 'Stuck', detail: 'Print the first reading.' });
		expect(
			teamPace(step, { step: 2, passed: true, message: 'ok' }, start, Date.parse(start) + 8 * 60000)
		).toMatchObject({
			label: 'Over time'
		});
		expect(
			teamPace(step, { step: 2, passed: true, message: 'ok' }, start, Date.parse(start) + 1000)
		).toMatchObject({
			label: 'On track'
		});
		expect(studioNextAction({ blocked: 'full' })).toBe('This team is full.');
		expect(
			studioNextAction({
				lastCheck: { passed: false, message: 'Change the message, then run again.' }
			})
		).toBe('Not yet. Change the message, then run again.');
		expect(studioNextAction({ lastCheck: { passed: true }, currentStep: 0 })).toBe(
			'Open the next step.'
		);
		expect(studioNextAction({ lastCheck: null, currentStep: 0 })).toBe('');
	});
});
