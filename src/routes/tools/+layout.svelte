<script>
	import { ACADEMIC_TERMS } from '$lib/maritools/term/calendar.js';
	import { explicitTermId, termResolution } from '$lib/maritools/term/session.js';
	import { MARITOOLS_INITIATIVE } from '$lib/maritools/brand.js';

	/** @param {Event} event */
	function onTermChange(event) {
		if (!(event.currentTarget instanceof HTMLSelectElement)) return;
		const value = event.currentTarget.value;
		explicitTermId.set(value === '' ? null : value);
	}
</script>

<div class="tools-shell">
	<header class="tools-banner">
		<p class="initiative">{MARITOOLS_INITIATIVE}</p>
		<div class="term-control">
			<label for="tools-term">Term</label>
			<select
				id="tools-term"
				value={$explicitTermId ?? ''}
				on:change={onTermChange}
			>
				<option value="">Use current dates</option>
				{#each ACADEMIC_TERMS as term (term.id)}
					<option value={term.id}>{term.name}</option>
				{/each}
			</select>
			{#if $termResolution.reason === 'none'}
				<p class="term-status" role="status">Current-term data is unavailable.</p>
			{:else if $termResolution.selected}
				<p class="term-status" role="status">
					Showing {$termResolution.selected.name}.
				</p>
			{/if}
		</div>
	</header>
	<slot />
</div>

<style>
	.tools-shell {
		min-height: calc(100vh - 4.5rem - 4.9375rem);
		border-block-end: var(--rule);
		background: var(--paper);
	}

	.tools-banner {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(12rem, 18rem);
		gap: var(--space-md);
		align-items: end;
		max-width: var(--layout-width);
		margin-inline: auto;
		padding: var(--space-lg) var(--page-gutter) var(--space-sm);
		border-block-end: var(--rule);
	}

	.initiative {
		font-size: var(--text-sm);
		color: var(--quiet-steel);
	}

	.term-control {
		display: grid;
		gap: var(--space-3xs);
	}

	.term-control label {
		font-size: var(--text-xs);
		font-weight: 600;
	}

	select {
		height: var(--control-height);
		padding-inline: var(--space-xs);
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--graphite);
		font: inherit;
	}

	.term-status {
		font-size: var(--text-sm);
		color: var(--quiet-steel);
	}

	@media (max-width: 40rem) {
		.tools-banner {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
