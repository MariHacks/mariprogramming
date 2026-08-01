import { describe, expect, it } from 'vitest';
import { formatCad } from './format';

describe('formatCad', () => {
	it('formats integer cents as Canadian dollars', () => {
		expect(formatCad(7280)).toBe('$72.80');
	});

	it('formats zero cents without a negative zero', () => {
		expect(formatCad(0)).toBe('$0.00');
	});
});
