import { describe, expect, it } from 'vitest';
import {
	loadSchedulePaste,
	saveSchedulePaste,
	SCHEDULE_PASTE_STORAGE_KEY
} from './persistPaste.js';

function memoryStorage() {
	/** @type {Map<string, string>} */
	const map = new Map();
	return {
		getItem: (key) => (map.has(key) ? map.get(key) : null),
		setItem: (key, value) => {
			map.set(key, value);
		},
		removeItem: (key) => {
			map.delete(key);
		}
	};
}

describe('schedule paste persistence', () => {
	it('round-trips paste text', () => {
		const storage = memoryStorage();
		saveSchedulePaste(storage, '1\tCalculus\n');
		expect(loadSchedulePaste(storage)).toBe('1\tCalculus\n');
		expect(storage.getItem(SCHEDULE_PASTE_STORAGE_KEY)).toBe('1\tCalculus\n');
	});

	it('clears storage for blank paste', () => {
		const storage = memoryStorage();
		saveSchedulePaste(storage, 'course list');
		saveSchedulePaste(storage, '   ');
		expect(loadSchedulePaste(storage)).toBe('');
		expect(storage.getItem(SCHEDULE_PASTE_STORAGE_KEY)).toBeNull();
	});
});
