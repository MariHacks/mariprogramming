<script>
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import CalendarExportModal from '$lib/maritools/components/CalendarExportModal.svelte';
	import OmnivoxTutorialOverlay from '$lib/maritools/components/OmnivoxTutorialOverlay.svelte';
	import ScheduleCalendar from '$lib/maritools/components/ScheduleCalendar.svelte';
	import { occurrencesToIcs } from '$lib/maritools/schedule/ics.js';
	import { generateOccurrences } from '$lib/maritools/schedule/occurrences.js';
	import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
	import { weekGrid } from '$lib/maritools/schedule/timetable.js';
	import { rulesForTerm } from '$lib/maritools/term/calendar.js';
	import { termResolution } from '$lib/maritools/term/session.js';

	const TUTORIAL_STORAGE_KEY = 'maritools.omnivox-tutorial.dismissed';

	/** @type {{ result?: import('$lib/maritools/schedule/parseOmnivox.js').ParseResult } | null} */
	export let form = null;

	let paste = '';
	/** @type {import('$lib/maritools/schedule/parseOmnivox.js').ParseResult} */
	let result = { ok: false, courses: [], warnings: [] };
	let parsed = false;
	let exportError = '';
	let drawerOpen = false;
	let exportOpen = false;
	let tutorialOpen = false;

	$: if (form?.result) {
		result = form.result;
		parsed = true;
		drawerOpen = false;
	}

	$: grid = result.ok ? weekGrid(result.courses) : [];

	function runParse() {
		result = parseOmnivox(paste);
		parsed = true;
		exportError = '';
		drawerOpen = false;
	}

	function openImport() {
		if (browser && !localStorage.getItem(TUTORIAL_STORAGE_KEY)) {
			tutorialOpen = true;
			return;
		}
		drawerOpen = true;
	}

	function finishTutorial() {
		if (browser) localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
		tutorialOpen = false;
		drawerOpen = true;
	}

	function skipTutorial() {
		if (browser) localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
		tutorialOpen = false;
		drawerOpen = true;
	}

	function showTutorialAgain() {
		if (browser) localStorage.removeItem(TUTORIAL_STORAGE_KEY);
		tutorialOpen = true;
	}

	function downloadIcs() {
		const resolution = get(termResolution);
		if (!resolution.selected) {
			exportError = 'Choose a term before downloading a calendar.';
			return false;
		}
		const rules = rulesForTerm(resolution.selected.id);
		if (!rules) {
			exportError = 'This term does not have calendar rules yet.';
			return false;
		}
		const ics = occurrencesToIcs(generateOccurrences(resolution.selected, rules, result.courses));
		const blob = new Blob([ics], { type: 'text/calendar' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'maritools-schedule.ics';
		link.click();
		URL.revokeObjectURL(url);
		exportError = '';
		return true;
	}

	function openExport() {
		exportOpen = true;
		exportError = '';
	}

	function downloadForGoogle() {
		if (downloadIcs()) exportOpen = false;
	}

	function downloadForApple() {
		if (downloadIcs()) exportOpen = false;
	}
</script>

<svelte:head>
	<title>My Schedule | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Paste your Omnivox compact list and download a semester calendar."
	/>
</svelte:head>

<section class="schedule-page">
	<div class="utility-bar">
		<div>
			<h1>Week of January 20</h1>
		</div>
		<div class="utility-actions">
			<button class="quiet-button" type="button">Today</button>
			<div class="arrow-pair" aria-hidden="true">
				<button type="button" aria-label="Previous week">←</button>
				<button type="button" aria-label="Next week">→</button>
			</div>
			{#if result.ok}
				<button class="primary-button" type="button" on:click={openExport}>Add to Google Calendar</button>
			{/if}
			<button
				class="quiet-button import-toggle"
				type="button"
				aria-expanded={drawerOpen}
				on:click={openImport}
			>
				Import Omnivox
			</button>
		</div>
	</div>

	<div class="schedule-stage" class:drawer-open={drawerOpen}>
		{#if result.ok}
			<ScheduleCalendar {grid} />
		{:else}
			<div class="empty-calendar">
				<p>Paste your Omnivox compact list to see your week here.</p>
				<button class="primary-button" type="button" on:click={openImport}>Import Omnivox</button>
			</div>
		{/if}

		<aside class="import-drawer" aria-label="Import Omnivox schedule">
			<div class="drawer-head">
				<div>
					<span>Import</span>
					<h2>Omnivox course list</h2>
				</div>
				<button class="drawer-close" type="button" aria-label="Close import drawer" on:click={() => (drawerOpen = false)}>×</button>
			</div>
			<p class="drawer-note">
				Paste the numbered course list from Omnivox. Nothing is sent to the college, and MariTools never
				asks for your student number.
			</p>
			<form class="paste-form" method="POST" on:submit|preventDefault={runParse}>
				<label class="paste-label" for="schedule-paste">Omnivox course list</label>
				<textarea
					id="schedule-paste"
					name="paste"
					bind:value={paste}
					rows="14"
					spellcheck="false"
					placeholder={'1  Badminton and Conditioning\nPHE-103-A1 sec.00002, teacher: ...'}
				></textarea>
				<button type="submit" class="primary-button">Read schedule</button>
			</form>
			<button class="text-button" type="button" on:click={showTutorialAgain}>Show tutorial again</button>
		</aside>
	</div>

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
		<section class="courses" aria-labelledby="courses-title" hidden>
			<h2 id="courses-title">Courses</h2>
			{#each result.courses as course, index (course.courseCode + course.section)}
				<article class="course">
					<label>
						Title
						<input bind:value={course.title} />
					</label>
				</article>
			{/each}
		</section>
	{/if}
</section>

<OmnivoxTutorialOverlay open={tutorialOpen} onFinish={finishTutorial} onSkip={skipTutorial} />
<CalendarExportModal
	open={exportOpen}
	{exportError}
	onClose={() => (exportOpen = false)}
	onDownloadGoogle={downloadForGoogle}
	onDownloadApple={downloadForApple}
/>

<style>
	.schedule-page {
		display: grid;
		padding: 1.75rem clamp(1.25rem, 3vw, 3rem) 3rem;
		gap: 1rem;
	}

	.utility-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.utility-bar h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 3vw, 2.5rem);
		line-height: 1.05;
	}

	.utility-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.arrow-pair {
		display: inline-flex;
		border: var(--rule);
	}

	.arrow-pair button,
	.quiet-button,
	.primary-button,
	.text-button,
	.drawer-close {
		font: inherit;
		cursor: pointer;
	}

	.arrow-pair button,
	.quiet-button,
	.drawer-close {
		border: 0;
		background: #fff;
		color: inherit;
	}

	.quiet-button,
	.primary-button {
		min-height: var(--control-height);
		padding-inline: 0.95rem;
		border-radius: var(--radius-xs);
		font-weight: 650;
	}

	.quiet-button {
		border: var(--rule);
		background: #fff;
	}

	.primary-button {
		border: 0;
		background: var(--club-blue);
		color: #fff;
	}

	.schedule-stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
	}

	.schedule-stage.drawer-open {
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
	}

	.empty-calendar {
		display: grid;
		place-items: center;
		min-height: 24rem;
		padding: 2rem;
		border: 1px dashed rgb(var(--midnight-rgb) / 18%);
		background: #fff;
		gap: 1rem;
		text-align: center;
	}

	.import-drawer {
		display: grid;
		align-content: start;
		padding: 1rem;
		border: 1px solid rgb(var(--midnight-rgb) / 12%);
		background: #fff;
		gap: 0.75rem;
	}

	.drawer-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.drawer-head span {
		color: var(--quiet-steel);
		font-size: 0.625rem;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.drawer-head h2 {
		margin: 0.2rem 0 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
	}

	.drawer-note {
		margin: 0;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.paste-form {
		display: grid;
		gap: 0.65rem;
	}

	.paste-label {
		font-size: var(--text-sm);
		font-weight: 600;
	}

	textarea {
		width: 100%;
		min-height: 14rem;
		padding: 0.75rem;
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--graphite);
		font: inherit;
		font-size: var(--text-sm);
	}

	.text-button {
		justify-self: start;
		border: 0;
		background: transparent;
		color: var(--club-blue);
		font-weight: 650;
	}

	.warnings,
	.error {
		color: var(--danger);
	}

	@media (max-width: 56rem) {
		.schedule-stage.drawer-open {
			grid-template-columns: 1fr;
		}
	}
</style>
