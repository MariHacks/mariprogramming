<script>
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

	function cancel() {
		onCancel?.();
	}

	/** @param {KeyboardEvent} event */
	function onKey(event) {
		if (event.key === 'Escape') {
			event.preventDefault();
			cancel();
		}
	}
</script>

<svelte:window on:keydown={onKey} />

<div
	class="mod-dialog-backdrop"
	role="presentation"
	on:click|self={cancel}
>
	<div
		class="mod-dialog"
		role="dialog"
		aria-modal="true"
		aria-labelledby={`${idPrefix}-dialog-title`}
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
		min-height: 2.4rem;
		padding: 0.4rem 0.75rem;
		border: 1px solid #c9d2dc;
		background: white;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 650;
		cursor: pointer;
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
