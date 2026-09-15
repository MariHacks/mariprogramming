<script>
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import FreeTimePaintGrid from '$lib/maritools/components/FreeTimePaintGrid.svelte';
	import {
		commonFreeCells,
		filterPaintableCells,
		freeCellsFromAvailability,
		freeCellsFromCourses,
		paintDayColumnsForTermWeek,
		restoreEditorState
	} from '$lib/maritools/schedule/freeTimeBoard.js';
	import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
	import { addDays, mondayOfWeek, weekTitle } from '$lib/maritools/schedule/academicWeekView.js';
	import { calendarDate } from '$lib/maritools/term/calendar.js';
	import '$lib/maritools/styles/preview.css';

	/** @type {{ board: { id: string, title: string, termId?: string, members: Array<{ id: string, displayName: string, availability?: unknown, shareToken?: string | null, userId?: string | null, accountKind?: 'guest' | 'signed_in' | 'executive' }> }, shareUrl: string, signedInDisplayName?: string | null, savedSchedulePaste?: string } | { board: null, notFound?: boolean, unavailable?: boolean, signedInDisplayName?: string | null, savedSchedulePaste?: string }} */
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
	let omnivoxPaste = String(data?.savedSchedulePaste ?? '');
	let importError = '';
	let weekStartIso = mondayOfWeek(calendarDate());
	let restoredOnce = false;
	/** @type {Set<string>} */
	let includedMemberIds = new Set(data.board?.members?.map((member) => member.id) ?? []);
	/** @type {Record<string, Set<string>>} */
	let draftByWeek = {};

	$: board = data.board;
	$: signedIn = Boolean(data.signedInDisplayName);
	$: hasSavedSchedule = Boolean(String(data?.savedSchedulePaste ?? '').trim());
	$: myAvailability = (() => {
		if (!board || !('members' in board)) return null;
		const members = board.members ?? [];
		if (shareToken) {
			const mine = members.find((member) => member.shareToken === shareToken);
			if (mine) return mine.availability ?? null;
		}
		return null;
	})();
	$: includedMembers = board
		? (board.members ?? []).filter((member) => includedMemberIds.has(member.id))
		: [];
	$: commonCells =
		board && !('notFound' in data && data.notFound)
			? filterPaintableCells(commonFreeCells(includedMembers, weekStartIso), dayColumns)
			: new Set();
	$: heading = weekTitle(weekStartIso);
	$: dayColumns = paintDayColumnsForTermWeek(
		weekStartIso,
		board && 'termId' in board ? board.termId : null
	);
	$: dayHeaders = dayColumns.map((column) => column.header);

	/**
	 * @param {string} week
	 * @param {unknown} [availability]
	 */
	function cellsForWeek(week, availability = myAvailability) {
		const columns = paintDayColumnsForTermWeek(
			week,
			board && 'termId' in board ? board.termId : null
		);
		if (Object.prototype.hasOwnProperty.call(draftByWeek, week)) {
			return filterPaintableCells(new Set(draftByWeek[week]), columns);
		}
		return filterPaintableCells(freeCellsFromAvailability(availability, week), columns);
	}

	function stashCurrentWeek() {
		draftByWeek = { ...draftByWeek, [weekStartIso]: new Set(freeCells) };
	}

	function goToToday() {
		stashCurrentWeek();
		weekStartIso = mondayOfWeek(calendarDate());
		freeCells = cellsForWeek(weekStartIso);
	}

	function goToPreviousWeek() {
		stashCurrentWeek();
		weekStartIso = addDays(weekStartIso, -7);
		freeCells = cellsForWeek(weekStartIso);
	}

	function goToNextWeek() {
		stashCurrentWeek();
		weekStartIso = addDays(weekStartIso, 7);
		freeCells = cellsForWeek(weekStartIso);
	}

	function applyRestoredState() {
		if (!browser || !board || restoredOnce) return;
		restoredOnce = true;
		const inclusionKey = `maritools.free-time.${board.id}.included-members`;
		const savedInclusion = sessionStorage.getItem(inclusionKey);
		if (savedInclusion === null) {
			includedMemberIds = new Set(board.members.map((member) => member.id));
		} else {
			try {
				const parsed = JSON.parse(savedInclusion);
				const available = new Set(board.members.map((member) => member.id));
				includedMemberIds = new Set(
					Array.isArray(parsed)
						? parsed.filter((id) => typeof id === 'string' && available.has(id))
						: []
				);
			} catch {
				includedMemberIds = new Set(board.members.map((member) => member.id));
			}
		}
		const stored = localStorage.getItem(`maritools.free-time.${board.id}.token`);
		const restored = restoreEditorState(
			board,
			stored,
			data.signedInDisplayName ?? null,
			weekStartIso
		);
		shareToken = restored.shareToken;
		displayName = restored.displayName;
		draftByWeek = {};
		freeCells = filterPaintableCells(
			restored.freeCells,
			paintDayColumnsForTermWeek(weekStartIso, board.termId)
		);
	}

	onMount(() => {
		applyRestoredState();
	});

	/** @param {string} memberId */
	function toggleMember(memberId) {
		const next = new Set(includedMemberIds);
		if (next.has(memberId)) next.delete(memberId);
		else next.add(memberId);
		includedMemberIds = next;
		if (browser && board) {
			sessionStorage.setItem(
				`maritools.free-time.${board.id}.included-members`,
				JSON.stringify([...next])
			);
		}
	}

	$: if (browser && board && form?.member?.shareToken) {
		localStorage.setItem(`maritools.free-time.${board.id}.token`, form.member.shareToken);
		shareToken = form.member.shareToken;
	}

	$: if (form?.saveError) saveMessage = form.saveError;
	$: if (form?.saveSuccess) saveMessage = 'Availability saved.';

	/** @param {string} [source] */
	function importOmnivox(source = omnivoxPaste) {
		const parsed = parseOmnivox(source);
		if (!parsed.ok) {
			importError = parsed.warnings[0] ?? 'We could not read that paste.';
			return;
		}
		freeCells = filterPaintableCells(freeCellsFromCourses(parsed.courses), dayColumns);
		draftByWeek = { ...draftByWeek, [weekStartIso]: new Set(freeCells) };
		importError = '';
		importOpen = false;
	}

	function handleImportOmnivox() {
		if (hasSavedSchedule) {
			omnivoxPaste = String(data.savedSchedulePaste ?? '');
			importOmnivox(omnivoxPaste);
			return;
		}
		importOpen = !importOpen;
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
			const { [weekStartIso]: _drop, ...rest } = draftByWeek;
			draftByWeek = rest;
			freeCells = filterPaintableCells(
				freeCellsFromAvailability(member.availability, weekStartIso),
				dayColumns
			);
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
						Availability is saved per week. Use the arrows to paint a different week.
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
				<FreeTimePaintGrid bind:freeCells {commonCells} {dayHeaders} {dayColumns} />

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
								{#if signedIn}
									No one has saved yet. Paint free slots, then Save so the group can see overlaps.
								{:else}
									No one has saved yet. Paint free slots, add a display name, then Save so the group
									can see overlaps.
								{/if}
							</p>
						{:else}
							<ul>
								{#each board.members as member (member.id)}
									<li>
										<button
											type="button"
											class="member-toggle"
											class:excluded={!includedMemberIds.has(member.id)}
											aria-label={`${includedMemberIds.has(member.id) ? 'Exclude' : 'Include'} ${member.displayName} from common free`}
											aria-pressed={includedMemberIds.has(member.id)}
											on:click={() => toggleMember(member.id)}
										>
											<span class="member-check" aria-hidden="true"
												>{includedMemberIds.has(member.id) ? '✓' : ''}</span
											>
											<span
												class="member-kind {member.accountKind ?? 'guest'}"
												aria-label={member.accountKind === 'executive'
													? 'Executive'
													: member.accountKind === 'signed_in'
														? 'Signed in'
														: 'Guest'}
												role="img"
											>
												{#if member.accountKind === 'executive'}
													<svg viewBox="0 0 24 24" aria-hidden="true"
														><path d="M4 18h16l-1.5-9-4 4L12 6l-2.5 7-4-4L4 18Z" /></svg
													>
												{:else if member.accountKind === 'signed_in'}
													<svg viewBox="0 0 24 24" aria-hidden="true"
														><path
															d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 16c0-3.3 3.1-6 7-6s7 2.7 7 6v1H5v-1Z"
														/></svg
													>
												{:else}
													<svg viewBox="0 0 24 24" aria-hidden="true"
														><path
															d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 16c0-3.3 3.1-6 7-6s7 2.7 7 6v1H5v-1Z"
														/><path class="guest-mark" d="M17 4h4M19 2v4" /></svg
													>
												{/if}
											</span>
											<span class="member-name">
												{member.displayName}
												<small
													>{member.accountKind === 'executive'
														? 'Executive'
														: member.accountKind === 'signed_in'
															? 'Signed in'
															: 'Guest'}</small
												>
											</span>
										</button>
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
							const paintable = filterPaintableCells(freeCells, dayColumns);
							freeCells = paintable;
							formData.set('freeJson', JSON.stringify([...paintable]));
							formData.set('shareToken', shareToken);
							formData.set('displayName', displayName);
							formData.set('weekStart', weekStartIso);
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
								await update({ reset: false });
								saveMessage = 'Availability saved.';
							};
						}}
					>
						{#if signedIn}
							<input type="hidden" name="displayName" value={displayName} />
						{:else}
							<label class="guest-field">
								<span>Display name</span>
								<input
									name="displayName"
									bind:value={displayName}
									placeholder="How others will see you"
									required
								/>
								<small>Shown when you are not signed in.</small>
							</label>
						{/if}
						<input type="hidden" name="shareToken" value={shareToken} />
						<input type="hidden" name="weekStart" value={weekStartIso} />
						<input
							type="hidden"
							name="freeJson"
							value={JSON.stringify([...filterPaintableCells(freeCells, dayColumns)])}
						/>
						<button type="submit" class="primary-button wide">Save availability</button>
					</form>

					<button class="panel-button" type="button" on:click={handleImportOmnivox}>
						Import Omnivox
					</button>
					{#if importOpen}
						<label class="guest-field">
							<span>Omnivox course list</span>
							<textarea
								bind:value={omnivoxPaste}
								rows="8"
								spellcheck="false"
								aria-label="Omnivox course list"
							></textarea>
						</label>
						<button class="panel-button" type="button" on:click={() => importOmnivox()}
							>Read schedule</button
						>
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

<style>
	.member-toggle {
		display: grid;
		width: 100%;
		grid-template-columns: 18px 22px minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		padding: 6px 4px;
		border: 0;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.member-toggle:hover,
	.member-toggle:focus-visible {
		background: #f1f5fb;
		outline: none;
	}

	.member-toggle.excluded {
		opacity: 0.46;
	}

	.member-check {
		display: grid;
		width: 16px;
		height: 16px;
		place-items: center;
		border: 1px solid #75849a;
		border-radius: 3px;
		background: white;
		color: #173f88;
		font-size: 11px;
		line-height: 1;
	}

	.member-kind {
		display: grid;
		width: 21px;
		height: 21px;
		place-items: center;
		border-radius: 50%;
		background: #eef2f7;
		color: #52647b;
	}

	.member-kind.signed_in {
		background: #e2edff;
		color: #2456a6;
	}

	.member-kind.executive {
		background: #fff0c7;
		color: #8a5b00;
	}

	.member-kind svg {
		width: 13px;
		height: 13px;
		fill: currentColor;
	}

	.member-kind .guest-mark {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	.member-name {
		display: grid;
		min-width: 0;
		font-size: 11px;
		font-weight: 600;
	}
</style>
