// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as environment from '../config/environment.js';
import { MariToolsUnavailableError } from './repository.js';
import { createGoogleCalendarStore, openGoogleCalendarStore } from './google-calendar-store.js';

/** @param {unknown[]} queue */
function queuedStore(queue) {
	let index = 0;
	const runTransaction = vi.fn(async (operation) => {
		const take = () => {
			const item = queue[index++];
			if (item instanceof Error) throw item;
			return item;
		};
		const chain = {
			select: () => chain,
			from: () => chain,
			where: () => chain,
			limit: () => chain,
			insert: () => chain,
			values: () => chain,
			update: () => chain,
			set: () => chain,
			then(resolve, reject) {
				return Promise.resolve().then(take).then(resolve, reject);
			}
		};
		return operation(chain);
	});
	return createGoogleCalendarStore('postgresql://maritools-test', runTransaction);
}

describe('createGoogleCalendarStore', () => {
	it('rejects invalid configuration', () => {
		expect(() => createGoogleCalendarStore('')).toThrow(MariToolsUnavailableError);
		expect(() => createGoogleCalendarStore(/** @type {any} */ (null))).toThrow(MariToolsUnavailableError);
	});

	it('reports whether a grant exists', async () => {
		const store = queuedStore([[{ userId: 'user-1' }], []]);
		expect(await store.hasGrant('user-1')).toBe(true);
		expect(await store.hasGrant('user-2')).toBe(false);
	});

	it('upserts and refreshes access tokens', async () => {
		const store = queuedStore([[], [], []]);
		await store.upsertGrant('user-1', { refreshToken: 'refresh' });
		await store.updateAccessToken('user-1', {
			accessToken: 'new-access',
			accessTokenExpiresAt: new Date('2031-01-01T00:00:00.000Z')
		});
	});

	it('updates an existing grant and reads it back', async () => {
		const existing = {
			userId: 'user-1',
			refreshToken: 'old',
			accessToken: 'old-access',
			accessTokenExpiresAt: new Date('2030-01-01T00:00:00.000Z')
		};
		const store = queuedStore([[existing], [], [existing]]);
		await store.upsertGrant('user-1', { refreshToken: 'refresh' });
		await expect(store.getGrant('user-1')).resolves.toMatchObject({ userId: 'user-1' });
		const missing = queuedStore([[]]);
		await expect(missing.getGrant('user-2')).resolves.toBeNull();
	});
});

describe('openGoogleCalendarStore', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('builds a store from the runtime database url', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockReturnValue({
			databaseUrl: 'postgresql://runtime'
		});
		expect(typeof openGoogleCalendarStore().hasGrant).toBe('function');
	});

	it('treats missing runtime config as unavailable', () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockImplementation(() => {
			throw new Error('missing');
		});
		expect(() => openGoogleCalendarStore()).toThrow(MariToolsUnavailableError);
	});
});
