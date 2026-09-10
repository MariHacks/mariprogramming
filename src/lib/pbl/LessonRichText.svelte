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
						{#if segment.entry.exampleOutput}
							<p class="popover-block popover-output-label">
								<span class="popover-label">Output</span>
							</p>
							<pre class="popover-example popover-output">{segment.entry.exampleOutput}</pre>
						{/if}
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

	/* Light tactile key: pale sky fill, midnight bold mono, raised bottom edge. */
	.python-term {
		display: inline-block;
		margin: 0;
		padding: 0.06em 0.34em 0.08em;
		border: 1px solid rgb(var(--mari-sky-rgb, 59 130 196) / 42%);
		border-bottom-width: 2.5px;
		border-bottom-color: color-mix(in srgb, var(--mari-sky, #3b82c4) 72%, var(--midnight, #061431));
		border-radius: var(--radius-md, 0.375rem);
		background: color-mix(in srgb, var(--sky, #b9d1ff) 55%, var(--surface-raised, #fff));
		color: var(--midnight, #061431);
		font-family: var(--font-mono);
		font-size: 0.92em;
		font-weight: 700;
		line-height: 1.2;
		cursor: pointer;
		text-decoration: none;
		vertical-align: baseline;
		white-space: normal;
		box-shadow: 0 1px 0 rgb(var(--midnight-rgb, 6 20 49) / 6%);
	}

	.python-term:hover {
		background: color-mix(in srgb, var(--sky, #b9d1ff) 72%, var(--surface-raised, #fff));
		border-color: rgb(var(--mari-sky-rgb, 59 130 196) / 58%);
		border-bottom-color: color-mix(in srgb, var(--mari-sky, #3b82c4) 82%, var(--midnight, #061431));
	}

	.python-term:focus-visible {
		outline: 2px solid var(--mari-sky, var(--club-blue, #0b4cf4));
		outline-offset: 2px;
	}

	.python-term[aria-expanded='true'] {
		background: color-mix(in srgb, var(--sky, #b9d1ff) 78%, var(--surface-raised, #fff));
		border-bottom-width: 1.5px;
		transform: translateY(0.5px);
	}

	.popover {
		position: fixed;
		z-index: 80;
		box-sizing: border-box;
		min-width: 16rem;
		width: max-content;
		max-width: min(22rem, calc(100vw - 2rem));
		padding: 0.75rem 0.85rem;
		border: var(--rule, 1px solid rgb(var(--midnight-rgb, 6 20 49) / 18%));
		border-radius: var(--radius-lg, 0.5rem);
		background: var(--surface-raised, #ffffff);
		color: var(--graphite, var(--color-text, #17213a));
		box-shadow: var(--shadow-md, 0 12px 32px rgb(var(--midnight-rgb, 6 20 49) / 14%));
		font-family: var(--font-body, Inter, sans-serif);
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
		color: var(--midnight, #061431);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 700;
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
		color: var(--quiet-steel, #657087);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.popover-output-label {
		margin-top: 0.55rem;
	}

	.popover-example {
		margin: 0;
		padding: 0.45rem 0.55rem;
		max-width: 100%;
		overflow-x: auto;
		border: var(--rule, 1px solid rgb(var(--midnight-rgb, 6 20 49) / 18%));
		border-radius: var(--radius-sm, 0.25rem);
		background: var(--mist, #edf1f6);
		color: var(--midnight, #061431);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.4;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	@media (prefers-reduced-motion: reduce) {
		.python-term,
		.popover {
			transition: none;
			transform: none;
		}
	}
</style>
