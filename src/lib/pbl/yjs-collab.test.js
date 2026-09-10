import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { describe, expect, it } from 'vitest';
import { MAX_SOURCE_CHARS } from './room-state.js';
import {
	AWARENESS_TTL_MS,
	MAX_YJS_STATE_CHARS,
	PYTHON_YTEXT,
	applyRemoteAwareness,
	applyRemoteYjs,
	bytesToBase64,
	encodeLocalAwareness,
	mergeAwarenessStates,
	mergeYjsStates,
	normalizeYjsState,
	teammateColor,
	teammateName,
	collabUserFromProfile,
	encodeSourceAsYjs
} from './yjs-collab.js';

describe('yjs collab merge', () => {

	it('encodes plain source as a replaceable Yjs snapshot', () => {
		const encoded = encodeSourceAsYjs('print(1)');
		expect(typeof encoded).toBe('string');
		expect(encoded.length).toBeGreaterThan(0);
		const merged = mergeYjsStates('', encoded);
		expect(merged.source).toBe('print(1)');
		expect(encodeSourceAsYjs('')).toBeTruthy();
		expect(() => encodeSourceAsYjs('x'.repeat(MAX_SOURCE_CHARS + 1))).toThrow(
			'The program is too long to sync.'
		);
	});
	it('rejects a bad or oversized state string', () => {
		expect(normalizeYjsState(undefined)).toBe('');
		expect(normalizeYjsState(null)).toBe('');
		expect(normalizeYjsState('')).toBe('');
		expect(normalizeYjsState(12)).toBeNull();
		expect(normalizeYjsState('%%%')).toBeNull();
		expect(normalizeYjsState('a'.repeat(MAX_YJS_STATE_CHARS + 1))).toBeNull();
		expect(normalizeYjsState('abc=')).toBe('abc=');
	});

	it('merges two Y.Text inserts instead of last-write-wins', () => {
		const left = new Y.Doc();
		left.getText(PYTHON_YTEXT).insert(0, 'AAA');
		const right = new Y.Doc();
		right.getText(PYTHON_YTEXT).insert(0, 'BBB');
		const merged = mergeYjsStates(
			bytesToBase64(Y.encodeStateAsUpdate(left)),
			bytesToBase64(Y.encodeStateAsUpdate(right))
		);
		expect(merged.source).toContain('AAA');
		expect(merged.source).toContain('BBB');
		left.destroy();
		right.destroy();
		const onlyIncoming = mergeYjsStates('', merged.yjsState);
		expect(onlyIncoming.source).toBe(merged.source);
		const onlyStored = mergeYjsStates(merged.yjsState, '');
		expect(onlyStored.source).toBe(merged.source);
	});

	it('keeps a program under the source cap', () => {
		const doc = new Y.Doc();
		doc.getText(PYTHON_YTEXT).insert(0, 'print(1)\n');
		expect(mergeYjsStates('', bytesToBase64(Y.encodeStateAsUpdate(doc))).source).toBe('print(1)\n');
		doc.destroy();
		const huge = new Y.Doc();
		huge.getText(PYTHON_YTEXT).insert(0, 'x'.repeat(MAX_SOURCE_CHARS + 1));
		expect(() => mergeYjsStates('', bytesToBase64(Y.encodeStateAsUpdate(huge)))).toThrow(
			'The program is too long to sync.'
		);
		huge.destroy();
	});

	it('names and colors teammates from a stable seed', () => {
		expect(teammateName('Ada Lovelace')).toBe('Ada Lovelace');
		expect(teammateName('ada@marihacks.com')).toBe('ada');
		expect(teammateName('abcdef0123456789abcdef0123456789')).toBe('Teammate abcd');
		expect(teammateName('')).toBe('Teammate');
		expect(teammateName(null)).toBe('Teammate');
		expect(teammateColor('alpha').color).toMatch(/^#/u);
		expect(teammateColor('alpha')).toEqual(teammateColor('alpha'));
		expect(teammateColor('').color).toMatch(/^#/u);
		const user = collabUserFromProfile({
			name: 'Zhich',
			email: 'zhich@example.com',
			userId: 'user-1'
		});
		expect(user.name).toBe('Zhich');
		expect(user.color).toMatch(/^#/u);
		expect(collabUserFromProfile({ email: 'ada@marihacks.com' }).name).toBe('ada');
	});

	it('merges awareness so both cursors survive, then drops stale peers', () => {
		const leftDoc = new Y.Doc();
		const left = new Awareness(leftDoc);
		left.setLocalStateField('user', { name: 'Ada', color: '#ff6188' });
		const rightDoc = new Y.Doc();
		const right = new Awareness(rightDoc);
		right.setLocalStateField('user', { name: 'Bo', color: '#a9dc76' });
		const merged = mergeAwarenessStates(
			encodeLocalAwareness(left),
			encodeLocalAwareness(right),
			Date.now()
		);
		expect(merged.length).toBeGreaterThan(0);
		const viewDoc = new Y.Doc();
		const view = new Awareness(viewDoc);
		view.setLocalState(null);
		applyRemoteAwareness(view, merged);
		applyRemoteAwareness(view, '');
		const names = [...view.getStates().values()].map((state) => state.user?.name);
		expect(names).toEqual(expect.arrayContaining(['Ada', 'Bo']));
		expect(mergeAwarenessStates(merged, '', Date.now() + AWARENESS_TTL_MS + 1)).toBe('');
		expect(mergeAwarenessStates('', '', Date.now())).toBe('');
		const emptyLocal = new Awareness(new Y.Doc());
		emptyLocal.setLocalState(null);
		expect(encodeLocalAwareness(emptyLocal)).toBe('');
		left.destroy();
		right.destroy();
		view.destroy();
		emptyLocal.destroy();
		leftDoc.destroy();
		rightDoc.destroy();
		viewDoc.destroy();
	});

	it('applies a remote Yjs update onto an existing doc', () => {
		const local = new Y.Doc();
		local.getText(PYTHON_YTEXT).insert(0, 'local');
		const remote = new Y.Doc();
		remote.getText(PYTHON_YTEXT).insert(0, 'remote');
		applyRemoteYjs(local, bytesToBase64(Y.encodeStateAsUpdate(remote)));
		applyRemoteYjs(local, '');
		expect(local.getText(PYTHON_YTEXT).toString()).toContain('local');
		expect(local.getText(PYTHON_YTEXT).toString()).toContain('remote');
		local.destroy();
		remote.destroy();
	});
});
