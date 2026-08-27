<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { initialsFromClubName } from '$lib/maritools/club-initials.js';

	export let data;

	/** @param {{ label?: string, url?: string }} link */
	function linkLabel(link) {
		const label = String(link.label ?? '').trim();
		if (label) return `${label} ↗`;
		return `${link.url ?? 'Open link'} ↗`;
	}

	/** @param {{ links?: Array<{ label?: string, url?: string }> }} club */
	function joinLink(club) {
		const links = Array.isArray(club.links) ? club.links : [];
		return (
			links.find((link) =>
				/join|sign\s?up|form|register/i.test(`${link.label ?? ''} ${link.url ?? ''}`)
			) ?? null
		);
	}
</script>

<svelte:head>
	<title>{data.club?.name ?? 'Club'} | Clubs | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content={data.club?.description ?? 'Published campus club listing on MariTools.'}
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
			<header class="club-detail-header">
				<a href="/tools/clubs">← All clubs</a>
				<div>
					<span class="club-initials">{initialsFromClubName(data.club.name)}</span>
					<div>
						<h1>{data.club.name}</h1>
						<p>{data.club.category ?? 'General'}</p>
					</div>
				</div>
			</header>
			<div class="club-detail-index">
				<section>
					<h2>About</h2>
					{#if data.club.description}
						<p>{data.club.description}</p>
					{:else}
						<p>No description published yet.</p>
					{/if}
				</section>
				<section>
					<h2>Meeting rhythm</h2>
					<p>
						Confirm the next session through the club's published links.
					</p>
				</section>
				<section>
					<h2>Contact and links</h2>
					{#if Array.isArray(data.club.links) && data.club.links.length > 0}
						{#each data.club.links as link (link.url)}
							<div class="club-link-row">
								<span>{link.label ?? 'Link'}</span>
								<a href={link.url} rel="noopener noreferrer">{linkLabel(link)}</a>
							</div>
						{/each}
					{:else}
						<p>No links published yet.</p>
					{/if}
				</section>
				<section>
					<h2>How to join</h2>
					{#if joinLink(data.club)}
						<p>Open the signup link, then follow the club's published channels for meeting details.</p>
						<a class="primary-button" href={joinLink(data.club).url} rel="noopener noreferrer"
							>Sign up for the club</a
						>
					{:else}
						<p>Use the published links above to get in touch.</p>
					{/if}
				</section>
			</div>
		{/if}
	</section>
</div>
