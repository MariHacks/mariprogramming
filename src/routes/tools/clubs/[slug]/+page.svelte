<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import ClubListingDetail from '$lib/maritools/components/ClubListingDetail.svelte';

	export let data;
</script>

<svelte:head>
	<title>{data.club?.name ?? 'Club'} | Clubs | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content={data.club?.description ?? 'Campus club listing.'}
	/>
</svelte:head>

<div class="mt-preview">
	<section class="page page-club-detail">
		{#if data.notFound}
			<p>That club is not available.</p>
			<p><a href="/tools/clubs">All clubs</a></p>
		{:else if data.unavailable}
			<p class="field-error" role="alert">This club is unavailable right now. Try again.</p>
		{:else if data.club}
			<ClubListingDetail mode="view" club={data.club} />
		{/if}
	</section>
</div>
