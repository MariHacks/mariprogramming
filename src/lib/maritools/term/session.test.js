import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import { explicitTermId, termResolution } from './session.js';

afterEach(() => {
	explicitTermId.set(null);
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
});
