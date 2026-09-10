import * as Y from 'yjs';
import {
	Awareness,
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	removeAwarenessStates
} from 'y-protocols/awareness';
import { MAX_SOURCE_CHARS } from './room-state.js';

export const PYTHON_YTEXT = 'python';
export const MAX_YJS_STATE_CHARS = 200000;
export const AWARENESS_TTL_MS = 30000;

export const TEAMMATE_COLORS = Object.freeze([
	// Solid, high-contrast on light Monokai; colorLight is soft selection wash.
	Object.freeze({ color: '#0b4cf4', colorLight: '#0b4cf433' }), // club blue
	Object.freeze({ color: '#df5b48', colorLight: '#df5b4833' }), // coral
	Object.freeze({ color: '#0f766e', colorLight: '#0f766e33' }), // teal
	Object.freeze({ color: '#7c3aed', colorLight: '#7c3aed33' }), // violet
	Object.freeze({ color: '#c2410c', colorLight: '#c2410c33' }), // burnt orange
	Object.freeze({ color: '#0369a1', colorLight: '#0369a133' }) // sky
]);

/** @param {Uint8Array | ArrayLike<number>} bytes */
export function bytesToBase64(bytes) {
	const arr = new Uint8Array(bytes);
	let binary = '';
	for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
	return btoa(binary);
}

/** @param {string} value */
export function base64ToBytes(value) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** @param {unknown} value */
export function normalizeYjsState(value) {
	if (value === null || value === undefined || value === '') return '';
	if (typeof value !== 'string') return null;
	if (value.length > MAX_YJS_STATE_CHARS) return null;
	if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(value)) return null;
	return value;
}

/** @param {string} seed */
export function teammateColor(seed) {
	let hash = 0;
	for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
	const index = Math.abs(hash) % TEAMMATE_COLORS.length;
	return TEAMMATE_COLORS[index];
}

/**
 * Prefer a real account display name / email local-part; fall back to a short id label.
 * @param {unknown} identity name string, email, or opaque id
 */
export function teammateName(identity) {
	if (typeof identity === 'string') {
		const trimmed = identity.trim();
		if (trimmed.includes('@')) {
			const local = trimmed.split('@')[0]?.trim();
			if (local) return local.slice(0, 40);
		}
		if (trimmed.length > 0 && !/^[0-9a-f]{8,}$/iu.test(trimmed)) {
			return trimmed.slice(0, 40);
		}
		if (trimmed.length > 0) return `Teammate ${trimmed.slice(0, 4)}`;
	}
	return 'Teammate';
}

/**
 * @param {{ name?: string | null, email?: string | null, userId?: string | null, memberId?: string | null } | null | undefined} profile
 */
export function collabUserFromProfile(profile) {
	const seed =
		(typeof profile?.userId === 'string' && profile.userId) ||
		(typeof profile?.memberId === 'string' && profile.memberId) ||
		(typeof profile?.email === 'string' && profile.email) ||
		'guest';
	const colors = teammateColor(seed);
	const name =
		(typeof profile?.name === 'string' && profile.name.trim()) ||
		(typeof profile?.email === 'string' && profile.email.trim()) ||
		seed;
	return {
		name: teammateName(name),
		color: colors.color,
		colorLight: colors.colorLight
	};
}


/**
 * Build a fresh Yjs update that contains only `source` (for step copy / replace).
 * @param {string} source
 */
export function encodeSourceAsYjs(source) {
	const doc = new Y.Doc();
	try {
		const text = typeof source === 'string' ? source : '';
		if (text.length > MAX_SOURCE_CHARS) {
			throw new Error('The program is too long to sync.');
		}
		if (text) doc.getText(PYTHON_YTEXT).insert(0, text);
		return bytesToBase64(Y.encodeStateAsUpdate(doc));
	} finally {
		doc.destroy();
	}
}

/**
 * @param {string} stored
 * @param {string} incoming
 */
export function mergeYjsStates(stored, incoming) {
	const doc = new Y.Doc();
	try {
		if (stored) Y.applyUpdate(doc, base64ToBytes(stored));
		if (incoming) Y.applyUpdate(doc, base64ToBytes(incoming));
		const source = doc.getText(PYTHON_YTEXT).toString();
		if (source.length > MAX_SOURCE_CHARS) {
			throw new Error('The program is too long to sync.');
		}
		return {
			yjsState: bytesToBase64(Y.encodeStateAsUpdate(doc)),
			source
		};
	} finally {
		doc.destroy();
	}
}

/** @param {Awareness} awareness */
export function encodeLocalAwareness(awareness) {
	if (awareness.getLocalState() === null) return '';
	return bytesToBase64(encodeAwarenessUpdate(awareness, [awareness.clientID]));
}

/**
 * @param {string} stored
 * @param {string} incoming
 * @param {number} nowMs
 */
export function mergeAwarenessStates(stored, incoming, nowMs) {
	const doc = new Y.Doc();
	const awareness = new Awareness(doc);
	awareness.setLocalState(null);
	try {
		if (stored) applyAwarenessUpdate(awareness, base64ToBytes(stored), 'stored');
		if (incoming) applyAwarenessUpdate(awareness, base64ToBytes(incoming), 'incoming');
		const stale = [];
		awareness.meta.forEach((meta, clientId) => {
			if (clientId !== awareness.clientID && nowMs - meta.lastUpdated > AWARENESS_TTL_MS) {
				stale.push(clientId);
			}
		});
		if (stale.length > 0) removeAwarenessStates(awareness, stale, 'timeout');
		const ids = [...awareness.getStates().keys()].filter((id) => id !== awareness.clientID);
		if (ids.length === 0) return '';
		return bytesToBase64(encodeAwarenessUpdate(awareness, ids));
	} finally {
		awareness.destroy();
		doc.destroy();
	}
}

/**
 * @param {Awareness} awareness
 * @param {string} encoded
 * @param {string} origin
 */
export function applyRemoteAwareness(awareness, encoded, origin = 'remote') {
	if (!encoded) return;
	applyAwarenessUpdate(awareness, base64ToBytes(encoded), origin);
}

/** @param {Y.Doc} doc @param {string} encoded */
export function applyRemoteYjs(doc, encoded) {
	if (!encoded) return;
	Y.applyUpdate(doc, base64ToBytes(encoded));
}
