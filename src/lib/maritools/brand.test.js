import { describe, expect, it } from 'vitest';
import { MARITOOLS_INITIATIVE, MARITOOLS_LINE, MARITOOLS_NAME } from './brand.js';

describe('MariTools brand', () => {
	it('keeps the working name and club line', () => {
		expect(MARITOOLS_NAME).toBe('MariTools');
		expect(MARITOOLS_LINE).toContain('Marianopolis students');
		expect(MARITOOLS_INITIATIVE).toContain('Programming Club');
	});
});
