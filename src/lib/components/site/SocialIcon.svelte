<script>
	/** @type {string} */
	export let name;
</script>

{#if name === 'Instagram'}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">
		<rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
		<circle cx="12" cy="12" r="4" />
		<circle class="icon-dot" cx="17.5" cy="6.7" r="1" fill="currentColor" stroke="none" />
	</svg>
{:else if name === 'Discord'}
	<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
		<path
			d="M19.5 5.2a18 18 0 0 0-4.4-1.4l-.6 1.3a16 16 0 0 0-5 0l-.6-1.3a18 18 0 0 0-4.4 1.4C1.7 9.4.9 13.5 1.3 17.5a18 18 0 0 0 5.4 2.7l1.1-1.8c-.6-.2-1.2-.5-1.7-.8l.4-.3a13 13 0 0 0 11 0l.4.3c-.6.3-1.1.6-1.7.8l1.1 1.8a18 18 0 0 0 5.4-2.7c.5-4.7-.8-8.7-3.2-12.3ZM8.3 15.2c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm7.4 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"
		/>
	</svg>
{/if}

<style>
	svg {
		width: 1.25rem;
		height: 1.25rem;
		stroke-width: 1.8;
	}
</style>
