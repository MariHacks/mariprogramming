<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { endStaffSession } from '$lib/auth/staff-sign-out.js';

	export let data;

	$: catalogueActive = data.pathname.startsWith('/staff/catalogue');
	$: bookWorkActive = data.pathname.startsWith('/staff/book-work');
	$: reportsActive = data.pathname.startsWith('/staff/reports');
	$: catalogConflictsActive = data.pathname.startsWith('/staff/catalog-conflicts');
	$: membersActive = data.pathname.startsWith('/staff/members');
	$: ordersActive =
		!catalogueActive &&
		!bookWorkActive &&
		!reportsActive &&
		!catalogConflictsActive &&
		!membersActive &&
		data.pathname !== '/staff/sign-in';

	let signingOut = false;
	let signOutError = '';

	/** @param {SubmitEvent} event */
	async function signOut(event) {
		event.preventDefault();
		if (signingOut) return;
		signingOut = true;
		signOutError = '';
		try {
			await endStaffSession();
			await goto(resolve('/staff/sign-in', {}));
		} catch {
			signingOut = false;
			signOutError = 'Sign out is unavailable. Try again.';
		}
	}
</script>

{#if data.staff}
	<div class="staff-shell">
		<header class="staff-header">
			<a class="staff-brand" href={resolve('/staff', {})} aria-label="Programming Club Team orders">
				<img class="brand-mark" src="/logo-icon.svg" alt="" width="28" height="30" />
				<span>Programming Club Team</span>
			</a>

			<nav aria-label="Team operations">
				<a
					class:active={ordersActive}
					aria-current={ordersActive ? 'page' : undefined}
					href={resolve('/staff', {})}>Orders</a
				>
				<a
					class:active={bookWorkActive}
					aria-current={bookWorkActive ? 'page' : undefined}
					href={resolve('/staff/book-work', {})}>Book work</a
				>
				<a
					class:active={catalogueActive}
					aria-current={catalogueActive ? 'page' : undefined}
					href={resolve('/staff/catalogue/entries', {})}>Catalogue</a
				>
				<a
					class:active={membersActive}
					aria-current={membersActive ? 'page' : undefined}
					href={resolve('/staff/members', {})}>Members</a
				>
				<a
					class:active={reportsActive}
					aria-current={reportsActive ? 'page' : undefined}
					href={resolve('/staff/reports', {})}>Reports</a
				>
				<a
					class:active={catalogConflictsActive}
					aria-current={catalogConflictsActive ? 'page' : undefined}
					href={resolve('/staff/catalog-conflicts', {})}>Catalog conflicts</a
				>
			</nav>

			<div class="staff-account">
				<span class="staff-email">{data.staff.email}</span>
				<form method="post" action="/api/auth/sign-out" on:submit={signOut}>
					<button type="submit" disabled={signingOut}>Sign out</button>
				</form>
			</div>
		</header>

		{#if signingOut}<p class="session-status" role="status">Signing out</p>{/if}
		{#if signOutError}<p class="session-error" role="alert">{signOutError}</p>{/if}

		<div class="staff-content"><slot></slot></div>
	</div>
{:else}
	<slot></slot>
{/if}

<style>
	.staff-shell {
		min-height: 100vh;
		background: var(--paper);
		color: var(--midnight);
	}

	.staff-header {
		display: grid;
		grid-template-columns: minmax(13rem, 1fr) auto minmax(15rem, 1fr);
		align-items: center;
		min-height: 4.5rem;
		padding: 0 var(--page-gutter);
		border-bottom: var(--rule-strong);
		background: #fff;
		min-width: 0;
	}

	.staff-brand,
	.staff-header nav,
	.staff-account {
		display: flex;
		align-items: center;
	}

	.staff-brand {
		gap: 0.7rem;
		width: max-content;
		min-height: 2.75rem;
		color: inherit;
		font-weight: 700;
		text-decoration: none;
	}

	.staff-brand img {
		width: 1.6rem;
		height: auto;
		filter: brightness(0) saturate(100%);
	}

	.staff-header nav {
		align-self: stretch;
		gap: 0.25rem;
		min-width: 0;
	}

	.staff-header nav a,
	.staff-account button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0 0.9rem;
		font: inherit;
		font-size: 0.875rem;
	}

	.staff-header nav a {
		border-bottom: 2px solid transparent;
		color: inherit;
		font-weight: 650;
		text-decoration: none;
	}

	.staff-header nav a.active {
		border-color: var(--club-blue);
		color: var(--club-blue);
	}

	.staff-account {
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.staff-email {
		max-width: 15rem;
		overflow: hidden;
		color: var(--color-muted);
		font-size: 0.8125rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.staff-account button {
		border: var(--rule-strong);
		border-radius: 0;
		background: transparent;
		color: inherit;
		font-weight: 650;
		cursor: pointer;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out),
			transform var(--motion-press) var(--ease-out);
	}

	.staff-account button:hover {
		background: var(--midnight);
		color: white;
	}

	.staff-account button:active {
		transform: translateY(var(--press-distance));
	}

	.staff-account button:disabled {
		cursor: wait;
		opacity: 0.55;
	}

	.session-status,
	.session-error {
		margin: 0;
		padding: 0.65rem var(--page-gutter);
		border-bottom: var(--rule);
		font-size: 0.875rem;
	}

	.session-status {
		background: #edf4ff;
	}

	.session-error {
		background: #fff1f1;
		color: #8d1b1b;
	}

	.staff-content {
		width: min(100%, 96rem);
		margin: 0 auto;
	}

	@media (max-width: 52rem) {
		.staff-header {
			grid-template-columns: 1fr auto;
			padding-top: 0.5rem;
		}

		.staff-header nav {
			grid-row: 2;
			grid-column: 1 / -1;
			justify-content: flex-start;
			max-width: 100%;
			overflow-x: auto;
			overscroll-behavior-inline: contain;
			border-top: var(--rule);
			scrollbar-width: thin;
		}

		.staff-header nav a {
			flex: 0 0 auto;
			white-space: nowrap;
		}

		.staff-email {
			display: none;
		}
	}

	@media (max-width: 28rem) {
		.staff-header {
			padding-inline: 0.75rem;
		}

		.staff-brand span {
			max-width: 9.5rem;
			line-height: 1.1;
		}

		.staff-account {
			gap: 0.25rem;
		}

		.staff-header nav a {
			padding-inline: 0.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.staff-account button {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.staff-header nav a.active {
			border-color: Highlight;
			color: LinkText;
		}
	}
</style>
