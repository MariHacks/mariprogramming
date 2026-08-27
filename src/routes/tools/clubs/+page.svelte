<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { initialsFromClubName } from '$lib/maritools/club-initials.js';

	export let data;
	export let form = null;
</script>

<svelte:head>
	<title>Clubs | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Campus clubs and how to reach them."
	/>
</svelte:head>

<div class="mt-preview">
	<section class="page page-clubs">
		<header class="catalog-titlebar">
			<div>
				<h1>Clubs</h1>
			</div>
			<p>Campus clubs and how to reach them.</p>
		</header>

		<form method="GET" class="index-filters clubs-filters">
			<label class="search-field">
				<span>⌕</span>
				<input name="q" value={data.query} placeholder="Search clubs and interests" />
			</label>
			<label>
				<span>Category</span>
				<select name="category">
					<option value="">All categories</option>
					{#each data.categories ?? [] as option (option)}
						<option value={option} selected={option === data.category}>{option}</option>
					{/each}
				</select>
			</label>
			<button type="submit" class="dark-button">Filter</button>
		</form>

		{#if data.unavailable}
			<p class="field-error" role="alert">Clubs are unavailable right now. Try again.</p>
		{:else if data.clubs.length === 0}
			<p class="catalog-count">No published clubs yet.</p>
		{:else}
			<div class="club-index">
				<div class="club-head">
					<span>Organization</span><span>Focus</span><span>Meeting rhythm</span><span>Contact</span>
				</div>
				{#each data.clubs as club (club.id)}
					<article class="club-row">
						<div>
							<span class="club-initials">{initialsFromClubName(club.name)}</span>
							<div>
								<h2>{club.name}</h2>
								{#if club.description}
									<p>{club.description}</p>
								{/if}
							</div>
						</div>
						<span>{club.category ?? 'General'}</span>
						<span>See listing</span>
						<a href="/tools/clubs/{club.slug}">Open listing ↗</a>
					</article>
				{/each}
			</div>
		{/if}

		<aside class="submit-club">
			<div>
				<strong>Missing a group?</strong>
				<h2>Add or correct a club listing</h2>
			</div>
			{#if data.signedIn}
				<p>Staff publish a listing after they check it.</p>
				<form method="POST" action="?/submit">
					<label>
						<span>Club name</span>
						<input name="name" required maxlength="160" />
					</label>
					<label>
						<span>Category</span>
						<input name="category" maxlength="80" />
					</label>
					<label>
						<span>Description</span>
						<textarea name="description" rows="4" maxlength="4000"></textarea>
					</label>
					<label>
						<span>Link label</span>
						<input name="linkLabel" maxlength="80" />
					</label>
					<label>
						<span>Website</span>
						<input name="linkUrl" type="url" maxlength="500" />
					</label>
					<button type="submit" class="primary-button">Send for review</button>
				</form>
				{#if form?.submitted}
					<p role="status">Sent for review.</p>
				{/if}
				{#if form?.error}
					<p class="field-error" role="alert">{form.error}</p>
				{/if}
			{:else}
				<p>
					Sign in to add or update a listing. Staff check it before it goes live.
				</p>
				<a class="primary-button" href="/tools/account">Sign in with Google</a>
			{/if}
		</aside>

		{#if data.staff}
			<aside class="submit-club">
				<div>
					<strong>Staff</strong>
					<h2>Pending listings</h2>
				</div>
				{#if form?.published}
					<p role="status">Published.</p>
				{/if}
				{#if data.pending.length === 0}
					<p>No pending submissions.</p>
				{:else}
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
								<button type="submit" class="primary-button">Publish</button>
							</form>
						</article>
					{/each}
				{/if}
			</aside>
		{/if}
	</section>
</div>
