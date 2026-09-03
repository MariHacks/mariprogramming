<script>
	import { onDestroy, onMount, tick } from 'svelte';
	import ModerationDurationFields from '$lib/maritools/ModerationDurationFields.svelte';

	/** @type {'mute' | 'ban'} */
	export let kind = 'mute';

	/** @type {string} */
	export let title = kind === 'mute' ? 'Mute duration' : 'Ban duration';

	/** @type {string} */
	export let confirmLabel = kind === 'mute' ? 'Confirm mute' : 'Confirm ban';

	/** @type {string} */
	export let formaction = '';

	/** @type {string} */
	export let idPrefix = kind;

	/** @type {Record<string, string>} */
	export let hiddenFields = {};

	/** @type {(() => void) | undefined} */
	export let onCancel = undefined;

	/** @type {((node: HTMLFormElement) => { destroy?: () => void } | void) | undefined} */
	export let enhance = undefined;

	/** @type {HTMLElement | null} */
	let dialogElement = null;
	/** @type {HTMLElement | null} */
	let returnFocus = null;
	let previousBodyOverflow = '';
	let mounted = false;
	const focusableSelector =
		'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function cancel() {
		onCancel?.();
	}

	/** @param {KeyboardEvent} event */
	function onKey(event) {
		if (event.key === 'Escape') {
			event.preventDefault();
			cancel();
			return;
		}
		if (event.key !== 'Tab' || !dialogElement) return;
		const controls = [...dialogElement.querySelectorAll(focusableSelector)].filter(
			(node) => node instanceof HTMLElement
		);
		if (controls.length === 0) return;
		const first = controls[0];
		const last = controls[controls.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	onMount(async () => {
		mounted = true;
		returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		previousBodyOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		await tick();
		const firstControl = dialogElement?.querySelector(focusableSelector);
		if (firstControl instanceof HTMLElement) firstControl.focus({ preventScroll: true });
		else dialogElement?.focus({ preventScroll: true });
	});

	onDestroy(() => {
		if (!mounted) return;
		document.body.style.overflow = previousBodyOverflow;
		returnFocus?.focus({ preventScroll: true });
	});
</script>

<svelte:window on:keydown={onKey} />

<div class="mod-dialog-backdrop" role="presentation" on:click|self={cancel}>
	<div
		bind:this={dialogElement}
		class="mod-dialog"
		role="dialog"
		aria-modal="true"
		aria-labelledby={`${idPrefix}-dialog-title`}
		tabindex="-1"
	>
		<form method="post" action={formaction || undefined} use:enhance={enhance}>
			{#each Object.entries(hiddenFields) as [name, value] (name)}
				<input type="hidden" {name} {value} />
			{/each}
			{#if formaction}
				<input type="hidden" name="__formaction" value={formaction} />
			{/if}
			<header class="mod-dialog-head">
				<h2 id={`${idPrefix}-dialog-title`}>{title}</h2>
				<p>
					{kind === 'mute'
						? 'Choose how long posting stays blocked.'
						: 'Choose how long the ban lasts, or make it permanent.'}
				</p>
			</header>
			<div class="mod-dialog-body">
				<ModerationDurationFields {kind} {idPrefix} />
			</div>
			<footer class="mod-dialog-actions">
				<button type="button" class="cancel" on:click={cancel}>Cancel</button>
				<button type="submit" class="danger-confirm" formaction={formaction || undefined}
					>{confirmLabel}</button
				>
			</footer>
		</form>
	</div>
</div>

<style>
	.mod-dialog-backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		padding: 1rem;
		overflow-y: auto;
		background: rgb(15 23 42 / 45%);
	}

	.mod-dialog {
		width: min(22rem, 100%);
		border: 1px solid #c73b4a;
		background: white;
		box-shadow: 0 18px 40px rgb(15 23 42 / 18%);
	}

	.mod-dialog form {
		display: grid;
		gap: 0.85rem;
		padding: 1rem 1.05rem 1.05rem;
	}

	.mod-dialog-head h2 {
		margin: 0;
		font-size: 1.05rem;
		letter-spacing: -0.02em;
	}

	.mod-dialog-head p {
		margin: 0.35rem 0 0;
		color: var(--color-muted, #5b6b7c);
		font-size: 0.8125rem;
	}

	.mod-dialog-body {
		padding: 0.55rem 0.6rem;
		border: 1px solid #e8b0b7;
		background: #fff5f6;
	}

	.mod-dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.45rem;
	}

	.mod-dialog-actions button {
		min-height: 2.75rem;
		padding: 0.4rem 0.75rem;
		border: 1px solid #c9d2dc;
		background: white;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 650;
		cursor: pointer;
	}

	@media (max-width: 28rem) {
		.mod-dialog-backdrop {
			align-items: end;
			padding: 0;
		}

		.mod-dialog {
			width: 100%;
			max-height: 100dvh;
			overflow-y: auto;
			border-right: 0;
			border-bottom: 0;
			border-left: 0;
		}

		.mod-dialog form {
			padding: 1.25rem 1rem max(1rem, env(safe-area-inset-bottom));
		}

		.mod-dialog-actions button {
			flex: 1;
		}
	}

	.mod-dialog-actions .danger-confirm {
		border-color: #c73b4a;
		background: #c73b4a;
		color: white;
	}

	.mod-dialog-actions .danger-confirm:hover {
		background: #a82f3c;
		border-color: #a82f3c;
	}
</style>
