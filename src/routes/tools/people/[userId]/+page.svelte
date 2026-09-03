<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ProfileEmptyState from '$lib/maritools/components/ProfileEmptyState.svelte';
	import { formatRemaining } from '$lib/maritools/moderation-duration.js';
	import ModerationDurationDialog from '$lib/maritools/ModerationDurationDialog.svelte';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form = null;

	/** @type {'mute' | 'ban' | null} */
	let durationPrompt = null;

	/** @param {string | null | undefined} value */
	function displayName(value) {
		const trimmed = typeof value === 'string' ? value.trim() : '';
		return trimmed || 'Student';
	}

	function username() {
		return displayName(data.profile?.username ?? data.profile?.displayName);
	}

	function roleLabel() {
		return ['executive', 'staff', 'moderator'].includes(data.profile?.role)
			? 'Executive'
			: 'Member';
	}

	/** @param {string | Date | null | undefined} value */
	function monthYear(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
	}

	function membershipLine() {
		const since = monthYear(data.profile?.joinedAt);
		return since ? `${roleLabel()} since ${since}` : roleLabel();
	}

	/** @param {string | Date | null | undefined} value */
	function shortDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
	}

	/** @param {string | null | undefined} value */
	function categoryLabel(value) {
		if (value === 'student-life') return 'Student life';
		if (value === 'courses') return 'Course help';
		return value || 'Discussion';
	}

	/** @param {any} outline */
	function outlineCode(outline) {
		return outline.courseCode ?? outline.extraction?.proposals?.courseCode ?? 'Course';
	}

	/** @param {any} outline */
	function outlineTitle(outline) {
		return outline.title ?? outline.extraction?.proposals?.title ?? 'Untitled outline';
	}

	/** @param {string | null | undefined} name */
	function initials(name) {
		const label = displayName(name);
		const parts = label.split(/\s+/).filter(Boolean);
		if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
		return label.slice(0, 2).toUpperCase();
	}

	/** @param {any} profile */
	function restrictionNote(profile) {
		if (!profile) return '';
		if (profile.isBanned) {
			if (profile.bannedPermanent) return 'Banned permanently';
			const left = formatRemaining(profile.bannedUntil);
			return left && left !== 'expired' ? `Banned, ${left}` : 'Banned';
		}
		if (profile.isMuted) {
			const left = formatRemaining(profile.mutedUntil);
			return left && left !== 'expired' ? `Muted, ${left}` : 'Muted';
		}
		return '';
	}

	$: note = restrictionNote(data.profile);
	$: if (form?.moderated) durationPrompt = null;
</script>

<svelte:head>
	<title
		>{data.profile ? `${username()} | Profile` : 'Profile'} | Programming
		Club</title
	>
</svelte:head>

<section class="profile-page mt-preview">
	{#if data.unavailable}
		<div class="message message-error" role="alert">
			<p>This profile is unavailable right now.</p>
			<a class="inline-action" href={resolve('/tools/forum', {})}>Back to forum</a>
		</div>
	{:else if data.profile}
		<header class="profile-hero">
			<div class="profile-identity">
				<span class="profile-avatar">
					{#if data.profile.profileImageDataUrl}
						<img
							src={data.profile.profileImageDataUrl}
							alt={`${displayName(data.profile.displayName)} profile picture`}
						/>
					{:else}
						{initials(data.profile.displayName)}
					{/if}
				</span>
				<div class="profile-identity__copy">
					<h1>{username()}</h1>
					<p class="profile-full-name">{displayName(data.profile.displayName)}</p>
					<div class="profile-meta">
						<span>
							<svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
								<path d="M10 2.5 16 5v4.5c0 3.7-2.5 6.4-6 8-3.5-1.6-6-4.3-6-8V5l6-2.5Z" />
								<path d="m7.5 10 1.6 1.6 3.5-3.7" />
							</svg>
							{membershipLine()}
						</span>
						{#if data.viewerIsStaff && note}<span class="profile-restriction">{note}</span>{/if}
					</div>
				</div>
			</div>
		</header>

		{#if data.viewerIsStaff}
			<section class="staff-mod" aria-labelledby="staff-mod-title">
				<header class="section-heading">
					<h2 id="staff-mod-title">Moderation</h2>
				</header>
				{#if form?.error}
					<p class="message message-error" role="alert">{form.error}</p>
				{/if}
				{#if form?.moderated}
					<p class="message" role="status">Moderation applied.</p>
				{/if}
				<div class="staff-actions">
					{#if data.profile.isMuted}
						<form method="POST" action="?/unmute" use:enhance>
							<button type="submit" class="danger-button">Unmute</button>
						</form>
					{:else}
						<button type="button" class="danger-button" on:click={() => (durationPrompt = 'mute')}
							>Mute</button
						>
					{/if}
					{#if data.profile.isBanned}
						<form method="POST" action="?/unban" use:enhance>
							<button type="submit" class="danger-button">Unban</button>
						</form>
					{:else}
						<button type="button" class="danger-button" on:click={() => (durationPrompt = 'ban')}
							>Ban</button
						>
					{/if}
				</div>
			</section>
		{/if}

		<div class="profile-content">
			<section class="profile-activity" aria-labelledby="threads-title">
				<header class="content-heading">
					<h2 id="threads-title">Recent posts</h2>
				</header>
				{#if data.threads.length}
					<div class="post-list">
						{#each data.threads as thread (thread.id)}
							<a class="post" href={resolve('/tools/forum/[threadId]', { threadId: thread.id })}>
								<span class="entry-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24" fill="none">
										<path d="M5 5.5h14v10H9l-4 3v-13Z" />
										<path d="M8.5 9h7M8.5 12h4.5" />
									</svg>
								</span>
								<div class="post-copy">
									<h3>{thread.title}</h3>
									{#if thread.body}<p>{thread.body}</p>{/if}
								</div>
								<span class="post-category">{thread.courseCode ?? categoryLabel(thread.category)}</span>
								{#if thread.createdAt}<time datetime={String(thread.createdAt)}>{shortDate(thread.createdAt)}</time>{/if}
							</a>
						{/each}
					</div>
				{:else}
					<ProfileEmptyState
						kind="posts"
						title="No posts yet"
						description="This member has not started a discussion yet."
					/>
				{/if}
			</section>

			<section class="profile-outlines" aria-labelledby="outlines-title">
				<header class="content-heading">
					<h2 id="outlines-title">Course outlines</h2>
				</header>
				{#if data.courseOutlines?.length}
					<ol class="outline-list">
						{#each data.courseOutlines as outline (outline.sha256 ?? outline.id)}
							<li>
								<span class="entry-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24" fill="none">
										<path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15.5h6" />
									</svg>
								</span>
								<div class="outline-copy">
									<span>{outlineCode(outline)}</span>
									<strong>{outlineTitle(outline)}</strong>
								</div>
								{#if outline.createdAt}<time datetime={String(outline.createdAt)}>{shortDate(outline.createdAt)}</time>{/if}
							</li>
						{/each}
					</ol>
				{:else}
					<ProfileEmptyState
						kind="outlines"
						title="No outlines yet"
						description="This member has not shared any course outlines yet."
					/>
				{/if}
			</section>
		</div>
	{/if}
</section>

{#if durationPrompt}
	<ModerationDurationDialog
		kind={durationPrompt}
		idPrefix={`profile-${durationPrompt}`}
		formaction={durationPrompt === 'mute' ? '?/mute' : '?/ban'}
		title={durationPrompt === 'mute' ? 'Mute duration' : 'Ban duration'}
		confirmLabel={durationPrompt === 'mute' ? 'Confirm mute' : 'Confirm ban'}
		enhance={() =>
			async ({ result, update }) => {
				await update();
				if (result.type === 'success') durationPrompt = null;
			}}
		onCancel={() => (durationPrompt = null)}
	/>
{/if}

<style>
	.profile-page {
		min-height: calc(100vh - var(--header-h) - var(--preview-h));
		background: white;
		color: var(--ink);
	}

	.profile-hero {
		display: flex;
		min-height: 17rem;
		align-items: center;
		padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1.5rem, 5vw, 4.5rem);
		border-bottom: 1px solid var(--ink);
	}

	.profile-identity {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: clamp(1.5rem, 3vw, 2.75rem);
	}

	.profile-avatar {
		display: grid;
		width: clamp(9rem, 13vw, 10.5rem);
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: white;
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 3vw, 2.25rem);
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.profile-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.profile-identity__copy {
		min-width: 0;
	}

	.profile-identity h1 {
		max-width: 14ch;
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(3.25rem, 5vw, 4.8rem);
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 0.92;
		overflow-wrap: anywhere;
	}

	.profile-full-name {
		margin: 0.85rem 0 0;
		font-size: clamp(1.2rem, 1.8vw, 1.55rem);
		font-weight: 650;
	}

	.profile-meta {
		display: flex;
		flex-wrap: wrap;
		margin-top: 0.85rem;
		gap: 0.65rem 1.25rem;
	}

	.profile-meta > span {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		color: var(--steel);
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
		font-weight: 550;
		gap: 0.45rem;
	}

	.profile-meta svg {
		width: 1.15rem;
		height: 1.15rem;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.5;
	}

	.profile-restriction {
		color: var(--danger) !important;
	}

	.staff-mod {
		padding: 1.5rem clamp(1.5rem, 5vw, 4.5rem);
		border-bottom: 1px solid var(--line-dark);
		background: #fff8f8;
	}

	.section-heading h2 {
		margin: 0 0 1rem;
		font-family: var(--font-display);
		font-size: 1.4rem;
	}

	.staff-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.staff-actions form {
		display: inline-flex;
	}

	.danger-button {
		min-height: 2.75rem;
		padding: 0.55rem 0.9rem;
		border: 1px solid #c73b4a;
		background: #c73b4a;
		color: white;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 650;
		cursor: pointer;
	}

	.profile-content {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(19rem, 1fr);
		min-height: 32rem;
	}

	.profile-content > section {
		min-width: 0;
		padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1.5rem, 4vw, 3.5rem) 4rem;
	}

	.profile-content > section + section {
		border-left: 1px solid var(--line-dark);
	}

	.content-heading {
		padding-bottom: 1.1rem;
		border-bottom: 1px solid var(--ink);
	}

	.content-heading h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.6rem, 2vw, 2rem);
		letter-spacing: -0.035em;
		line-height: 1;
	}

	.post {
		display: grid;
		grid-template-columns: 3.25rem minmax(0, 1fr) 7rem 4rem;
		min-height: 7rem;
		align-items: center;
		padding: 1.1rem 0;
		border-bottom: 1px solid var(--line);
		color: inherit;
		column-gap: 1rem;
		text-decoration: none;
	}

	.post:hover {
		background: var(--paper-blue);
	}

	.entry-icon {
		display: grid;
		width: 2.75rem;
		aspect-ratio: 1;
		place-items: center;
		border: 1px solid var(--line-dark);
		background: var(--paper-blue);
		color: var(--blue);
	}

	.entry-icon svg {
		width: 1.35rem;
		height: 1.35rem;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.5;
	}

	.post-copy {
		min-width: 0;
	}

	.post h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.15rem;
		letter-spacing: -0.015em;
	}

	.post p {
		display: -webkit-box;
		margin: 0.35rem 0 0;
		overflow: hidden;
		color: var(--steel);
		font-size: 0.82rem;
		line-height: 1.45;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.post-category,
	.post time,
	.outline-list time {
		color: var(--steel);
		font-size: 0.76rem;
		font-variant-numeric: tabular-nums;
	}

	.post time,
	.outline-list time {
		text-align: right;
	}

	.outline-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.outline-list li {
		display: grid;
		grid-template-columns: 3.25rem minmax(0, 1fr) auto;
		min-height: 6.25rem;
		align-items: center;
		padding: 1rem 0;
		border-bottom: 1px solid var(--line);
		gap: 1rem;
	}

	.outline-copy {
		display: grid;
		min-width: 0;
		gap: 0.25rem;
	}

	.outline-copy span {
		color: var(--blue);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.outline-copy strong {
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 1.05rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.message {
		padding: 0.85rem 1rem;
		border-bottom: var(--rule);
		font-size: 0.875rem;
	}

	.message-error {
		border: 1px solid var(--danger);
		background: #fff5f6;
		color: #78142a;
		display: grid;
		gap: 0.5rem;
		justify-items: start;
	}

	.inline-action {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--blue);
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
	}

	.post:focus-visible,
	.inline-action:focus-visible,
	.danger-button:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
	}

	@media (max-width: 62rem) {
		.profile-content {
			grid-template-columns: 1fr;
		}

		.profile-content > section + section {
			border-top: 1px solid var(--line-dark);
			border-left: 0;
		}
	}

	@media (max-width: 44rem) {
		.profile-hero {
			min-height: 0;
			align-items: flex-start;
			padding-block: 2rem;
		}

		.profile-identity {
			align-items: center;
			gap: 1.15rem;
		}

		.profile-avatar {
			width: 6.75rem;
		}

		.profile-identity h1 {
			font-size: clamp(2.35rem, 11vw, 3.2rem);
			line-height: 0.95;
		}

		.profile-full-name {
			font-size: 1.05rem;
		}

		.profile-meta {
			align-items: flex-start;
			flex-direction: column;
			gap: 0;
		}

		.profile-content > section {
			padding: 2rem 1.25rem 3rem;
		}

		.post {
			grid-template-columns: 2.75rem minmax(0, 1fr) auto;
		}

		.post-category {
			display: none;
		}

		.entry-icon {
			width: 2.35rem;
		}

		.outline-list li {
			grid-template-columns: 2.75rem minmax(0, 1fr) auto;
		}
	}

	@media (max-width: 25rem) {
		.profile-identity {
			grid-template-columns: 5.25rem minmax(0, 1fr);
		}

		.profile-avatar {
			width: 5.25rem;
		}

		.profile-identity h1 {
			font-size: clamp(2rem, 10vw, 2.6rem);
		}
	}
</style>
