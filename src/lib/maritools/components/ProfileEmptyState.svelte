<script>
	/** @type {'posts' | 'outlines'} */
	export let kind;
	export let title;
	export let description;
</script>

<div class={`profile-empty-state profile-empty-state--${kind}`}>
	<div class="profile-empty-state__graphic">
		{#if kind === 'posts'}
			<svg aria-hidden="true" viewBox="0 0 112 112" fill="none">
				<rect x="13" y="17" width="72" height="59" fill="var(--paper-blue)" />
				<path d="M25 31h48M25 44h34M25 57h25" stroke="var(--ink)" stroke-width="4" />
				<path d="M28 76v17l18-17" fill="var(--paper-blue)" stroke="var(--ink)" stroke-width="4" />
				<circle cx="86" cy="79" r="17" fill="var(--blue)" />
				<path d="M79 79h14M86 72v14" stroke="white" stroke-width="4" />
			</svg>
		{:else}
			<svg aria-hidden="true" viewBox="0 0 112 112" fill="none">
				<path d="M28 12h45l18 18v68H28z" fill="var(--paper-blue)" />
				<path d="M73 12v18h18M28 12h45l18 18v68H28z" stroke="var(--ink)" stroke-width="4" />
				<path d="M41 48h37M41 61h37M41 74h25" stroke="var(--blue)" stroke-width="4" />
				<rect x="16" y="27" width="12" height="55" fill="var(--blue)" />
			</svg>
		{/if}
	</div>
	<div class="profile-empty-state__copy">
		<h3>{title}</h3>
		<p>{description}</p>
	</div>
</div>

<style>
	.profile-empty-state {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		align-items: center;
		min-height: 14rem;
		padding: 1.5rem 0 2rem;
		border-bottom: 1px solid var(--line);
		gap: clamp(1.25rem, 3vw, 2.25rem);
	}

	.profile-empty-state__graphic {
		display: grid;
		width: 7rem;
		place-items: center;
	}

	.profile-empty-state__graphic svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.profile-empty-state__copy h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.2rem, 1.7vw, 1.5rem);
		letter-spacing: -0.025em;
		line-height: 1.05;
	}

	.profile-empty-state__copy p {
		max-width: 30rem;
		margin: 0.65rem 0 0;
		color: var(--steel);
		font-size: 0.82rem;
		line-height: 1.55;
	}

	@media (max-width: 44rem) {
		.profile-empty-state {
			grid-template-columns: 5.5rem minmax(0, 1fr);
			min-height: 11rem;
			padding-block: 1.25rem;
			gap: 1.1rem;
		}

		.profile-empty-state__graphic {
			width: 5.5rem;
		}
	}
</style>
