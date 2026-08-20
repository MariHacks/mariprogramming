import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { load } from './+page.server.js';

describe('legacy teacher-only book route', () => {
	it('awaits the parent gate before redirecting to the catalogue', async () => {
		const parent = vi.fn().mockResolvedValue({ launchState: 'live' });
		await expect(load({ parent })).rejects.toMatchObject({ status: 308, location: '/books' });
		expect(parent).toHaveBeenCalledOnce();
	});
});
