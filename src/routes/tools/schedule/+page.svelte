<script>
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import CalendarExportModal from '$lib/maritools/components/CalendarExportModal.svelte';
	import OmnivoxTutorialOverlay from '$lib/maritools/components/OmnivoxTutorialOverlay.svelte';
	import ScheduleCalendar from '$lib/maritools/components/ScheduleCalendar.svelte';
	import '$lib/maritools/styles/preview.css';
	import {
		addDays,
		mondayOfWeek,
		weekGridForTermWeek,
		weekTitle
	} from '$lib/maritools/schedule/academicWeekView.js';
	import { occurrencesToIcs } from '$lib/maritools/schedule/ics.js';
	import { generateOccurrences } from '$lib/maritools/schedule/occurrences.js';
	import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
	import { calendarDate, rulesForTerm } from '$lib/maritools/term/calendar.js';
	import { termResolution } from '$lib/maritools/term/session.js';

	const TUTORIAL_STORAGE_KEY = 'maritools.omnivox-tutorial.dismissed';

	/** @type {{ result?: import('$lib/maritools/schedule/parseOmnivox.js').ParseResult, pushError?: string, pushSuccess?: string } | null} */
	export let form = null;

	/** @type {{ signedIn?: boolean, googleCalendarConnected?: boolean, gcalStatus?: string | null }} */
	export let data;

	let paste = '';
	/** @type {import('$lib/maritools/schedule/parseOmnivox.js').ParseResult} */
	let result = { ok: false, courses: [], warnings: [] };
	let parsed = false;
	let exportError = '';
	let drawerOpen = false;
	let exportOpen = false;
	let tutorialOpen = false;
	let weekStartIso = mondayOfWeek(calendarDate());
	let pushing = false;

	$: if (form?.result) {
		result = form.result;
		parsed = true;
		drawerOpen = false;
	}

	$: if (form?.pushError) {
		exportError = form.pushError;
		exportOpen = true;
	}

	$: if (form?.pushSuccess) {
		exportError = '';
		exportOpen = false;
	}

	$: resolution = get(termResolution);
	$: rules = resolution.selected ? rulesForTerm(resolution.selected.id) : null;
	$: grid =
		result.ok && resolution.selected && rules
			? weekGridForTermWeek(weekStartIso, resolution.selected, rules, result.courses)
			: [];
	$: heading = weekTitle(weekStartIso);
	$: conflictDays = grid.filter((column) => column.overlap).length;

	function runParse() {
		result = parseOmnivox(paste);
		parsed = true;
		exportError = '';
		drawerOpen = !result.ok;
	}

	function goToToday() {
		weekStartIso = mondayOfWeek(calendarDate());
	}

	function goToPreviousWeek() {
		weekStartIso = addDays(weekStartIso, -7);
	}

	function goToNextWeek() {
		weekStartIso = addDays(weekStartIso, 7);
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
		content="Paste an Omnivox compact list and download a semester calendar."
	/>
</svelte:head>

<div class="mt-preview">
	<section class="page page-schedule">
		<div class="utility-bar">
			<div>
				<h1>{heading}</h1>
			</div>
			<div class="utility-actions">
				<button class="quiet-button" type="button" on:click={goToToday}>Today</button>
				<div class="arrow-pair">
					<button type="button" aria-label="Previous week" on:click={goToPreviousWeek}>←</button
					><button type="button" aria-label="Next week" on:click={goToNextWeek}>→</button>
				</div>
				{#if result.ok}
					<button class="primary-button calendar-export-open" type="button" on:click={openExport}
						>Add to Google Calendar</button
					>
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

		<div class="schedule-stage" class:drawer-hidden={!drawerOpen}>
			{#if result.ok}
				<ScheduleCalendar {grid} />
			{:else}
				<div class="empty-calendar">
					<p>Paste an Omnivox compact list to see your week here.</p>
					<button class="primary-button" type="button" on:click={openImport}>Import Omnivox</button>
				</div>
			{/if}

			<aside class="import-drawer" aria-label="Import schedule">
				<div class="drawer-head">
					<div>
						<span>Omnivox import</span>
						<strong>Paste course list</strong>
					</div>
					<button
						class="drawer-close"
						type="button"
						aria-label="Close import drawer"
						on:click={() => (drawerOpen = false)}>×</button
					>
				</div>
				<p>Copy the compact numbered course list. Skip the schedule grid and personal details.</p>
				<textarea
					id="schedule-paste"
					name="paste"
					bind:value={paste}
					aria-label="Omnivox course list"
					placeholder="Paste the compact course list here."
					spellcheck="false"
				></textarea>
				{#if parsed}
					<div class="parse-status">
						<span>{result.courses.length} classes detected</span>
						{#if !result.ok}<span>Could not read paste</span>{/if}
						{#if conflictDays > 0}
							<span>{conflictDays} conflict{conflictDays === 1 ? '' : 's'}</span>
						{/if}
					</div>
				{/if}
				<button class="primary-button wide" type="button" on:click={runParse}>Read schedule</button>
				<button class="text-button tutorial-again" type="button" on:click={showTutorialAgain}
					>Show tutorial again</button
				>
			</aside>
		</div>

		{#if parsed && result.warnings.length}
			<ul class="field-error">
				{#each result.warnings as warning (warning)}
					<li>{warning}</li>
				{/each}
			</ul>
		{/if}

		{#if parsed && !result.ok}
			<p class="field-error" role="alert">{result.warnings[0] ?? 'We could not read that paste.'}</p>
		{/if}

		{#if result.ok}
			<section class="courses" aria-labelledby="courses-title" hidden>
				<h2 id="courses-title">Courses</h2>
				{#each result.courses as course (course.courseCode + course.section)}
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
	signedIn={data?.signedIn ?? false}
	googleCalendarConnected={data?.googleCalendarConnected ?? false}
	connectHref="/tools/schedule/google-calendar/connect"
	pushTermId={resolution.selected?.id ?? ''}
	onClose={() => (exportOpen = false)}
	onDownloadGoogle={downloadForGoogle}
	onDownloadApple={downloadForApple}
>
	<form
		slot="push-form"
		method="POST"
		action="?/pushGoogleCalendar"
		use:enhance={() => {
			pushing = true;
			return async ({ result: actionResult }) => {
				pushing = false;
				if (actionResult.type === 'failure') {
					exportError = String(actionResult.data?.pushError ?? 'Could not push to Google Calendar.');
					exportOpen = true;
				}
				if (actionResult.type === 'success') {
					exportError = '';
					exportOpen = false;
				}
			};
		}}
	>
		<input type="hidden" name="paste" value={paste} />
		<input type="hidden" name="termId" value={resolution.selected?.id ?? ''} />
		<button type="submit" class="primary-button" disabled={pushing || !resolution.selected}>
			{pushing ? 'Pushing…' : 'Push to Google Calendar'}
		</button>
	</form>
</CalendarExportModal>
</div>

