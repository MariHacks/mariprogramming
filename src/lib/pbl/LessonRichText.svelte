<script>
	import { onDestroy, tick } from 'svelte';
	import { tokenizeLessonText } from '$lib/pbl/python-glossary.js';

	/** @type {string} */
	export let text = '';

	/** When true, only the first marked occurrence of each glossary key is linked. Default false: every mark. */
	export let oncePerTerm = false;

	/** Extra class on the root wrapper (e.g. body / note). */
	export let className = '';

	$: segments = tokenizeLessonText(text, { oncePerTerm });

	/** @type {string | null} */
	let openId = null;
	/** @type {HTMLElement | null} */
	let rootEl = null;
	/** @type {HTMLElement | null} */
	let popoverEl = null;
	/** @type {HTMLElement | null} */
	let anchorEl = null;

	/** @param {string} id @param {HTMLElement} anchor */
	async function toggle(id, anchor) {
		if (openId === id) {
			closeAll();
			return;
		}
		openId = id;
		anchorEl = anchor;
		await tick();
		positionPopover();
	}

	function closeAll() {
		openId = null;
		anchorEl = null;
		popoverEl = null;
	}

	function positionPopover() {
		if (!popoverEl || !anchorEl || typeof window === 'undefined') return;

		const margin = 8;
		const gap = 6;
		const rect = anchorEl.getBoundingClientRect();
		const pop = popoverEl.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		let left = rect.left;
		let top = rect.bottom + gap;

		if (left + pop.width > vw - margin) {
			left = Math.max(margin, vw - margin - pop.width);
		}
		if (left < margin) left = margin;

		if (top + pop.height > vh - margin) {
			const above = rect.top - gap - pop.height;
			if (above >= margin) top = above;
			else top = Math.max(margin, vh - margin - pop.height);
		}

		popoverEl.style.left = `${Math.round(left)}px`;
		popoverEl.style.top = `${Math.round(top)}px`;
	}

	/** @param {KeyboardEvent} event */
	function onKeydown(event) {
		if (event.key === 'Escape' && openId !== null) {
			event.stopPropagation();
			closeAll();
		}
	}

	/** @param {MouseEvent} event */
	function onDocPointer(event) {
		if (openId === null) return;
		const target = event.target;
		if (target instanceof Node && rootEl?.contains(target)) return;
		closeAll();
	}

	/** @param {Event} _event */
	function onViewportChange(_event) {
		if (openId !== null) positionPopover();
	}

	if (typeof window !== 'undefined') {
		window.addEventListener('keydown', onKeydown);
		window.addEventListener('pointerdown', onDocPointer, true);
		window.addEventListener('resize', onViewportChange);
		window.addEventListener('scroll', onViewportChange, true);
	}

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('pointerdown', onDocPointer, true);
			window.removeEventListener('resize', onViewportChange);
			window.removeEventListener('scroll', onViewportChange, true);
		}
	});
</script>

<span class="lesson-rich {className}" class:empty={!text} bind:this={rootEl}>
	{#each segments as segment, index (index)}
		{#if segment.type === 'text'}
			{segment.value}
		{:else}
			{@const id = `py-term-${segment.key}-${index}`}
			{@const open = openId === id}
			<span class="term-wrap">
				<button
					type="button"
					class="python-term"
					aria-expanded={open}
					aria-controls={id}
					aria-label={`${segment.entry.name}: show beginner docs`}
					on:click|preventDefault={(event) => toggle(id, /** @type {HTMLElement} */ (event.currentTarget))}
				>
					{segment.value}
				</button>
				{#if open}
					<span
						class="popover"
						id={id}
						role="tooltip"
						bind:this={popoverEl}
					>
						<strong class="popover-name">{segment.entry.name}</strong>
						<p class="popover-block">
							<span class="popover-label">What it is</span>
							{segment.entry.summary}
						</p>
						<p class="popover-block">
							<span class="popover-label">Useful for</span>
							{segment.entry.usefulFor}
						</p>
						{#if segment.entry.params}
							<p class="popover-block">
								<span class="popover-label">Parameters</span>
								{segment.entry.params}
							</p>
						{/if}
						{#if segment.entry.returns}
							<p class="popover-block">
								<span class="popover-label">Returns</span>
								{segment.entry.returns}
							</p>
						{/if}
						<p class="popover-block">
							<span class="popover-label">Example</span>
						</p>
						<pre class="popover-example">{segment.entry.example}</pre>
					</span>
				{/if}
			</span>
		{/if}
	{/each}
</span>

<style>
	.lesson-rich {
		display: inline;
	}

	.term-wrap {
		position: relative;
		display: inline;
	}

	.python-term {
		display: inline;
		margin: 0;
		padding: 0.05em 0.22em;
		border: none;
		border-radius: 0.3em;
		border-bottom: 1.5px solid color-mix(in srgb, var(--mari-sky, #3b82c4) 70%, transparent);
		background: color-mix(in srgb, var(--mari-sky, #3b82c4) 14%, transparent);
		color: inherit;
		font: inherit;
		font-weight: 600;
		line-height: inherit;
		cursor: pointer;
		text-decoration: none;
		vertical-align: baseline;
		white-space: normal;
	}

	.python-term:hover,
	.python-term:focus-visible {
		background: color-mix(in srgb, var(--mari-sky, #3b82c4) 26%, transparent);
		outline: 2px solid color-mix(in srgb, var(--mari-sky, #3b82c4) 55%, transparent);
		outline-offset: 1px;
	}

	.popover {
		position: fixed;
		z-index: 80;
		box-sizing: border-box;
		min-width: 16rem;
		width: max-content;
		max-width: min(22rem, calc(100vw - 2rem));
		padding: 0.75rem 0.85rem;
		border: 1px solid color-mix(in srgb, var(--quiet-steel, #6b7280) 35%, transparent);
		border-radius: 0.55rem;
		background: var(--panel-bg, #12141a);
		color: var(--ink, #f4f4f5);
		box-shadow: 0 10px 28px rgb(0 0 0 / 28%);
		font-size: 0.8125rem;
		font-weight: 400;
		line-height: 1.45;
		text-align: left;
		white-space: normal;
		overflow-wrap: anywhere;
		word-break: normal;
		overflow: visible;
	}

	.popover-name {
		display: block;
		margin-bottom: 0.45rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.875rem;
		white-space: normal;
	}

	.popover-block {
		margin: 0 0 0.45rem;
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.popover-label {
		display: block;
		margin-bottom: 0.12rem;
		color: var(--quiet-steel, #9ca3af);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.popover-example {
		margin: 0;
		padding: 0.45rem 0.55rem;
		max-width: 100%;
		overflow-x: auto;
		border-radius: 0.35rem;
		background: color-mix(in srgb, #000 35%, transparent);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.75rem;
		line-height: 1.4;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	@media (prefers-reduced-motion: reduce) {
		.python-term,
		.popover {
			transition: none;
		}
	}
</style>
