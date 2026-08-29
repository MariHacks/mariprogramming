<script>
	import { initialsFromClubName } from '$lib/maritools/club-initials.js';
	import {
		formatClubLinkLabel,
		joinLinkFromClub
	} from '$lib/maritools/club-listing.js';

	/** @type {'view' | 'edit'} */
	export let mode = 'view';
	/** @type {{ name?: string, category?: string | null, description?: string | null, links?: Array<{ label?: string, url?: string }> }} */
	export let club = {};
	/** @type {string} */
	export let backHref = '/tools/clubs';
	/** @type {string} */
	export let backLabel = '← All clubs';

	$: listing = {
		name: String(club?.name ?? ''),
		category: String(club?.category ?? ''),
		description: String(club?.description ?? ''),
		links: Array.isArray(club?.links) ? club.links : []
	};
	$: primaryLink = listing.links[0] ?? { label: '', url: '' };
	$: join = joinLinkFromClub(listing);
</script>

<header class="club-detail-header">
	<a href={backHref}>{backLabel}</a>
	<div>
		<span class="club-initials">{initialsFromClubName(listing.name || 'Club')}</span>
		<div>
			{#if mode === 'edit'}
				<label>
					<span class="sr-only">Club name</span>
					<input
						name="name"
						required
						maxlength="160"
						value={listing.name}
						placeholder="Club name"
						data-testid="club-edit-name"
					/>
				</label>
				<label>
					<span class="sr-only">Category</span>
					<input
						name="category"
						maxlength="80"
						value={listing.category}
						placeholder="Category"
						data-testid="club-edit-category"
					/>
				</label>
			{:else}
				<h1>{listing.name}</h1>
				<p>{listing.category || 'General'}</p>
			{/if}
		</div>
	</div>
</header>

<div class="club-detail-index" data-testid="club-listing-detail" data-mode={mode}>
	<section>
		<h2>About</h2>
		{#if mode === 'edit'}
			<label>
				<span class="sr-only">Description</span>
				<textarea
					name="description"
					rows="5"
					maxlength="4000"
					placeholder="What the club does"
					data-testid="club-edit-description"
				>{listing.description}</textarea>
			</label>
		{:else if listing.description}
			<p>{listing.description}</p>
		{:else}
			<p>No description published yet.</p>
		{/if}
	</section>
	<section>
		<h2>Contact and links</h2>
		{#if mode === 'edit'}
			<label>
				<span>Link label</span>
				<input
					name="linkLabel"
					maxlength="80"
					value={primaryLink.label ?? ''}
					data-testid="club-edit-link-label"
				/>
			</label>
			<label>
				<span>Website</span>
				<input
					name="linkUrl"
					type="url"
					maxlength="500"
					value={primaryLink.url ?? ''}
					data-testid="club-edit-link-url"
				/>
			</label>
		{:else if listing.links.length > 0}
			{#each listing.links as link (link.url)}
				<div class="club-link-row">
					<span>{link.label ?? 'Link'}</span>
					<a href={link.url} rel="noopener noreferrer">{formatClubLinkLabel(link)}</a>
				</div>
			{/each}
		{:else}
			<p>No links published yet.</p>
		{/if}
	</section>
	<section>
		<h2>How to join</h2>
		{#if join}
			<p>Open the signup link, then follow the club's published channels for meeting details.</p>
			<a class="primary-button" href={join.url} rel="noopener noreferrer">Sign up for the club</a>
		{:else}
			<p>Use the published links above to get in touch.</p>
		{/if}
	</section>
</div>
