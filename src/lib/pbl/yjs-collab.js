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
	Object.freeze({ color: '#ff6188', colorLight: '#ff618833' }),
	Object.freeze({ color: '#a9dc76', colorLight: '#a9dc7633' }),
	Object.freeze({ color: '#78dce8', colorLight: '#78dce833' }),
	Object.freeze({ color: '#ffd866', colorLight: '#ffd86633' }),
	Object.freeze({ color: '#ab9df2', colorLight: '#ab9df233' }),
	Object.freeze({ color: '#fc9867', colorLight: '#fc986733' })
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

/** @param {unknown} memberId */
export function teammateName(memberId) {
	const id = typeof memberId === 'string' && memberId ? memberId : 'guest';
	return `Teammate ${id.slice(0, 4)}`;
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
