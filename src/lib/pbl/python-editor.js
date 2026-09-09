import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap
} from '@codemirror/autocomplete';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import {
	HighlightStyle,
	bracketMatching,
	foldGutter,
	foldKeymap,
	indentUnit,
	syntaxHighlighting
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
	EditorView,
	drawSelection,
	dropCursor,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	rectangularSelection
} from '@codemirror/view';
import { tags as highlightTags } from '@lezer/highlight';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { pythonCompletions } from './python-completions.js';
import {
	PYTHON_YTEXT,
	applyRemoteAwareness,
	applyRemoteYjs,
	bytesToBase64,
	encodeLocalAwareness
} from './yjs-collab.js';

const MONOKAI = Object.freeze({
	bg: '#2d2a2e',
	bgGutter: '#221f22',
	ink: '#fcfcfa',
	comment: '#727072',
	red: '#ff6188',
	orange: '#fc9867',
	yellow: '#ffd866',
	green: '#a9dc76',
	cyan: '#78dce8',
	purple: '#ab9df2',
	selection: '#47839a',
	line: '#3e3b3f',
	cursor: '#ffd866'
});

function monokaiProOpenTheme() {
	return [
		EditorView.theme(
			{
				'&': {
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
					backgroundColor: MONOKAI.bg,
					color: MONOKAI.ink,
					fontSize: '14px',
					fontFamily: "var(--font-mono), 'Roboto Mono', ui-monospace, monospace",
					letterSpacing: '0',
					lineHeight: '1.55'
				},
				'.cm-scroller': {
					display: 'flex',
					alignItems: 'flex-start',
					fontFamily: "var(--font-mono), 'Roboto Mono', ui-monospace, monospace",
					lineHeight: '1.55',
					overflow: 'auto'
				},
				'.cm-content': {
					caretColor: MONOKAI.cursor,
					fontSize: '14px',
					lineHeight: '1.55',
					letterSpacing: '0',
					padding: '8px 0'
				},
				'.cm-line': {
					fontSize: '14px',
					lineHeight: '1.55',
					letterSpacing: '0',
					padding: '0 8px'
				},
				'.cm-gutters': {
					backgroundColor: MONOKAI.bgGutter,
					color: MONOKAI.comment,
					border: 'none',
					fontFamily: "var(--font-mono), 'Roboto Mono', ui-monospace, monospace",
					fontSize: '12px',
					fontWeight: '400',
					letterSpacing: '0',
					lineHeight: '1.55',
					padding: '8px 0'
				},
				'.cm-gutterElement': {
					fontSize: '12px',
					fontWeight: '400',
					letterSpacing: '0',
					lineHeight: '1.55'
				},
				'.cm-cursor, .cm-dropCursor': {
					borderLeftColor: MONOKAI.cursor
				},
				'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
					{
						backgroundColor: MONOKAI.selection
					},
				'.cm-activeLine': {
					backgroundColor: MONOKAI.line
				},
				'.cm-activeLineGutter': {
					backgroundColor: MONOKAI.line,
					color: MONOKAI.ink
				},
				'.cm-foldPlaceholder': {
					backgroundColor: MONOKAI.bgGutter,
					border: 'none',
					color: MONOKAI.comment
				},
				'.cm-tooltip': {
					backgroundColor: MONOKAI.bgGutter,
					color: MONOKAI.ink,
					border: `1px solid ${MONOKAI.line}`
				},
				'.cm-tooltip-autocomplete > ul > li[aria-selected]': {
					backgroundColor: MONOKAI.line,
					color: MONOKAI.ink
				}
			},
			{ dark: true }
		),
		syntaxHighlighting(
			HighlightStyle.define([
				{ tag: highlightTags.comment, color: MONOKAI.comment, fontStyle: 'italic' },
				{ tag: highlightTags.lineComment, color: MONOKAI.comment, fontStyle: 'italic' },
				{ tag: highlightTags.string, color: MONOKAI.yellow },
				{ tag: highlightTags.number, color: MONOKAI.purple },
				{ tag: highlightTags.bool, color: MONOKAI.purple },
				{ tag: highlightTags.null, color: MONOKAI.purple },
				{ tag: highlightTags.keyword, color: MONOKAI.red },
				{ tag: highlightTags.definitionKeyword, color: MONOKAI.red },
				{ tag: highlightTags.operatorKeyword, color: MONOKAI.red },
				{ tag: highlightTags.controlKeyword, color: MONOKAI.red },
				{ tag: highlightTags.operator, color: MONOKAI.red },
				{ tag: highlightTags.self, color: MONOKAI.orange },
				{
					tag: highlightTags.function(highlightTags.definition(highlightTags.variableName)),
					color: MONOKAI.green
				},
				{ tag: highlightTags.standard(highlightTags.name), color: MONOKAI.green },
				{ tag: highlightTags.function(highlightTags.variableName), color: MONOKAI.green },
				{ tag: highlightTags.definition(highlightTags.variableName), color: MONOKAI.ink },
				{ tag: highlightTags.variableName, color: MONOKAI.ink },
				{ tag: highlightTags.propertyName, color: MONOKAI.cyan },
				{ tag: highlightTags.className, color: MONOKAI.cyan },
				{ tag: highlightTags.typeName, color: MONOKAI.cyan },
				{ tag: highlightTags.namespace, color: MONOKAI.cyan },
				{ tag: highlightTags.invalid, color: MONOKAI.red }
			])
		)
	];
}

/** @param {string} label @param {boolean} editable */
function contentAttributes(label, editable) {
	return EditorView.contentAttributes.of({
		'aria-label': label,
		'aria-readonly': editable ? 'false' : 'true',
		spellcheck: 'false'
	});
}

/**
 * @param {HTMLElement} parent
 * @param {{
 *   source?: string,
 *   yjsState?: string,
 *   awarenessState?: string,
 *   editable?: boolean,
 *   label?: string,
 *   user?: { name: string, color: string, colorLight: string },
 *   onChange?: (payload: { source: string, yjsState: string, awarenessState: string }) => void
 * }} [options]
 */
export function createPythonCollabEditor(parent, options = {}) {
	if (!parent) throw new Error('Python editor needs a host element.');
	const label = options.label ?? 'Python';
	const ydoc = new Y.Doc();
	const ytext = ydoc.getText(PYTHON_YTEXT);
	const awareness = new Awareness(ydoc);
	const user = options.user ?? { name: 'You', color: '#78dce8', colorLight: '#78dce833' };
	awareness.setLocalStateField('user', user);
	if (options.yjsState) applyRemoteYjs(ydoc, options.yjsState);
	else if (options.source) ytext.insert(0, options.source);
	if (options.awarenessState) applyRemoteAwareness(awareness, options.awarenessState);
	const editable = new Compartment();
	const aria = new Compartment();
	let canEdit = options.editable !== false;
	let applyingRemote = false;

	function encode() {
		return {
			source: ytext.toString(),
			yjsState: bytesToBase64(Y.encodeStateAsUpdate(ydoc)),
			awarenessState: encodeLocalAwareness(awareness)
		};
	}

	function emitChange() {
		options.onChange?.(encode());
	}

	const view = new EditorView({
		parent,
		state: EditorState.create({
			doc: ytext.toString(),
			extensions: [
				lineNumbers(),
				highlightActiveLineGutter(),
				highlightActiveLine(),
				drawSelection(),
				dropCursor(),
				rectangularSelection(),
				highlightSelectionMatches(),
				bracketMatching(),
				closeBrackets(),
				foldGutter(),
				python(),
				indentUnit.of('    '),
				autocompletion({ override: [pythonCompletions] }),
				keymap.of([
					indentWithTab,
					...yUndoManagerKeymap,
					...closeBracketsKeymap,
					...completionKeymap,
					...searchKeymap,
					...foldKeymap,
					...defaultKeymap
				]),
				monokaiProOpenTheme(),
				yCollab(ytext, awareness),
				editable.of(EditorView.editable.of(canEdit)),
				aria.of(contentAttributes(label, canEdit)),
				EditorView.updateListener.of((update) => {
					if (applyingRemote || !update.docChanged) return;
					emitChange();
				})
			]
		})
	});

	awareness.on('change', (_changes, origin) => {
		if (applyingRemote || origin === 'remote') return;
		emitChange();
	});

	/** @param {unknown} source */
	function setSource(source) {
		const next = typeof source === 'string' ? source : '';
		if (ytext.toString() === next) return;
		applyingRemote = true;
		ydoc.transact(() => {
			if (ytext.length > 0) ytext.delete(0, ytext.length);
			if (next) ytext.insert(0, next);
		});
		applyingRemote = false;
	}

	/** @param {boolean} nextEditable */
	function setEditable(nextEditable) {
		canEdit = Boolean(nextEditable);
		view.dispatch({
			effects: [
				editable.reconfigure(EditorView.editable.of(canEdit)),
				aria.reconfigure(contentAttributes(label, canEdit))
			]
		});
	}

	return {
		ydoc,
		ytext,
		awareness,
		view,
		getSource() {
			return ytext.toString();
		},
		encode,
		setSource,
		setEditable,
		/** @param {string} encoded */
		applyYjsState(encoded) {
			if (!encoded) return;
			applyingRemote = true;
			applyRemoteYjs(ydoc, encoded);
			applyingRemote = false;
		},
		/** @param {string} encoded */
		applyAwarenessState(encoded) {
			if (!encoded) return;
			applyRemoteAwareness(awareness, encoded);
		},
		destroy() {
			view.destroy();
			awareness.destroy();
			ydoc.destroy();
		}
	};
}
