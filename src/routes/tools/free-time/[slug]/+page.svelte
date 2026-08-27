<script>
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import FreeTimePaintGrid from '$lib/maritools/components/FreeTimePaintGrid.svelte';
	import { commonFreeCells, freeCellsFromCourses, PAINT_WEEKDAYS } from '$lib/maritools/schedule/freeTimeBoard.js';
	import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
	import { addDays, mondayOfWeek, weekTitle } from '$lib/maritools/schedule/academicWeekView.js';
	import { calendarDate } from '$lib/maritools/term/calendar.js';
	import '$lib/maritools/styles/preview.css';

	/** @type {{ board: { id: string, title: string, members: Array<{ id: string, displayName: string, availability?: unknown }> }, shareUrl: string } | { board: null, notFound?: boolean, unavailable?: boolean }} */
	export let data;

	/** @type {{ member?: { shareToken?: string | null }, saveError?: string, saveSuccess?: boolean } | null} */
	export let form = null;

	let displayName = '';
	/** @type {Set<string>} */
	let freeCells = new Set();
	let shareToken = '';
	let saveMessage = '';
	let copyLabel = 'Copy';
	let importOpen = false;
	let omnivoxPaste = '';
	let importError = '';
	let weekStartIso = mondayOfWeek(calendarDate());

	const MEMBER_DOTS = ['maya', 'alex', 'samira'];

	$: board = data.board;
	$: commonCells =
		board && !('notFound' in data && data.notFound)
			? commonFreeCells(board.members ?? [])
			: new Set();
	$: heading = weekTitle(weekStartIso);
	$: dayHeaders = PAINT_WEEKDAYS.map(
		(weekday, index) => `${weekday} ${Number(addDays(weekStartIso, index).slice(8))}`
	);

	function goToToday() {
		weekStartIso = mondayOfWeek(calendarDate());
	}

	function goToPreviousWeek() {
		weekStartIso = addDays(weekStartIso, -7);
	}

	function goToNextWeek() {
		weekStartIso = addDays(weekStartIso, 7);
	}

	$: if (browser && board && form?.member?.shareToken) {
		localStorage.setItem(`maritools.free-time.${board.id}.token`, form.member.shareToken);
		shareToken = form.member.shareToken;
	}

	$: if (browser && board && !shareToken) {
		shareToken = localStorage.getItem(`maritools.free-time.${board.id}.token`) ?? '';
	}

	$: if (form?.saveError) saveMessage = form.saveError;
	$: if (form?.saveSuccess) saveMessage = 'Availability saved.';

	function importOmnivox() {
		const parsed = parseOmnivox(omnivoxPaste);
		if (!parsed.ok) {
			importError = parsed.warnings[0] ?? 'We could not read that paste.';
			return;
		}
		freeCells = freeCellsFromCourses(parsed.courses);
		importError = '';
		importOpen = false;
	}
</script>

<svelte:head>
	<title>{board?.title ?? 'Free time board'} | {MARITOOLS_NAME}</title>
</svelte:head>

<div class="mt-preview">
	{#if data.notFound}
		<section class="page page-free">
			<p>That board is not available.</p>
			<p><a href="/tools/free-time">Back to free time</a></p>
		</section>
	{:else if data.unavailable}
		<section class="page page-free">
			<p class="field-error" role="alert">This board is unavailable right now.</p>
		</section>
	{:else if board}
		<section class="page page-free">
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
					<a class="quiet-button" href="/tools/free-time">All boards</a>
					<button class="primary-button" type="submit" form="save-availability">Save availability</button>
				</div>
			</div>

			<div class="free-stage">
				<FreeTimePaintGrid bind:freeCells {commonCells} {dayHeaders} />

				<aside class="board-panel">
					<div class="board-heading">
						<span>Free-time board</span>
						<h2>{board.title}</h2>
					</div>

					<label class="share-field">
						<span>Share link</span>
						<span>
							<input readonly value={data.shareUrl} aria-label="Share link" />
							<button
								type="button"
								class="copy-link"
								on:click={async () => {
									if (!browser) return;
									await navigator.clipboard.writeText(data.shareUrl);
									copyLabel = 'Copied';
								}}
							>
								{copyLabel}
							</button>
						</span>
					</label>

					<div class="members">
						<div><strong>Members</strong><span>{board.members.length} added</span></div>
						<ul>
							{#each board.members as member, index (member.id)}
								<li>
									<i class="member-dot {MEMBER_DOTS[index % MEMBER_DOTS.length]}"></i>
									<span>
										{member.displayName}
										{#if displayName && member.displayName === displayName}
											<small>You, editing</small>
										{/if}
									</span>
								</li>
							{/each}
						</ul>
					</div>

					<form
						id="save-availability"
						method="POST"
						action="?/saveMember"
						use:enhance={() => {
							return async ({ result }) => {
								if (result.type === 'failure') {
									saveMessage = String(result.data?.saveError ?? 'Could not save.');
								}
							};
						}}
					>
						<label class="guest-field">
							<span>Display name</span>
							<input name="displayName" bind:value={displayName} placeholder="How others will see you" required />
							<small>Shown when you are not signed in.</small>
						</label>
						<input type="hidden" name="shareToken" value={shareToken} />
						<input type="hidden" name="freeJson" value={JSON.stringify([...freeCells])} />
						<button type="submit" class="primary-button wide">Save availability</button>
					</form>

					<button class="panel-button" type="button" on:click={() => (importOpen = !importOpen)}>
						Import Omnivox
					</button>
					{#if importOpen}
						<label class="guest-field">
							<span>Omnivox course list</span>
							<textarea bind:value={omnivoxPaste} rows="8" spellcheck="false" aria-label="Omnivox course list"></textarea>
						</label>
						<button class="panel-button" type="button" on:click={importOmnivox}>Read schedule</button>
						{#if importError}
							<p class="field-error" role="alert">{importError}</p>
						{/if}
					{/if}

					{#if saveMessage}
						<p role="status">{saveMessage}</p>
					{/if}
					{#if displayName}
						<p class="editing-as">You're editing as Guest, {displayName}.</p>
					{/if}
				</aside>
			</div>
		</section>
	{/if}
</div>
