<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { slugFromBoardTitle } from '$lib/maritools/schedule/freeTimeBoard.js';
	import { ACADEMIC_TERMS } from '$lib/maritools/term/calendar.js';
	import { termResolution, explicitTermId } from '$lib/maritools/term/session.js';
	import '$lib/maritools/styles/preview.css';
	import { get } from 'svelte/store';

	/** @type {{ boards?: Array<{ slug: string, title: string, members?: unknown[], createdAt?: string | Date }>, unavailable?: boolean }} */
	export let data = { boards: [] };

	/** @type {{ createError?: string } | null} */
	export let form = null;

	let boardTitle = '';
	$: selectedTerm = get(explicitTermId) ?? get(termResolution).selected?.id ?? ACADEMIC_TERMS[0]?.id ?? '';

	/** @param {string | Date | null | undefined} value */
	function formatWhen(value) {
		if (!value) return '';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	/** @param {{ members?: unknown[] }} board */
	function memberCount(board) {
		return Array.isArray(board.members) ? board.members.length : 0;
	}

	/** @param {{ members?: Array<{ availability?: { free?: unknown } }> }} board */
	function responseLabel(board) {
		const members = Array.isArray(board.members) ? board.members : [];
		const saved = members.filter((member) => Array.isArray(member.availability?.free) && member.availability.free.length > 0);
		if (members.length === 0) return 'Add availability';
		if (saved.length === members.length) return 'Saved';
		return 'Add availability';
	}
</script>

<svelte:head>
	<title>Common free time | {MARITOOLS_NAME}</title>
	<meta name="description" content="Create a board and share the link so people can mark when they are free." />
</svelte:head>

<div class="mt-preview">
	<section class="page page-free-boards">
		<header class="index-title">
			<div>
				<h1>Your boards</h1>
				<p>Create a board and share the link to find a time that works.</p>
			</div>
			<button type="submit" class="primary-button" form="create-board">Create board</button>
		</header>

		<form id="create-board" method="POST" action="?/createBoard" class="index-filters">
			<label>
				<span>Board title</span>
				<input name="title" bind:value={boardTitle} placeholder="Data Structures study group" required />
			</label>
			<label>
				<span>Term</span>
				<select name="termId" bind:value={selectedTerm} required>
					{#each ACADEMIC_TERMS as term (term.id)}
						<option value={term.id}>{term.name}</option>
					{/each}
				</select>
			</label>
			<input type="hidden" name="slug" value={slugFromBoardTitle(boardTitle)} />
		</form>

		{#if form?.createError}
			<p class="field-error" role="alert">{form.createError}</p>
		{/if}

		{#if data.unavailable}
			<p class="field-error" role="alert">Boards are unavailable right now. Try again.</p>
		{:else if data.boards?.length}
			<div class="boards-index">
				<div class="boards-head">
					<span>Board</span><span>Members</span><span>Your response</span><span>Updated</span><span></span>
				</div>
				{#each data.boards as board (board.slug)}
					<a href={`/tools/free-time/${board.slug}`}>
						<span>
							<strong>{board.title}</strong>
							<small>{formatWhen(board.createdAt) ? `Created ${formatWhen(board.createdAt)}` : 'Shared board'}</small>
						</span>
						<b>{memberCount(board)}</b>
						<span class={responseLabel(board) === 'Saved' ? 'status-ready' : 'status-needed'}>
							{responseLabel(board)}
						</span>
						<time>{formatWhen(board.createdAt)}</time>
						<i>Open →</i>
					</a>
				{/each}
			</div>
		{:else}
			<div class="boards-help">
				<strong>No boards yet</strong>
				<p>Create a board, then share the private link. You do not need an account.</p>
			</div>
		{/if}

		<div class="boards-help">
			<strong>No account needed</strong>
			<p>
				Guest boards stay accessible through their private link. Sign in only if you want them listed
				here across devices.
			</p>
		</div>
	</section>
</div>
