<script>
	import { get } from 'svelte/store';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { busyShareJson } from '$lib/maritools/schedule/busyShare.js';
	import {
		commonFreeFromOccurrences,
		commonFreeWeek,
		effectiveWeekdayForDate
	} from '$lib/maritools/schedule/freeTime.js';
	import { generateOccurrences } from '$lib/maritools/schedule/occurrences.js';
	import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
	import { rulesForTerm } from '$lib/maritools/term/calendar.js';
	import { termResolution } from '$lib/maritools/term/session.js';

	/** @type {string[]} */
	let schedules = ['', ''];
	let durationPreset = '45';
	let customMinutes = '40';
	let focusDate = '';
	/** @type {{ weekday: string, slots: { startTime: string, endTime: string }[] }[]} */
	let week = [];
	/** @type {{ startTime: string, endTime: string }[]} */
	let dateSlots = [];
	let followedWeekday = '';
	let error = '';
	let compared = false;

	function durationMinutes() {
		if (durationPreset === 'custom') {
			const value = Number(customMinutes);
			if (!Number.isFinite(value) || value < 15 || value > 240) return null;
			return Math.round(value);
		}
		return Number(durationPreset);
	}

	function parsedPeople() {
		/** @type {import('$lib/maritools/schedule/parseOmnivox.js').ParsedCourse[][]} */
		const people = [];
		for (const paste of schedules) {
			if (!String(paste).trim()) continue;
			const result = parseOmnivox(paste);
			if (!result.ok) return { ok: false, people: [] };
			people.push(result.courses);
		}
		return { ok: people.length >= 2, people };
	}

	function compare() {
		const parsed = parsedPeople();
		const minutes = durationMinutes();
		if (!parsed.ok) {
			error = 'Paste at least two compact Omnivox course lists.';
			week = [];
			dateSlots = [];
			compared = false;
			return;
		}
		if (minutes == null) {
			error = 'Use a gap between 15 and 240 minutes.';
			week = [];
			dateSlots = [];
			compared = false;
			return;
		}
		error = '';
		compared = true;
		week = commonFreeWeek(parsed.people, minutes);
		dateSlots = [];
		followedWeekday = '';
		if (!focusDate) return;
		const resolution = get(termResolution);
		if (!resolution.selected) {
			error = 'Choose a term in the tools bar before filtering by date.';
			return;
		}
		const rules = rulesForTerm(resolution.selected.id);
		if (!rules) {
			error = 'This term does not have calendar rules yet.';
			return;
		}
		followedWeekday = effectiveWeekdayForDate(focusDate, rules) ?? '';
		const occurrences = parsed.people.flatMap((courses) =>
			generateOccurrences(resolution.selected, rules, courses)
		);
		dateSlots = commonFreeFromOccurrences(occurrences, focusDate, minutes);
	}

	function addPerson() {
		schedules = [...schedules, ''];
	}

	function removePerson(index) {
		if (schedules.length <= 2) return;
		schedules = schedules.filter((_, rowIndex) => rowIndex !== index);
	}

	function downloadBusy() {
		const parsed = parsedPeople();
		if (!parsed.ok) {
			error = 'Paste at least two compact Omnivox course lists.';
			return;
		}
		const resolution = get(termResolution);
		const json = busyShareJson({
			people: parsed.people,
			termId: resolution.selected?.id ?? null,
			date: focusDate || null
		});
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'maritools-busy.json';
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Common free time | {MARITOOLS_NAME}</title>
	<meta name="description" content="Compare Omnivox lists and see shared free blocks." />
</svelte:head>

<section class="page page-container">
	<header>
		<h1>Common free time</h1>
		<p>
			Paste two or more compact Omnivox lists. We compare busy times only, not course names.
		</p>
	</header>

	<div class="controls">
		<fieldset>
			<legend>Minimum gap</legend>
			<label><input type="radio" bind:group={durationPreset} value="30" /> 30 minutes</label>
			<label><input type="radio" bind:group={durationPreset} value="45" /> 45 minutes</label>
			<label><input type="radio" bind:group={durationPreset} value="60" /> 60 minutes</label>
			<label><input type="radio" bind:group={durationPreset} value="90" /> 90 minutes</label>
			<label><input type="radio" bind:group={durationPreset} value="custom" /> Custom</label>
			{#if durationPreset === 'custom'}
				<label>
					Custom minutes
					<input type="number" min="15" max="240" bind:value={customMinutes} />
				</label>
			{/if}
		</fieldset>
		<label>
			Optional date
			<input type="date" bind:value={focusDate} />
		</label>
	</div>

	<div class="pastes">
		{#each schedules as _, index (index)}
			<label>
				Schedule {index + 1}
				<textarea bind:value={schedules[index]} rows="8" spellcheck="false"></textarea>
				{#if schedules.length > 2}
					<button type="button" class="ghost" on:click={() => removePerson(index)}>Remove</button>
				{/if}
			</label>
		{/each}
	</div>

	<div class="actions">
		<button type="button" class="ghost" on:click={addPerson}>Add another person</button>
		<button type="button" class="primary" on:click={compare}>Find shared free time</button>
		<button type="button" class="ghost" on:click={downloadBusy}>Download busy times (.json)</button>
	</div>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if compared && focusDate}
		<section class="date-slots" aria-labelledby="date-title">
			<h2 id="date-title">
				{focusDate}{followedWeekday ? ` follows ${followedWeekday}` : ''}
			</h2>
			{#if dateSlots.length === 0}
				<p>No shared gap on that date.</p>
			{:else}
				<ul class="slots">
					{#each dateSlots as slot (`${slot.startTime}-${slot.endTime}`)}
						<li>{slot.startTime}–{slot.endTime}</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#if week.length}
		<section class="timetable" aria-labelledby="grid-title">
			<h2 id="grid-title">Week</h2>
			<div class="grid">
				{#each week as column (column.weekday)}
					<div class="day">
						<h3>{column.weekday}</h3>
						{#if column.slots.length === 0}
							<p class="gap">No {durationMinutes()}-minute gap</p>
						{/if}
						{#each column.slots as slot (slot.startTime)}
							<p>
								<span class="when">{slot.startTime}–{slot.endTime}</span>
							</p>
						{/each}
					</div>
				{/each}
			</div>
		</section>
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

	header p {
		max-width: 52ch;
	}

	.controls,
	fieldset {
		display: grid;
		gap: var(--space-sm);
	}

	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}

	.pastes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-md);
	}

	label {
		display: grid;
		gap: var(--space-3xs);
		font-weight: 600;
	}

	textarea,
	input,
	button {
		font: inherit;
	}

	textarea,
	input[type='date'],
	input[type='number'] {
		width: 100%;
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
		background: var(--surface-raised);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.primary,
	.ghost {
		height: var(--control-height);
		padding-inline: var(--space-md);
		border-radius: var(--radius-sm);
		font-weight: 650;
	}

	.primary {
		border: 0;
		background: var(--club-blue);
		color: #fff;
	}

	.ghost {
		border: var(--rule-strong);
		background: transparent;
	}

	.error {
		color: var(--danger);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: var(--space-xs);
	}

	.day {
		min-width: 0;
		padding: var(--space-xs);
		border: var(--rule);
	}

	.day h3 {
		font-size: var(--text-sm);
	}

	.when,
	.gap {
		display: block;
		font-size: var(--text-xs);
		color: var(--quiet-steel);
	}

	.slots {
		list-style: none;
		padding: 0;
		display: grid;
		gap: var(--space-3xs);
	}

	@media (max-width: 50rem) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
