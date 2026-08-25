import { describe, expect, it } from 'vitest';
import { CANONICAL_OMNIVOX_SCHEDULE } from '$lib/maritools/schedule/fixture.js';
import { actions, prerender } from './+page.server.js';

describe('schedule form action', () => {
	it('is not prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('parses the canonical paste', async () => {
		const result = await actions.default({
			request: {
				formData: async () => {
					const data = new FormData();
					data.set('paste', CANONICAL_OMNIVOX_SCHEDULE);
					return data;
				}
			}
		});
		expect(result.result.ok).toBe(true);
		expect(result.result.courses).toHaveLength(7);
	});

	it('parses empty paste as not ok', async () => {
		const result = await actions.default({
			request: {
				formData: async () => new FormData()
			}
		});
		expect(result.result.ok).toBe(false);
	});
});
