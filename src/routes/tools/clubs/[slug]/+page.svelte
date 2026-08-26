<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { initialsFromClubName } from '$lib/maritools/club-initials.js';
	import '$lib/maritools/styles/index-pages.css';

	export let data;

	/** @param {{ label?: string, url?: string }} link */
	function linkLabel(link) {
		const label = String(link.label ?? '').trim();
		if (label) return `${label} ↗`;
		return `${link.url ?? 'Open link'} ↗`;
	}
</script>

<svelte:head>
	<title>{data.club?.name ?? 'Club'} | Clubs | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content={data.club?.description ??
			'Published campus club listing on MariTools.'}
	/>
</svelte:head>

<section class="mt-index-page mt-club-detail-page">
	{#if data.notFound}
		<p class="mt-club-detail-empty">That club is not available.</p>
		<p class="mt-club-detail-empty">
			<a href="/tools/clubs">All clubs</a>
		</p>
	{:else if data.unavailable}
		<p class="mt-error" role="alert">This club is unavailable right now. Try again.</p>
	{:else if data.club}
		<header class="mt-club-detail-header">
			<a href="/tools/clubs">← All clubs</a>
			<div>
				<span class="mt-club-initials mt-club-detail-initials">
					{initialsFromClubName(data.club.name)}
				</span>
				<div>
					<h1>{data.club.name}</h1>
					<p>{data.club.category ?? 'General'}</p>
				</div>
			</div>
		</header>
		<div class="mt-club-detail-index">
			<section>
				<h2>About</h2>
				{#if data.club.description}
					<p>{data.club.description}</p>
				{:else}
					<p>No description published yet.</p>
				{/if}
			</section>
			<section>
				<h2>Contact and links</h2>
				{#if Array.isArray(data.club.links) && data.club.links.length > 0}
					{#each data.club.links as link (link.url)}
						<div class="mt-club-link-row">
							<span>{link.label ?? 'Link'}</span>
							<a href={link.url} rel="noopener noreferrer">{linkLabel(link)}</a>
						</div>
					{/each}
				{:else}
					<p>No links published yet.</p>
				{/if}
			</section>
		</div>
	{/if}
</section>
