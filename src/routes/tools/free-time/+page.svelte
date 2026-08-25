<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
	import { commonFreeWeek } from '$lib/maritools/schedule/freeTime.js';

	let mine = '';
	let theirs = '';
	/** @type {{ weekday: string, slots: { startTime: string, endTime: string }[] }[]} */
	let week = [];
	let error = '';

	function compare() {
		const left = parseOmnivox(mine);
		const right = parseOmnivox(theirs);
		if (!left.ok || !right.ok) {
			error = 'Both pastes need to be compact Omnivox course lists.';
			week = [];
			return;
		}
		error = '';
		week = commonFreeWeek([left.courses, right.courses], 45);
	}
</script>

<svelte:head>
	<title>Common free time | {MARITOOLS_NAME}</title>
	<meta name="description" content="Compare two Omnivox lists and see shared free blocks." />
</svelte:head>

<section class="page page-container">
	<header>
		<h1>Common free time</h1>
		<p>Paste two compact Omnivox lists. We compare busy times only, not course names.</p>
	</header>
	<div class="pastes">
		<label>
			First schedule
			<textarea bind:value={mine} rows="10" spellcheck="false"></textarea>
		</label>
		<label>
			Second schedule
			<textarea bind:value={theirs} rows="10" spellcheck="false"></textarea>
		</label>
	</div>
	<button type="button" on:click={compare}>Find shared free time</button>
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	{#if week.length}
		<ul>
			{#each week as day (day.weekday)}
				<li>
					<strong>{day.weekday}</strong>
					{#if day.slots.length === 0}
						<span>No 45-minute gap</span>
					{:else}
						{#each day.slots as slot (slot.startTime)}
							<span>{slot.startTime}–{slot.endTime}</span>
						{/each}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.page {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-md);
	}

	h1 {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		line-height: 1.05;
	}

	.pastes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-md);
	}

	label {
		display: grid;
		gap: var(--space-3xs);
		font-weight: 600;
	}

	textarea,
	button {
		font: inherit;
	}

	textarea {
		width: 100%;
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}

	button {
		justify-self: start;
		height: var(--control-height);
		padding-inline: var(--space-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--club-blue);
		color: #fff;
		font-weight: 650;
	}

	.error {
		color: var(--danger);
	}

	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: var(--space-sm);
	}

	li {
		display: grid;
		gap: var(--space-3xs);
		border-block-start: var(--rule);
		padding-block-start: var(--space-sm);
	}

	@media (max-width: 40rem) {
		.pastes {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
