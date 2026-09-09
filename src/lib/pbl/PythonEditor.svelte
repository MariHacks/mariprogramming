<script>
	import { onMount } from 'svelte';
	import { createPythonCollabEditor } from '$lib/pbl/python-editor.js';

	/** @type {string} */
	export let source = '';
	/** @type {boolean} */
	export let editable = true;
	/** @type {(value: string) => void} */
	export let onSource = () => {};

	let host = /** @type {HTMLDivElement | null} */ (null);
	/** @type {ReturnType<typeof createPythonCollabEditor> | null} */
	let editor = null;

	onMount(() => {
		if (!host) return;
		const current = createPythonCollabEditor(host, {
			source,
			editable,
			onChange(value) {
				onSource(value);
			}
		});
		editor = current;
		return () => {
			current.destroy();
			if (editor === current) editor = null;
		};
	});

	$: if (editor) editor.setSource(source);
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
		font-family: var(--font-mono);
		font-size: 12px;
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
		font-size: 12px;
		font-weight: 400;
		letter-spacing: 0;
		line-height: 1.55;
	}

	.python-host :global(.cm-content) {
		flex: 1 0 auto;
	}
</style>
