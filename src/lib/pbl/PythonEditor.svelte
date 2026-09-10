<script>
	import { onMount } from 'svelte';
	import {
		createPythonCollabEditor,
		monokaiPalette,
		normalizeEditorTheme
	} from '$lib/pbl/python-editor.js';
	import { teammateColor, teammateName } from '$lib/pbl/yjs-collab.js';

	/** @type {string} */
	export let source = '';
	/** @type {string} */
	export let yjsState = '';
	/** @type {string} */
	export let awarenessState = '';
	/** @type {boolean} */
	export let editable = true;
	/** @type {'dark' | 'light'} */
	export let theme = 'dark';
	/** @type {{ name: string, color: string, colorLight: string } | null} */
	export let user = null;
	/** @type {(payload: { source: string, yjsState: string, awarenessState: string }) => void} */
	export let onCollab = () => {};

	let host = /** @type {HTMLDivElement | null} */ (null);
	/** @type {ReturnType<typeof createPythonCollabEditor> | null} */
	let editor = null;

	$: themeMode = normalizeEditorTheme(theme);
	$: palette = monokaiPalette(themeMode);

	onMount(() => {
		if (!host) return;
		const seed =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: String(Date.now());
		const colors = teammateColor(seed);
		const current = createPythonCollabEditor(host, {
			source,
			yjsState,
			awarenessState,
			editable,
			theme: themeMode,
			user: user ?? {
				name: teammateName(seed),
				color: colors.color,
				colorLight: colors.colorLight
			},
			onChange(payload) {
				onCollab(payload);
			}
		});
		editor = current;
		return () => {
			current.destroy();
			if (editor === current) editor = null;
		};
	});

	$: if (editor) editor.applyYjsState(yjsState);
	$: if (editor) editor.applyAwarenessState(awarenessState);
	$: if (editor) editor.setEditable(editable);
	$: if (editor) editor.setTheme(themeMode);
</script>

<div
	class="python-host"
	data-editor-theme={themeMode}
	style="--pbl-editor-bg: {palette.bg}; --pbl-editor-gutter: {palette.bgGutter}; --pbl-editor-ink: {palette.ink}; --pbl-editor-comment: {palette.comment}; --pbl-editor-cursor: {palette.cursor}"
	bind:this={host}
></div>

<style>
	.python-host {
		display: grid;
		min-width: 0;
		min-height: 12rem;
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
		flex-direction: column;
		height: 100%;
		outline: none;
		font-size: 14px;
		letter-spacing: 0;
		background: var(--pbl-editor-bg, #2d2a2e);
	}

	.python-host :global(.cm-editor.cm-focused) {
		outline: none;
	}

	.python-host :global(.cm-scroller) {
		display: flex !important;
		align-items: flex-start !important;
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
	}

	.python-host :global(.cm-gutters) {
		display: flex !important;
		flex-direction: row;
		flex-shrink: 0;
		width: auto !important;
		height: 100%;
		background-color: var(--pbl-editor-gutter, #221f22);
		color: var(--pbl-editor-comment, #727072);
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 400;
		letter-spacing: 0;
		line-height: 1.55;
	}

	.python-host :global(.cm-gutter) {
		display: flex !important;
		flex-direction: column;
		flex-shrink: 0;
	}

	.python-host :global(.cm-gutterElement) {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 400;
		letter-spacing: 0;
		line-height: 1.55;
	}

	.python-host :global(.cm-content) {
		flex: 1 0 auto;
		color: var(--pbl-editor-ink, #fcfcfa);
		caret-color: var(--pbl-editor-cursor, #ffd866);
	}
</style>
