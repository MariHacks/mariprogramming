export const SCHEDULE_PASTE_STORAGE_KEY = 'maritools.schedule.omnivox-paste';

/**
 * @param {Pick<Storage, 'getItem'>} storage
 */
export function loadSchedulePaste(storage) {
	const raw = storage.getItem(SCHEDULE_PASTE_STORAGE_KEY);
	return typeof raw === 'string' ? raw : '';
}

/**
 * @param {Pick<Storage, 'setItem' | 'removeItem'>} storage
 * @param {string} paste
 */
export function saveSchedulePaste(storage, paste) {
	const value = String(paste ?? '');
	if (!value.trim()) {
		storage.removeItem(SCHEDULE_PASTE_STORAGE_KEY);
		return;
	}
	storage.setItem(SCHEDULE_PASTE_STORAGE_KEY, value);
}
