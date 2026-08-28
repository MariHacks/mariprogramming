<script>
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import FreeTimePaintGrid from '$lib/maritools/components/FreeTimePaintGrid.svelte';
	import {
		commonFreeCells,
		freeCellsFromAvailability,
		freeCellsFromCourses,
		PAINT_WEEKDAYS,
		restoreEditorState
	} from '$lib/maritools/schedule/freeTimeBoard.js';
	import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
	import { addDays, mondayOfWeek, weekTitle } from '$lib/maritools/schedule/academicWeekView.js';
	import { calendarDate } from '$lib/maritools/term/calendar.js';
	import '$lib/maritools/styles/preview.css';

	/** @type {{ board: { id: string, title: string, members: Array<{ id: string, displayName: string, availability?: unknown, shareToken?: string | null }> }, shareUrl: string, signedInDisplayName?: string | null } | { board: null, notFound?: boolean, unavailable?: boolean, signedInDisplayName?: string | null }} */
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
	let restoredOnce = false;

	const MEMBER_DOTS = ['maya', 'alex', 'samira'];

	$: board = data.board;
	$: signedIn = Boolean(data.signedInDisplayName);
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

	function applyRestoredState() {
		if (!browser || !board || restoredOnce) return;
		restoredOnce = true;
		const stored = localStorage.getItem(`maritools.free-time.${board.id}.token`);
		const restored = restoreEditorState(board, stored, data.signedInDisplayName ?? null);
		shareToken = restored.shareToken;
		displayName = restored.displayName;
		freeCells = restored.freeCells;
	}

	onMount(() => {
		applyRestoredState();
	});

	$: if (browser && board && form?.member?.shareToken) {
		localStorage.setItem(`maritools.free-time.${board.id}.token`, form.member.shareToken);
		shareToken = form.member.shareToken;
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

	/**
	 * @param {{ displayName?: string, shareToken?: string | null, availability?: unknown } | undefined} member
	 */
	function applySavedMember(member) {
		if (!member) return;
		if (member.displayName) displayName = member.displayName;
		if (member.shareToken && board) {
			localStorage.setItem(`maritools.free-time.${board.id}.token`, member.shareToken);
			shareToken = member.shareToken;
		}
		if (member.availability) {
			freeCells = freeCellsFromAvailability(member.availability);
		}
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
					<p class="week-hint">
						Availability is a Mon–Fri pattern. Week arrows move calendar labels only.
					</p>
				</div>
				<div class="utility-actions">
					<button class="quiet-button" type="button" on:click={goToToday}>Today</button>
					<div class="arrow-pair">
						<button type="button" aria-label="Previous week" on:click={goToPreviousWeek}>←</button
						><button type="button" aria-label="Next week" on:click={goToNextWeek}>→</button>
					</div>
					<a class="quiet-button" href="/tools/free-time">All boards</a>
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
						<div>
							<strong>Members</strong>
							<span
								>{board.members.length === 0
									? 'Waiting for the first save'
									: `${board.members.length} saved`}</span
							>
						</div>
						{#if board.members.length === 0}
							<p class="members-empty">
								No one has saved yet. Paint free slots, add a display name, then Save so the
								group can see overlaps.
							</p>
						{:else}
							<ul>
								{#each board.members as member, index (member.id)}
									<li>
										<i class="member-dot {MEMBER_DOTS[index % MEMBER_DOTS.length]}"></i>
										<span>
											{member.displayName}
											{#if
												data.signedInDisplayName &&
												member.displayName === data.signedInDisplayName
											}
												<small>Account</small>
											{/if}
											{#if displayName && member.displayName === displayName}
												<small>You, editing</small>
											{/if}
										</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<form
						id="save-availability"
						method="POST"
						action="?/saveMember"
						use:enhance={({ formData }) => {
							formData.set('freeJson', JSON.stringify([...freeCells]));
							formData.set('shareToken', shareToken);
							formData.set('displayName', displayName);
							return async ({ result, update }) => {
								if (result.type === 'failure') {
									saveMessage = String(result.data?.saveError ?? 'Could not save.');
									return;
								}
								const member =
									result.type === 'success' && result.data && typeof result.data === 'object'
										? /** @type {{ member?: { displayName?: string, shareToken?: string | null, availability?: unknown } }} */ (
												result.data
											).member
										: undefined;
								applySavedMember(member);
								await update();
								restoredOnce = false;
								applyRestoredState();
								saveMessage = 'Availability saved.';
							};
						}}
					>
						<label class="guest-field">
							<span>Display name</span>
							<input name="displayName" bind:value={displayName} placeholder="How others will see you" required />
							<small
								>{signedIn
									? 'Linked to your signed-in MariTools account when you save.'
									: 'Shown when you are not signed in.'}</small
							>
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
						<p class="editing-as">
							{signedIn
								? `You're editing as ${displayName} (signed in).`
								: `You're editing as Guest, ${displayName}.`}
						</p>
					{/if}
				</aside>
			</div>
		</section>
	{/if}
</div>
