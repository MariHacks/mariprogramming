<script>
	import { resolve } from '$app/paths';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import ClubListingDetail from '$lib/maritools/components/ClubListingDetail.svelte';

	const EMPTY_LISTING = {
		name: '',
		category: '',
		description: '',
		links: [],
		submitterRole: ''
	};
	/** @type {null | { error?: string, values?: { name: string, category: string, description: string, links: Array<{ type: string, label: string, url: string }>, submitterRole: string } }} */
	export let form = null;
</script>

<svelte:head>
	<title>Create a club listing | {MARITOOLS_NAME}</title>
	<meta name="description" content="Create a campus club listing." />
</svelte:head>

<div class="mt-preview">
	<section class="page page-club-detail">
		<header class="club-submission-bar">
			<div><strong>New listing</strong><span>Not submitted</span></div>
			{#if form?.error}<p class="field-error" role="alert">{form.error}</p>{/if}
		</header>
		<form method="POST" action="?/submit" class="club-submission-edit">
			<ClubListingDetail mode="edit" club={form?.values ?? EMPTY_LISTING} />
			<div class="club-submission-actions">
				<div>
					<strong>Ready to send it?</strong><span
						>We’ll review the listing before it appears in the directory.</span
					>
				</div>
				<a href={resolve('/tools/clubs', {})} class="quiet-button">Cancel</a>
				<button type="submit" class="primary-button">Submit listing</button>
			</div>
		</form>
	</section>
</div>
