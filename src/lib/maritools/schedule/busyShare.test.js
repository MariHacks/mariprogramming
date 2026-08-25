import { describe, expect, it } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from './fixture.js';
import { parseOmnivox } from './parseOmnivox.js';
import { busyShareDocument, busyShareJson } from './busyShare.js';

describe('busyShare', () => {
	it('exports busy intervals without course titles', () => {
		const courses = parseOmnivox(CANONICAL_OMNIVOX_SCHEDULE).courses;
		const doc = busyShareDocument({ people: [courses], termId: 'fall-2026' });
		expect(doc.kind).toBe('maritools-busy');
		expect(JSON.stringify(doc)).not.toContain('Badminton');
		expect(doc.people[0].busy.length).toBeGreaterThan(0);
	});

	it('formats JSON for copy/paste', () => {
		const json = busyShareJson({ people: [[]], date: '2026-09-08' });
		expect(json).toContain('"kind": "maritools-busy"');
		expect(json.endsWith('\n')).toBe(true);
	});
});
