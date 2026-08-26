<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { initialsFromClubName } from '$lib/maritools/club-initials.js';
	import '$lib/maritools/styles/index-pages.css';

	export let data;
	export let form = null;

	/** @param {{ links?: Array<{ url?: string, label?: string }> }} club */
	function primaryLink(club) {
		const links = Array.isArray(club.links) ? club.links : [];
		return links.find((link) => typeof link?.url === 'string' && link.url.length > 0) ?? null;
	}
</script>

<svelte:head>
	<title>Clubs | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Browse published campus clubs and send a listing for staff to review."
	/>
</svelte:head>

<section class="mt-index-page clubs-page">
	<header class="mt-titlebar">
		<div>
			<h1>Clubs</h1>
		</div>
		<p>Published listings students have sent in. Rooms stay off this page until staff check them.</p>
	</header>

	<form method="GET" class="mt-index-filters mt-index-filters--two">
		<label class="mt-search-field">
			<span aria-hidden="true">⌕</span>
			<span>Search</span>
			<input name="q" value={data.query} placeholder="Search clubs and interests" />
		</label>
		<label>
			<span>Category</span>
			<input name="category" value={data.category} placeholder="All categories" />
		</label>
		<button type="submit" class="mt-dark-button">Filter</button>
	</form>

	{#if data.unavailable}
		<p class="mt-error" role="alert">Clubs are unavailable right now. Try again.</p>
	{:else if data.clubs.length === 0}
		<p class="mt-count-bar">No published clubs yet.</p>
	{:else}
		<div class="mt-index-table">
			<div class="mt-index-head mt-club-row">
				<span>Organization</span><span>Focus</span><span>Links</span><span>Contact</span>
			</div>
			{#each data.clubs as club (club.id)}
				<article class="mt-club-row">
					<div>
						<span class="mt-club-initials">{initialsFromClubName(club.name)}</span>
						<div>
							<h2>{club.name}</h2>
							{#if club.description}
								<p>{club.description}</p>
							{/if}
						</div>
					</div>
					<span>{club.category ?? 'General'}</span>
					<span>{Array.isArray(club.links) ? club.links.length : 0} link(s)</span>
					{#if primaryLink(club)}
						<a href={primaryLink(club).url} rel="noopener noreferrer">
							{primaryLink(club).label ?? 'Open listing'} ↗
						</a>
					{:else}
						<span>—</span>
					{/if}
				</article>
			{/each}
		</div>
	{/if}

	{#if data.signedIn}
		<section class="mt-panel">
			<h2>Submit a club</h2>
			<p>Staff publish a listing after they check it.</p>
			<form method="POST" action="?/submit" class="mt-stack">
				<label>
					Club name
					<input name="name" required maxlength="160" />
				</label>
				<label>
					Category
					<input name="category" maxlength="80" />
				</label>
				<label>
					Description
					<textarea name="description" rows="4" maxlength="4000"></textarea>
				</label>
				<label>
					Link label
					<input name="linkLabel" maxlength="80" />
				</label>
				<label>
					Website
					<input name="linkUrl" type="url" maxlength="500" />
				</label>
				<button type="submit" class="mt-primary-button">Send for review</button>
			</form>
			{#if form?.submitted}
				<p class="mt-status" role="status">Sent for review.</p>
			{/if}
			{#if form?.error}
				<p class="mt-error" role="alert">{form.error}</p>
			{/if}
		</section>
	{:else}
		<p class="mt-panel"><a href="/tools/account">Sign in with Google</a> to submit a club.</p>
	{/if}

	{#if data.staff}
		<section class="mt-panel">
			<h2>Pending listings</h2>
			{#if form?.published}
				<p class="mt-status" role="status">Published.</p>
			{/if}
			{#if data.pending.length === 0}
				<p>No pending submissions.</p>
			{:else}
				<div class="mt-stack">
					{#each data.pending as submission (submission.id)}
						<article>
							<strong>{submission.name}</strong>
							{#if submission.category}
								<span>{submission.category}</span>
							{/if}
							{#if submission.description}
								<p>{submission.description}</p>
							{/if}
							<form method="POST" action="?/publish">
								<input type="hidden" name="submissionId" value={submission.id} />
								<button type="submit" class="mt-primary-button">Publish</button>
							</form>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</section>
