<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { CLUB_SUBMITTER_ROLES } from '$lib/maritools/club-listing.js';
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

		{#if data.staff}
			<aside class="submit-club staff-pending" data-testid="staff-pending-clubs">
				<div>
					<strong>Staff</strong>
					<h2>Pending listings</h2>
				</div>
				{#if data.pending.length === 0}
					<p>No pending submissions.</p>
				{:else}
					<div class="staff-pending-list">
						{#each data.pending as submission (submission.id)}
							<article data-pending-club={submission.name}>
								<strong>{submission.name}</strong>
								{#if submission.category}
									<span>{submission.category}</span>
								{/if}
								{#if submission.description}
									<p>{submission.description}</p>
								{/if}
								<a
									class="primary-button"
									href="/tools/clubs/submissions/{submission.id}"
									data-testid="review-submission"
								>Review listing</a>
							</article>
						{/each}
					</div>
				{/if}
			</aside>
		{/if}

		{#if data.unavailable}
			<p class="field-error" role="alert">Clubs are unavailable right now. Try again.</p>
		{:else if data.clubs.length === 0}
			<div class="directory-empty" role="status">
				{#if data.query || data.category}
					<strong>No clubs match those filters.</strong>
					<p>Clear the search or choose All categories to see every published listing.</p>
					<a href="/tools/clubs">Reset filters</a>
				{:else if data.signedIn}
					<strong>No published clubs yet.</strong>
					<p>Use the form below to start a listing for staff review.</p>
				{:else}
					<strong>No published clubs yet.</strong>
					<p>Browse stays open while staff review listings. Sign in to submit one.</p>
				{/if}
			</div>
		{:else}
			<div class="club-index">
				<div class="club-head">
					<span>Organization</span><span>Focus</span><span>Listing</span>
				</div>
				{#each data.clubs as club (club.id)}
					<a class="club-row" href="/tools/clubs/{club.slug}">
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
						<span class="club-open">Open listing ↗</span>
					</a>
				{/each}
			</div>
		{/if}

		<aside class="submit-club">
			<div>
				<strong>Missing a group?</strong>
				<h2>Start a club listing</h2>
			</div>
			{#if data.unavailable}
				<p>Club submissions are unavailable right now. Try again later.</p>
			{:else if data.signedIn}
				<p>Tell us your role and the club name. You will finish the listing on the next page.</p>
				<form method="POST" action="?/submit">
					<label>
						<span>Your role in this club</span>
						<select name="submitterRole" required data-testid="submitter-role">
							<option value="">Choose one</option>
							{#each CLUB_SUBMITTER_ROLES as role (role.value)}
								<option value={role.value}>{role.label}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Club name</span>
						<input name="name" required maxlength="160" />
					</label>
					<label>
						<span>Category</span>
						<input name="category" maxlength="80" />
					</label>
					<button type="submit" class="primary-button">Continue to listing</button>
				</form>
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
	</section>
</div>
