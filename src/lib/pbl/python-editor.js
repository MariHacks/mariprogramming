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

/** @typedef {'dark' | 'light'} EditorThemeMode */

export const EDITOR_THEME_KEY = 'pbl-studio-editor-theme';

/** Open Monokai Pro–style dark palette (no commercial assets). */
export const MONOKAI_DARK = Object.freeze({
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
	cursor: '#ffd866',
	panel: '#221f22',
	panelDeep: '#1e1b1e',
	muted: '#8b8789',
	rule: '#3e3b3f'
});

/** Open Monokai Pro Light–style palette (no commercial assets). */
export const MONOKAI_LIGHT = Object.freeze({
	bg: '#faf4f2',
	bgGutter: '#f0e9e7',
	ink: '#29242a',
	comment: '#a59fa0',
	red: '#e14775',
	orange: '#e16032',
	yellow: '#cc7a0a',
	green: '#269d69',
	cyan: '#1c8ca8',
	purple: '#7058be',
	selection: '#bfd4de',
	line: '#efe8e5',
	cursor: '#706b6e',
	panel: '#f0e9e7',
	panelDeep: '#ebe3e0',
	muted: '#706b6e',
	rule: '#e0d6d2'
});

/**
 * @param {unknown} value
 * @returns {EditorThemeMode}
 */
export function normalizeEditorTheme(value) {
	return value === 'light' ? 'light' : 'dark';
}

/**
 * Durable preference: localStorage when available, else dark.
 * @returns {EditorThemeMode}
 */
export function readStoredEditorTheme() {
	try {
		if (typeof localStorage === 'undefined') return 'dark';
		return normalizeEditorTheme(localStorage.getItem(EDITOR_THEME_KEY));
	} catch {
		return 'dark';
	}
}

/**
 * @param {EditorThemeMode} mode
 */
export function storeEditorTheme(mode) {
	try {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(EDITOR_THEME_KEY, normalizeEditorTheme(mode));
	} catch {
		/* localStorage may be unavailable */
	}
}

/** @param {EditorThemeMode} mode */
export function monokaiPalette(mode) {
	return normalizeEditorTheme(mode) === 'light' ? MONOKAI_LIGHT : MONOKAI_DARK;
}

/**
 * Shared editor chrome (14px gutter + content metrics stay aligned).
 * @param {typeof MONOKAI_DARK} palette
 * @param {boolean} dark
 */
function monokaiChrome(palette, dark) {
	return EditorView.theme(
		{
			'&': {
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				backgroundColor: palette.bg,
				color: palette.ink,
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
				caretColor: palette.cursor,
				fontSize: '14px',
				lineHeight: '1.55',
				letterSpacing: '0',
				padding: '8px 0',
				color: palette.ink
			},
			'.cm-line': {
				fontSize: '14px',
				lineHeight: '1.55',
				letterSpacing: '0',
				padding: '0 8px'
			},
			'.cm-gutters': {
				backgroundColor: palette.bgGutter,
				color: palette.comment,
				border: 'none',
				fontFamily: "var(--font-mono), 'Roboto Mono', ui-monospace, monospace",
				fontSize: '14px',
				fontWeight: '400',
				letterSpacing: '0',
				lineHeight: '1.55',
				padding: '8px 0'
			},
			'.cm-gutterElement': {
				fontSize: '14px',
				fontWeight: '400',
				letterSpacing: '0',
				lineHeight: '1.55'
			},
			'.cm-cursor, .cm-dropCursor': {
				borderLeftColor: palette.cursor
			},
			'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
				{
					backgroundColor: palette.selection
				},
			'.cm-activeLine': {
				backgroundColor: palette.line
			},
			'.cm-activeLineGutter': {
				backgroundColor: palette.line,
				color: palette.ink
			},
			'.cm-foldPlaceholder': {
				backgroundColor: palette.bgGutter,
				border: 'none',
				color: palette.comment
			},
			'.cm-tooltip': {
				backgroundColor: palette.bgGutter,
				color: palette.ink,
				border: `1px solid ${palette.rule}`
			},
			'.cm-tooltip-autocomplete > ul > li[aria-selected]': {
				backgroundColor: palette.line,
				color: palette.ink
			}
		},
		{ dark }
	);
}

/**
 * Real Python syntax colors: keywords, strings, numbers, comments, defs.
 * @param {typeof MONOKAI_DARK} palette
 */
function monokaiPythonHighlight(palette) {
	return syntaxHighlighting(
		HighlightStyle.define([
			{ tag: highlightTags.comment, color: palette.comment, fontStyle: 'italic' },
			{ tag: highlightTags.lineComment, color: palette.comment, fontStyle: 'italic' },
			{ tag: highlightTags.blockComment, color: palette.comment, fontStyle: 'italic' },
			{ tag: highlightTags.docComment, color: palette.comment, fontStyle: 'italic' },
			{ tag: highlightTags.string, color: palette.yellow },
			{ tag: highlightTags.special(highlightTags.string), color: palette.yellow },
			{ tag: highlightTags.character, color: palette.yellow },
			{ tag: highlightTags.number, color: palette.purple },
			{ tag: highlightTags.integer, color: palette.purple },
			{ tag: highlightTags.float, color: palette.purple },
			{ tag: highlightTags.bool, color: palette.purple },
			{ tag: highlightTags.null, color: palette.purple },
			{ tag: highlightTags.keyword, color: palette.red },
			{ tag: highlightTags.definitionKeyword, color: palette.red },
			{ tag: highlightTags.operatorKeyword, color: palette.red },
			{ tag: highlightTags.controlKeyword, color: palette.red },
			{ tag: highlightTags.moduleKeyword, color: palette.red },
			{ tag: highlightTags.modifier, color: palette.red },
			{ tag: highlightTags.operator, color: palette.red },
			{ tag: highlightTags.punctuation, color: palette.ink },
			{ tag: highlightTags.bracket, color: palette.ink },
			{ tag: highlightTags.meta, color: palette.orange },
			{ tag: highlightTags.annotation, color: palette.orange },
			{ tag: highlightTags.self, color: palette.orange },
			{
				tag: highlightTags.function(highlightTags.definition(highlightTags.variableName)),
				color: palette.green
			},
			{
				tag: highlightTags.definition(highlightTags.function(highlightTags.variableName)),
				color: palette.green
			},
			{ tag: highlightTags.standard(highlightTags.name), color: palette.green },
			{ tag: highlightTags.function(highlightTags.variableName), color: palette.green },
			{ tag: highlightTags.definition(highlightTags.variableName), color: palette.ink },
			{ tag: highlightTags.variableName, color: palette.ink },
			{ tag: highlightTags.propertyName, color: palette.cyan },
			{ tag: highlightTags.attributeName, color: palette.cyan },
			{ tag: highlightTags.className, color: palette.cyan },
			{
				tag: highlightTags.definition(highlightTags.className),
				color: palette.cyan
			},
			{ tag: highlightTags.typeName, color: palette.cyan },
			{ tag: highlightTags.namespace, color: palette.cyan },
			{ tag: highlightTags.labelName, color: palette.cyan },
			{ tag: highlightTags.invalid, color: palette.red }
		])
	);
}

/**
 * @param {EditorThemeMode} mode
 */
export function monokaiProOpenTheme(mode = 'dark') {
	const dark = normalizeEditorTheme(mode) !== 'light';
	const palette = monokaiPalette(mode);
	return [monokaiChrome(palette, dark), monokaiPythonHighlight(palette)];
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
 *   theme?: EditorThemeMode,
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
	const theme = new Compartment();
	let canEdit = options.editable !== false;
	let themeMode = normalizeEditorTheme(options.theme ?? 'dark');
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
				theme.of(monokaiProOpenTheme(themeMode)),
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

	/** @param {EditorThemeMode} nextTheme */
	function setTheme(nextTheme) {
		const mode = normalizeEditorTheme(nextTheme);
		if (mode === themeMode) return;
		themeMode = mode;
		view.dispatch({
			effects: theme.reconfigure(monokaiProOpenTheme(themeMode))
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
		getTheme() {
			return themeMode;
		},
		encode,
		setSource,
		setEditable,
		setTheme,
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
