<script>
	import { onMount } from 'svelte';
	import { createPythonCollabEditor } from '$lib/pbl/python-editor.js';
	import { teammateColor, teammateName } from '$lib/pbl/yjs-collab.js';

	/** @type {string} */
	export let source = '';
	/** @type {string} */
	export let yjsState = '';
	/** @type {string} */
	export let awarenessState = '';
	/** @type {boolean} */
	export let editable = true;
	/** @type {{ name: string, color: string, colorLight: string } | null} */
	export let user = null;
	/** @type {(payload: { source: string, yjsState: string, awarenessState: string }) => void} */
	export let onCollab = () => {};

	let host = /** @type {HTMLDivElement | null} */ (null);
	/** @type {ReturnType<typeof createPythonCollabEditor> | null} */
	let editor = null;

	onMount(() => {
		if (!host) return;
		const seed =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: String(Date.now());
		const palette = teammateColor(seed);
		const current = createPythonCollabEditor(host, {
			source,
			yjsState,
			awarenessState,
			editable,
			user: user ?? {
				name: teammateName(seed),
				color: palette.color,
				colorLight: palette.colorLight
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
</script>

<div class="python-host" bind:this={host}></div>

<style>
	.python-host {
		display: grid;
		min-width: 0;
		min-height: 12rem;
		height: 100%;
		overflow: hidden;
		background: #2d2a2e;
		color: #fcfcfa;
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
		background-color: #221f22;
		color: #727072;
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
		color: #fcfcfa;
		caret-color: #ffd866;
	}
</style>
