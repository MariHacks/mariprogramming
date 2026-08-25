import { describe, expect, it } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from './fixture.js';
import { busyShareDocument, busyShareJson } from './busyShare.js';
import { parseOmnivox } from './parseOmnivox.js';

describe('busyShareDocument', () => {
	it('shares busy intervals without course names', () => {
		const people = [parseOmnivox(CANONICAL_OMNIVOX_SCHEDULE).courses];
		const document = busyShareDocument({
			people,
			labels: ['Ada'],
			termId: 'fall-2026',
			date: '2026-09-08'
		});
		expect(document.kind).toBe('maritools-busy');
		expect(document.people[0].label).toBe('Ada');
		expect(document.people[0].busy[0]).toEqual({
			weekday: 'Mon',
			startTime: '08:15',
			endTime: '10:05'
		});
		expect(JSON.stringify(document)).not.toMatch(/Badminton|2530622|teacher/i);
		expect(busyShareJson({ people })).toContain('Person 1');
		expect(busyShareJson({ people }).endsWith('\n')).toBe(true);
	});
});
