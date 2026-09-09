import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPythonCollabEditor } from './python-editor.js';

function layoutBox() {
	return {
		x: 0,
		y: 0,
		width: 640,
		height: 24,
		top: 0,
		right: 640,
		bottom: 24,
		left: 0,
		toJSON() {
			return this;
		}
	};
}

beforeAll(() => {
	Range.prototype.getBoundingClientRect = layoutBox;
	Range.prototype.getClientRects = () => {
		const rect = layoutBox();
		return {
			item: (index) => (index === 0 ? rect : null),
			length: 1,
			[Symbol.iterator]: function* () {
				yield rect;
			}
		};
	};
});

/** @type {HTMLDivElement[]} */
const hosts = [];

function mount(options = {}) {
	const parent = document.createElement('div');
	document.body.append(parent);
	hosts.push(parent);
	return createPythonCollabEditor(parent, options);
}

afterEach(() => {
	for (const host of hosts) host.remove();
	hosts.length = 0;
});

describe('python collab editor', () => {
	it('needs a host element', () => {
		expect(() => createPythonCollabEditor(/** @type {any} */ (null))).toThrow(
			'Python editor needs a host element.'
		);
	});

	it('loads source into a Y.Text bound CodeMirror view', () => {
		const editor = mount({ source: 'print("hi")\n' });
		expect(editor.getSource()).toBe('print("hi")\n');
		expect(editor.view.state.doc.toString()).toBe('print("hi")\n');
		expect(editor.ytext.toString()).toBe('print("hi")\n');
		const content = editor.view.contentDOM;
		expect(content.getAttribute('aria-label')).toBe('Python');
		expect(content.getAttribute('aria-readonly')).toBe('false');
		editor.destroy();
	});

	it('starts empty, names the textbox, and stays read-only until unlocked', () => {
		const editor = mount({ editable: false, label: 'Lab Python' });
		expect(editor.getSource()).toBe('');
		expect(editor.view.contentDOM.getAttribute('aria-label')).toBe('Lab Python');
		expect(editor.view.contentDOM.getAttribute('aria-readonly')).toBe('true');
		expect(editor.view.contentDOM.getAttribute('contenteditable')).toBe('false');
		editor.setSource('print("later")');
		expect(editor.getSource()).toBe('print("later")');
		editor.view.dispatch({
			changes: { from: editor.view.state.doc.length, insert: '\n# local' }
		});
		expect(editor.getSource()).toContain('# local');
		editor.setEditable(true);
		expect(editor.view.contentDOM.getAttribute('contenteditable')).toBe('true');
		expect(editor.view.contentDOM.getAttribute('aria-readonly')).toBe('false');
		editor.setEditable(false);
		expect(editor.view.contentDOM.getAttribute('contenteditable')).toBe('false');
		editor.destroy();
	});

	it('reports local typing and applies a remote snapshot without echoing it', () => {
		const onChange = vi.fn();
		const editor = mount({ source: 'print(1)', onChange });
		editor.view.dispatch({
			changes: { from: editor.view.state.doc.length, insert: '\nprint(2)' }
		});
		expect(onChange.mock.calls[0][0].source).toBe('print(1)\nprint(2)');
		expect(editor.getSource()).toBe('print(1)\nprint(2)');
		onChange.mockClear();
		editor.setSource('print(1)\nprint(2)');
		expect(onChange).not.toHaveBeenCalled();
		editor.setSource('print("remote")');
		expect(editor.getSource()).toBe('print("remote")');
		expect(editor.view.state.doc.toString()).toBe('print("remote")');
		expect(onChange).not.toHaveBeenCalled();
		editor.setSource('');
		expect(editor.getSource()).toBe('');
		editor.setSource(/** @type {any} */ (null));
		expect(editor.getSource()).toBe('');
		editor.destroy();
	});

	it('applies a Y.Text insert from the shared document into the view', () => {
		const editor = mount({ source: 'print(1)' });
		editor.ytext.insert(editor.ytext.length, '\n# teammate');
		expect(editor.view.state.doc.toString()).toBe('print(1)\n# teammate');
		editor.destroy();
	});

	it('loads a Yjs snapshot and applies a remote teammate update', () => {
		const onChange = vi.fn();
		const author = mount({
			source: 'print("A")',
			user: { name: 'Ada', color: '#ff6188', colorLight: '#ff618833' },
			onChange
		});
		const snapshot = author.encode();
		const peer = mount({
			yjsState: snapshot.yjsState,
			awarenessState: snapshot.awarenessState,
			user: { name: 'Bo', color: '#a9dc76', colorLight: '#a9dc7633' }
		});
		expect(peer.getSource()).toBe('print("A")');
		author.ytext.insert(author.ytext.length, '\nprint("B")');
		peer.applyYjsState(author.encode().yjsState);
		peer.applyAwarenessState(author.encode().awarenessState);
		peer.applyYjsState('');
		peer.applyAwarenessState('');
		expect(peer.getSource()).toContain('print("B")');
		author.destroy();
		peer.destroy();
	});
});
