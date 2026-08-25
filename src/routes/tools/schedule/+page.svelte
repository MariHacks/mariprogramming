<script>
	import { get } from 'svelte/store';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { occurrencesToIcs } from '$lib/maritools/schedule/ics.js';
	import { generateOccurrences } from '$lib/maritools/schedule/occurrences.js';
	import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
	import { weekGrid } from '$lib/maritools/schedule/timetable.js';
	import { OMNIVOX_TUTORIAL_STEPS } from '$lib/maritools/tutorial-steps.js';
	import { rulesForTerm } from '$lib/maritools/term/calendar.js';
	import { termResolution } from '$lib/maritools/term/session.js';

	/** @type {{ result?: import('$lib/maritools/schedule/parseOmnivox.js').ParseResult } | null} */
	export let form = null;

	let paste = '';
	/** @type {import('$lib/maritools/schedule/parseOmnivox.js').ParseResult} */
	let result = { ok: false, courses: [], warnings: [] };
	let parsed = false;
	let exportError = '';

	$: if (form?.result) {
		result = form.result;
		parsed = true;
	}

	$: grid = result.ok ? weekGrid(result.courses) : [];

	function runParse() {
		result = parseOmnivox(paste);
		parsed = true;
		exportError = '';
	}

	function downloadIcs() {
		const resolution = get(termResolution);
		if (!resolution.selected) {
			exportError = 'Choose a term before downloading a calendar.';
			return;
		}
		const rules = rulesForTerm(resolution.selected.id);
		if (!rules) {
			exportError = 'This term does not have calendar rules yet.';
			return;
		}
		const ics = occurrencesToIcs(
			generateOccurrences(resolution.selected, rules, result.courses)
		);
		const blob = new Blob([ics], { type: 'text/calendar' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'maritools-schedule.ics';
		link.click();
		URL.revokeObjectURL(url);
		exportError = '';
	}
</script>

<svelte:head>
	<title>My Schedule | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Paste your Omnivox compact list and download a semester calendar."
	/>
</svelte:head>

<section class="schedule-page page-container">
	<header class="intro">
		<h1>My schedule</h1>
		<p>
			Paste the numbered course list from Omnivox. You do not need to log in, and nothing is sent to
			the college.
		</p>
	</header>

	<details class="tutorial">
		<summary>How do I get my schedule?</summary>
		<ol>
			{#each OMNIVOX_TUTORIAL_STEPS as step (step.n)}
				<li>
					<strong>{step.title}</strong>
					<p>{step.body}</p>
				</li>
			{/each}
		</ol>
		<p class="return-note">Then come back here and paste the list.</p>
	</details>

	<form class="paste-form" method="POST" on:submit|preventDefault={runParse}>
		<label class="paste-label" for="schedule-paste">Omnivox course list</label>
		<textarea
			id="schedule-paste"
			name="paste"
			bind:value={paste}
			rows="16"
			spellcheck="false"
			placeholder={'1  Badminton and Conditioning\nPHE-103-A1 sec.00002, teacher: ...'}
		></textarea>
		<button type="submit" class="primary">Read schedule</button>
	</form>

	{#if parsed && result.warnings.length}
		<ul class="warnings">
			{#each result.warnings as warning (warning)}
				<li>{warning}</li>
			{/each}
		</ul>
	{/if}

	{#if parsed && !result.ok}
		<p class="error" role="alert">{result.warnings[0] ?? 'We could not read that paste.'}</p>
	{/if}

	{#if result.ok}
		<section class="courses" aria-labelledby="courses-title">
			<h2 id="courses-title">Courses</h2>
			{#each result.courses as course, index (course.courseCode + course.section)}
				<article class="course">
					<label>
						Title
						<input bind:value={course.title} />
					</label>
					<p class="meta">
						<span class="code">{course.courseCode}</span>
						sec.{course.section} · {course.teacher}
					</p>
					<ul>
						{#each course.meetings as meeting, meetingIndex (`${index}-${meetingIndex}`)}
							<li>
								{meeting.weekday}
								{meeting.startTime}–{meeting.endTime}
								<label>
									Room
									<input bind:value={meeting.classroom} />
								</label>
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</section>

		<section class="timetable" aria-labelledby="grid-title">
			<h2 id="grid-title">Week</h2>
			<div class="grid">
				{#each grid as column (column.weekday)}
					<div class="day" class:overlap={column.overlap}>
						<h3>{column.weekday}</h3>
						{#if column.meetings.length === 0}
							<p class="gap">Free</p>
						{/if}
						{#each column.meetings as meeting (meeting.courseCode + meeting.startTime)}
							<p>
								<span class="when">{meeting.startTime}–{meeting.endTime}</span>
								<span>{meeting.title}</span>
								<span class="room">{meeting.classroom}</span>
							</p>
						{/each}
					</div>
				{/each}
			</div>
		</section>

		<section class="export">
			<button type="button" class="primary" on:click={downloadIcs}>Download calendar (.ics)</button>
			{#if exportError}
				<p class="error" role="alert">{exportError}</p>
			{/if}
			<ul class="import-notes">
				<li>Apple Calendar: File, Import, then choose the downloaded file.</li>
				<li>Google Calendar: Settings, Import and export, Import.</li>
				<li>Outlook: File, Open and Export, Import/Export.</li>
			</ul>
		</section>
	{/if}
</section>

<style>
	.schedule-page {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-lg);
	}

	.intro h1 {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		line-height: 1.05;
	}

	.intro p,
	.return-note,
	.import-notes {
		max-width: 48ch;
	}

	.tutorial {
		border-block: var(--rule);
		padding-block: var(--space-sm);
	}

	.tutorial ol {
		display: grid;
		gap: var(--space-sm);
		padding-inline-start: 1.25rem;
		margin-top: var(--space-sm);
	}

	textarea,
	input,
	button {
		font: inherit;
	}

	textarea {
		width: 100%;
		min-height: 14rem;
		padding: var(--space-sm);
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--graphite);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}

	.paste-form {
		display: grid;
		gap: var(--space-sm);
	}

	.paste-label,
	.course label {
		display: grid;
		gap: var(--space-3xs);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.primary {
		justify-self: start;
		height: var(--control-height);
		padding-inline: var(--space-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--club-blue);
		color: #fff;
		font-weight: 650;
	}

	.primary:focus-visible {
		outline: var(--focus-ring-width) solid var(--club-blue);
		outline-offset: var(--focus-ring-offset);
	}

	.warnings,
	.error {
		color: var(--danger);
	}

	.course {
		display: grid;
		gap: var(--space-xs);
		padding-block: var(--space-md);
		border-block-start: var(--rule);
	}

	.meta {
		font-size: var(--text-sm);
		color: var(--quiet-steel);
	}

	.code {
		font-family: var(--font-mono);
	}

	.course input {
		height: var(--control-height);
		padding-inline: var(--space-xs);
		border: var(--rule);
		border-radius: var(--radius-sm);
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

	.day.overlap {
		border-color: var(--danger);
	}

	.day h3 {
		font-size: var(--text-sm);
	}

	.when,
	.room,
	.gap {
		display: block;
		font-size: var(--text-xs);
		color: var(--quiet-steel);
	}

	.day p {
		margin-top: var(--space-xs);
		overflow-wrap: anywhere;
	}

	@media (max-width: 50rem) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
