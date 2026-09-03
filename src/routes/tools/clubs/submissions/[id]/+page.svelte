<script>
	import { resolve } from '$app/paths';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import ClubListingDetail from '$lib/maritools/components/ClubListingDetail.svelte';

	export let data;
	/** @type {import('./$types').ActionData} */
	export let form = null;
</script>

<svelte:head>
	<title>{data.submission?.name || 'New club'} | Clubs | {MARITOOLS_NAME}</title>
	<meta name="description" content="Pending club listing for review." />
</svelte:head>

<div class="mt-preview">
	<section class="page page-club-detail">
		{#if data.notFound}
			<p>That club submission is not available.</p>
			<p><a href={resolve('/tools/clubs', {})}>All clubs</a></p>
		{:else if data.unavailable}
			<p class="field-error" role="alert">This submission is unavailable right now. Try again.</p>
		{:else if data.submission}
			<header class="club-submission-bar" data-testid="club-submission-meta">
				<div>
					<strong>{data.canPublish ? 'Review' : 'Your listing'}</strong>
					<span>{data.submission.status === 'pending' ? 'Pending' : data.submission.status}</span>
				</div>
				{#if form?.saved}
					<p role="status">Changes saved.</p>
				{/if}
				{#if form?.error}
					<p class="field-error" role="alert">{form.error}</p>
				{/if}
			</header>

			{#if data.canEdit}
				<form method="POST" action="?/save" class="club-submission-edit">
					<ClubListingDetail
						mode="edit"
						club={form && 'values' in form ? form.values : data.submission}
					/>
					<div class="club-submission-actions">
						<div>
							<strong>Ready to continue?</strong><span
								>Save your details now. You can update them while the listing is pending.</span
							>
						</div>
						<button type="submit" class="primary-button">Save listing</button>
						{#if data.canPublish}
							<button type="submit" class="dark-button" formaction="?/publish">Publish</button>
							<button type="submit" class="quiet-button" formaction="?/reject">Reject</button>
						{/if}
					</div>
				</form>
			{:else}
				<ClubListingDetail mode="view" club={data.submission} />
				{#if data.canPublish}
					<form method="POST" class="club-submission-actions">
						<button type="submit" class="primary-button" formaction="?/publish">Publish</button>
						<button type="submit" class="quiet-button" formaction="?/reject">Reject</button>
					</form>
				{/if}
			{/if}
		{/if}
	</section>
</div>
