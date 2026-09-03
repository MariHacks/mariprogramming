<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatRemaining } from '$lib/maritools/moderation-duration.js';
	import ModerationDurationDialog from '$lib/maritools/ModerationDurationDialog.svelte';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form = null;

	/** @type {'mute' | 'ban' | null} */
	let durationPrompt = null;

	const torontoDate = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'medium',
		timeZone: 'America/Toronto'
	});

	/** @param {string | null | undefined} value */
	function displayName(value) {
		const trimmed = typeof value === 'string' ? value.trim() : '';
		return trimmed || 'Student';
	}

	/** @param {string | null | undefined} value */
	function when(value) {
		if (!value) return '';
		return torontoDate.format(new Date(value));
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
			return left && left !== 'expired' ? `Banned · ${left}` : 'Banned';
		}
		if (profile.isMuted) {
			const left = formatRemaining(profile.mutedUntil);
			return left && left !== 'expired' ? `Muted · ${left}` : 'Muted';
		}
		return '';
	}

	$: note = restrictionNote(data.profile);
	$: if (form?.moderated) durationPrompt = null;
</script>

<svelte:head>
	<title
		>{data.profile ? `${displayName(data.profile.displayName)} | Profile` : 'Profile'} | Programming
		Club</title
	>
</svelte:head>

<section class="profile-page">
	{#if data.unavailable}
		<div class="message message-error" role="alert">
			<p>This profile is unavailable right now.</p>
			<a class="inline-action" href={resolve('/tools/forum', {})}>Back to forum</a>
		</div>
	{:else if data.profile}
		<header class="profile-heading">
			<span class="avatar" aria-hidden="true">{initials(data.profile.displayName)}</span>
			<div>
				<p class="eyebrow">Public profile</p>
				<h1>{displayName(data.profile.displayName)}</h1>
				<p class="heading-note">
					{data.profile.role === 'staff' || data.profile.role === 'moderator'
						? 'Club team'
						: 'MariTools student'}
					{#if note}
						· {note}
					{:else if data.profile.isRestricted}
						· Restricted from posting
					{/if}
				</p>
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

		<section class="threads" aria-labelledby="threads-title">
			<header class="section-heading">
				<h2 id="threads-title">Recent threads</h2>
				<p>
					{data.threads.length}
					{data.threads.length === 1 ? 'thread' : 'threads'}
				</p>
			</header>

			{#if data.threads.length === 0}
				<p class="empty">No public threads yet.</p>
			{:else}
				<ol class="thread-list">
					{#each data.threads as thread (thread.id)}
						<li>
							<a href={resolve('/tools/forum/[threadId]', { threadId: thread.id })}>
								<strong>{thread.title}</strong>
								{#if thread.createdAt}
									<time datetime={String(thread.createdAt)}>{when(thread.createdAt)}</time>
								{/if}
							</a>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
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
		width: min(42rem, 100%);
		margin-inline: auto;
		padding: clamp(1.25rem, 3vw, 2.5rem) var(--page-gutter) 4rem;
	}

	.profile-heading {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		padding-bottom: 1.25rem;
		border-bottom: var(--rule-strong);
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		flex: none;
		background: var(--club-blue);
		color: white;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.eyebrow {
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.profile-heading h1 {
		margin-top: 0.15rem;
		font-size: clamp(1.45rem, 2.6vw, 1.9rem);
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	.heading-note {
		margin-top: 0.35rem;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		padding: 1.5rem 0 0.85rem;
	}

	.section-heading h2 {
		font-size: 1.125rem;
		letter-spacing: -0.02em;
	}

	.section-heading p,
	.empty {
		color: var(--color-muted);
		font-size: 0.875rem;
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
		min-height: 2.25rem;
		padding: 0.35rem 0.65rem;
		border: 1px solid #c73b4a;
		background: #c73b4a;
		color: white;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 650;
		cursor: pointer;
	}

	.thread-list {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: var(--rule-strong);
	}

	.thread-list li {
		border-bottom: var(--rule);
	}

	.thread-list a {
		display: grid;
		gap: 0.2rem;
		padding: 0.85rem 0;
		color: inherit;
		text-decoration: none;
	}

	.thread-list strong {
		font-size: 0.9375rem;
	}

	.thread-list time {
		color: var(--color-muted);
		font-size: 0.75rem;
		font-family: var(--font-mono);
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
		color: var(--club-blue);
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
	}

	.thread-list a:focus-visible,
	.inline-action:focus-visible,
	.danger-button:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
	}
</style>
