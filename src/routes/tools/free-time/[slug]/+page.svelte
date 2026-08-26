<script>
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import FreeTimePaintGrid from '$lib/maritools/components/FreeTimePaintGrid.svelte';
	import { commonFreeCells } from '$lib/maritools/schedule/freeTimeBoard.js';

	/** @type {{ board: import('$lib/server/maritools/free-time-store.js').publicBoardView extends (v: any) => infer R ? R : never, shareUrl: string } | { board: null, notFound?: boolean, unavailable?: boolean }} */
	export let data;

	/** @type {{ member?: { shareToken?: string | null }, saveError?: string, saveSuccess?: boolean } | null} */
	export let form = null;

	let displayName = '';
	/** @type {Set<string>} */
	let freeCells = new Set();
	let shareToken = '';
	let saveMessage = '';
	let copyLabel = 'Copy';

	$: board = data.board;
	$: commonCells =
		board && !('notFound' in data && data.notFound)
			? commonFreeCells(board.members ?? [])
			: new Set();

	$: if (browser && board && form?.member?.shareToken) {
		localStorage.setItem(`maritools.free-time.${board.id}.token`, form.member.shareToken);
		shareToken = form.member.shareToken;
	}

	$: if (browser && board && !shareToken) {
		shareToken = localStorage.getItem(`maritools.free-time.${board.id}.token`) ?? '';
	}

	$: if (form?.saveError) saveMessage = form.saveError;
	$: if (form?.saveSuccess) saveMessage = 'Availability saved.';
</script>

<svelte:head>
	<title>{board?.title ?? 'Free time board'} | {MARITOOLS_NAME}</title>
</svelte:head>

{#if data.notFound}
	<section class="board-page">
		<p>That board is not available.</p>
		<p><a href="/tools/free-time">Back to free time</a></p>
	</section>
{:else if data.unavailable}
	<section class="board-page">
		<p class="error" role="alert">This board is unavailable right now.</p>
	</section>
{:else if board}
	<section class="board-page">
		<div class="utility-bar">
			<div>
				<h1>{board.title}</h1>
			</div>
			<div class="utility-actions">
				<a class="quiet-button" href="/tools/free-time">All boards</a>
			</div>
		</div>

		<div class="free-stage">
			<div>
				<FreeTimePaintGrid bind:freeCells {commonCells} />
				<p class="no-login-caption">
					No login required. Anyone with the link can add availability using a display name.
				</p>
			</div>

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
						{#each board.members as member (member.id)}
							<li>{member.displayName}</li>
						{/each}
					</ul>
				</div>

				<form
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
					</label>
					<input type="hidden" name="shareToken" value={shareToken} />
					<input type="hidden" name="freeJson" value={JSON.stringify([...freeCells])} />
					<button type="submit" class="primary-button wide">Save availability</button>
				</form>

				{#if saveMessage}
					<p class="status" role="status">{saveMessage}</p>
				{/if}
			</aside>
		</div>
	</section>
{/if}

<style>
	.board-page {
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
	}

	.quiet-button {
		display: inline-grid;
		place-items: center;
		min-height: var(--control-height);
		padding-inline: 0.95rem;
		border: var(--rule);
		border-radius: var(--radius-xs);
		background: #fff;
		color: inherit;
		font-weight: 650;
		text-decoration: none;
	}

	.free-stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 20rem);
		gap: 0;
		border: var(--rule);
		background: #fff;
	}

	.no-login-caption {
		margin: 0.75rem 0 0;
		color: var(--quiet-steel);
		font-size: var(--text-xs);
	}

	.board-panel {
		display: grid;
		align-content: start;
		gap: 0.85rem;
		padding: 1.25rem;
		border-left: var(--rule);
		background: var(--mist);
	}

	.board-heading span {
		color: var(--quiet-steel);
		font-size: 0.625rem;
		font-weight: 650;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.board-heading h2 {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
	}

	.share-field,
	.guest-field {
		display: grid;
		gap: 0.35rem;
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.share-field > span:last-child {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.35rem;
	}

	.share-field input,
	.guest-field input {
		width: 100%;
		min-height: var(--control-height);
		padding: 0 0.65rem;
		border: var(--rule-strong);
		border-radius: var(--radius-xs);
		background: #fff;
		font: inherit;
	}

	.copy-link,
	.primary-button {
		min-height: var(--control-height);
		padding-inline: 0.85rem;
		border: 0;
		border-radius: var(--radius-xs);
		background: var(--club-blue);
		color: #fff;
		font: inherit;
		font-weight: 650;
		cursor: pointer;
	}

	.copy-link {
		background: var(--midnight);
	}

	.members ul {
		margin: 0.35rem 0 0;
		padding-left: 1rem;
	}

	.primary-button.wide {
		width: 100%;
	}

	.error,
	.status {
		font-size: var(--text-sm);
	}

	.error {
		color: var(--danger);
	}

	@media (max-width: 56rem) {
		.free-stage {
			grid-template-columns: 1fr;
		}

		.board-panel {
			border-left: 0;
			border-top: var(--rule);
		}
	}
</style>
