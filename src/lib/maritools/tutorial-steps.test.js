import { describe, expect, it } from 'vitest';
import { OMNIVOX_TUTORIAL_STEPS } from './tutorial-steps.js';

describe('OMNIVOX_TUTORIAL_STEPS', () => {
	it('uses the real Omnivox button labels and the right-hand list', () => {
		expect(OMNIVOX_TUTORIAL_STEPS).toHaveLength(9);
		const text = OMNIVOX_TUTORIAL_STEPS.map((step) => `${step.title} ${step.body}`).join(' ');
		expect(text).toContain('Obtain my schedule');
		expect(text).toContain('Click here for a printer-friendly version');
		expect(text).toContain('Compact printable semester schedule');
		expect(text).toContain('View');
		expect(text).toMatch(/right/);
		expect(text.toLowerCase()).not.toContain('scribe');
	});
});
