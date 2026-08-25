import { building } from '$app/environment';
import { readRuntimeEnvironment } from '../config/environment.js';
import { createMariToolsRepository } from './repository.js';

/** @type {Promise<void> | null} */
let bootstrapPromise = null;

/** Seeds committed academic terms into Postgres once per process. */
export async function ensureMariToolsBootstrap() {
	if (building) return;
	if (bootstrapPromise) return bootstrapPromise;
	bootstrapPromise = (async () => {
		try {
			const { databaseUrl } = readRuntimeEnvironment();
			if (!databaseUrl) return;
			const repository = createMariToolsRepository({ databaseUrl });
			await repository.seedFall2026();
		} catch {
			/* missing env or DB — tools pages handle unavailability */
		}
	})();
	return bootstrapPromise;
}
