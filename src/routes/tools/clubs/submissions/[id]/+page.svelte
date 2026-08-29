<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { CLUB_SUBMITTER_ROLES } from '$lib/maritools/club-listing.js';
	import ClubListingDetail from '$lib/maritools/components/ClubListingDetail.svelte';

	export let data;
	export let form = null;

	/** @param {string | null | undefined} value */
	function roleLabel(value) {
		return CLUB_SUBMITTER_ROLES.find((role) => role.value === value)?.label ?? value ?? 'Unknown';
	}
</script>

<svelte:head>
	<title
		>{data.submission?.name ?? 'Club submission'} | Clubs | {MARITOOLS_NAME}</title
	>
	<meta name="description" content="Pending club listing for review." />
</svelte:head>

<div class="mt-preview">
	<section class="page page-club-detail">
		{#if data.notFound}
			<p>That club submission is not available.</p>
			<p><a href="/tools/clubs">All clubs</a></p>
		{:else if data.unavailable}
			<p class="field-error" role="alert">This submission is unavailable right now. Try again.</p>
		{:else if data.submission}
			<aside class="submit-club" data-testid="club-submission-meta">
				<div>
					<strong>{data.staff ? 'Staff review' : 'Your submission'}</strong>
					<h2>{data.submission.status === 'pending' ? 'Pending listing' : 'Listing'}</h2>
				</div>
				<p>
					Submitter role: <span data-testid="submitter-role">{roleLabel(data.submission.submitterRole)}</span>
				</p>
				{#if form?.saved}
					<p role="status">Saved.</p>
				{/if}
				{#if form?.error}
					<p class="field-error" role="alert">{form.error}</p>
				{/if}
			</aside>

			{#if data.canEdit}
				<form method="POST" action="?/save" class="club-submission-edit">
					<ClubListingDetail mode="edit" club={data.submission} />
					<div class="club-submission-actions">
						<button type="submit" class="primary-button">Save changes</button>
						{#if data.canPublish}
							<button type="submit" class="dark-button" formaction="?/publish">Publish</button>
						{/if}
					</div>
				</form>
			{:else}
				<ClubListingDetail mode="view" club={data.submission} />
				{#if data.canPublish}
					<form method="POST" action="?/publish" class="club-submission-actions">
						<button type="submit" class="primary-button">Publish</button>
					</form>
				{/if}
			{/if}
		{/if}
	</section>
</div>
