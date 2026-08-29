import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import { asOfDate, explicitTermId, termResolution } from './session.js';

afterEach(() => {
	explicitTermId.set(null);
	asOfDate.set(null);
});

describe('termResolution', () => {
	it('can pin Fall 2026 explicitly', () => {
		explicitTermId.set('fall-2026');
		expect(get(termResolution).reason).toBe('explicit');
		expect(get(termResolution).selected?.id).toBe('fall-2026');
	});

	it('treats an unknown pin as none', () => {
		explicitTermId.set('not-a-term');
		expect(get(termResolution).reason).toBe('none');
		expect(get(termResolution).selected).toBeNull();
	});

	it('returns none on a gap date between Fall and Winter', () => {
		asOfDate.set('2027-01-05');
		expect(get(termResolution).reason).toBe('none');
		expect(get(termResolution).selected).toBeNull();
	});

	it('lets an explicit Fall 2026 pin win on a gap date', () => {
		asOfDate.set('2027-01-05');
		explicitTermId.set('fall-2026');
		expect(get(termResolution).reason).toBe('explicit');
		expect(get(termResolution).selected?.id).toBe('fall-2026');
	});
});
