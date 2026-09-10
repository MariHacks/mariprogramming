<script>
	import { onMount } from 'svelte';
	import {
		createPythonCollabEditor,
		monokaiPalette,
		normalizeEditorTheme
	} from '$lib/pbl/python-editor.js';
	import { collabUserFromProfile } from '$lib/pbl/yjs-collab.js';

	/** @type {string} */
	export let source = '';
	/** @type {string} */
	export let yjsState = '';
	/** @type {string} */
	export let awarenessState = '';
	/** @type {boolean} */
	export let editable = true;
	/** @type {'dark' | 'light'} */
	export let theme = 'light';
	/** @type {{ name: string, color: string, colorLight: string } | null} */
	export let user = null;
	/** @type {(payload: { source: string, yjsState: string, awarenessState: string }) => void} */
	export let onCollab = () => {};
	/**
	 * When this changes, treat yjsState/source as a full document replace
	 * (step switch / snapshot), not a peer CRDT merge.
	 * @type {string | number}
	 */
	export let editorEpoch = 0;

	let host = /** @type {HTMLDivElement | null} */ (null);
	/** @type {ReturnType<typeof createPythonCollabEditor> | null} */
	let editor = null;
	/** @type {string | number | null} */
	let appliedEpoch = null;
	let appliedYjs = '';
	let appliedAwareness = '';

	$: themeMode = normalizeEditorTheme(theme);
	$: palette = monokaiPalette(themeMode);

	onMount(() => {
		if (!host) return;
		let alive = true;
		const current = createPythonCollabEditor(host, {
			source,
			yjsState,
			awarenessState,
			editable,
			theme: themeMode,
			user: user ?? collabUserFromProfile(null),
			onChange(payload) {
				if (!alive) return;
				onCollab(payload);
			}
		});
		editor = current;
		appliedEpoch = editorEpoch;
		appliedYjs = yjsState;
		appliedAwareness = awarenessState;
		return () => {
			alive = false;
			current.destroy();
			if (editor === current) editor = null;
		};
	});

	$: if (editor) {
		if (appliedEpoch !== editorEpoch) {
			editor.replaceYjsState(yjsState, source);
			appliedEpoch = editorEpoch;
			appliedYjs = yjsState;
		} else if (yjsState !== appliedYjs) {
			editor.applyYjsState(yjsState);
			appliedYjs = yjsState;
		}
	}
	$: if (editor && awarenessState !== appliedAwareness) {
		editor.applyAwarenessState(awarenessState);
		appliedAwareness = awarenessState;
	}
	$: if (editor) editor.setEditable(editable);
	$: if (editor) editor.setTheme(themeMode);
</script>

<div
	class="python-host"
	data-editor-theme={themeMode}
	style="--pbl-editor-bg: {palette.bg}; --pbl-editor-gutter: {palette.bgGutter}; --pbl-editor-ink: {palette.ink}; --pbl-editor-comment: {palette.comment}; --pbl-editor-cursor: {palette.cursor}; --pbl-editor-selection: {palette.selection}; --pbl-editor-line: {palette.line}; --pbl-editor-active-line: {themeMode === 'light' ? '#29242a12' : '#ffffff14'}"
	bind:this={host}
></div>

<style>
	.python-host {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		height: 100%;
		overflow: hidden;
		/* Stable shell bg before CodeMirror paints — avoids theme flicker. */
		background: var(--pbl-editor-bg, #2d2a2e);
		color: var(--pbl-editor-ink, #fcfcfa);
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 400;
		letter-spacing: 0;
		line-height: 1.55;
	}

	.python-host :global(.cm-editor) {
		display: flex !important;
		flex: 1 1 auto;
		flex-direction: column;
		height: 100% !important;
		min-height: 0;
		outline: none;
		background: var(--pbl-editor-bg, #2d2a2e);
	}

	.python-host :global(.cm-editor.cm-focused) {
		outline: none;
	}

	.python-host :global(.cm-scroller) {
		display: flex !important;
		align-items: flex-start !important;
		flex: 1 1 auto !important;
		min-height: 0 !important;
		overflow: auto !important;
	}

	/* Layout + colors only — font/line metrics come from monokaiChrome theme. */
	.python-host :global(.cm-gutters) {
		display: flex !important;
		flex-direction: row;
		flex-shrink: 0;
		width: auto !important;
		height: 100%;
		padding: 0;
		background-color: var(--pbl-editor-gutter, #221f22);
		color: var(--pbl-editor-comment, #727072);
	}

	.python-host :global(.cm-gutter) {
		display: flex !important;
		flex-direction: column;
		flex-shrink: 0;
	}

	.python-host :global(.cm-content) {
		flex: 1 0 auto;
		color: var(--pbl-editor-ink, #fcfcfa);
		caret-color: var(--pbl-editor-cursor, #ffd866);
	}

	/* Primary selection: opaque color; activeLine stays translucent so it does not cover it. */
	.python-host :global(.cm-selectionBackground),
	.python-host :global(.cm-editor.cm-focused .cm-selectionLayer .cm-selectionBackground),
	.python-host :global(.cm-content ::selection) {
		background-color: var(--pbl-editor-selection, #47839a) !important;
	}

	.python-host :global(.cm-activeLine),
	.python-host :global(.cm-activeLineGutter) {
		background-color: var(--pbl-editor-active-line, #ffffff14);
	}

	/* Live Share carets: colored bar + solid midnight name pill (always readable on light). */
	.python-host :global(.cm-ySelectionCaret) {
		position: relative;
		border-left-width: 2px;
		border-left-style: solid;
		border-right: none;
		margin-left: -1px;
		margin-right: 0;
		box-sizing: border-box;
	}
	.python-host :global(.cm-ySelectionCaretDot) {
		display: none;
	}
	.python-host :global(.cm-ySelectionInfo) {
		position: absolute;
		top: -1.5em;
		left: -1px;
		z-index: 12;
		padding: 0.18em 0.55em 0.18em 0.45em;
		border-radius: 0.28rem;
		font-family: var(--font-sans), system-ui, sans-serif;
		font-size: 11px;
		font-style: normal;
		font-weight: 700;
		line-height: 1.25;
		letter-spacing: 0.01em;
		/* Never inherit a washed fill — solid night + colored edge from caret border-color. */
		color: #fff !important;
		-webkit-text-fill-color: #fff;
		background-color: #061431 !important;
		border: 1px solid;
		border-color: inherit !important;
		border-left-width: 3px;
		opacity: 1 !important;
		pointer-events: none;
		white-space: nowrap;
		box-shadow: 0 2px 6px rgb(6 20 49 / 35%);
		transition: none !important;
	}
	.python-host :global(.cm-ySelection) {
		opacity: 0.32;
	}
</style>
