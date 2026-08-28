<script>
	import { resolve } from '$app/paths';
	import { requestStaffAuthorization } from '$lib/auth/staff-sign-in.js';

	export let data;
	let pending = false;
	let failed = false;

	async function beginSignIn() {
		if (pending) return;
		pending = true;
		failed = false;
		try {
			const authorizationUrl = await requestStaffAuthorization(data.callbackURL);
			globalThis.location.assign(authorizationUrl);
		} catch {
			pending = false;
			failed = true;
		}
	}
</script>

<svelte:head>
	<title>Staff access | Marianopolis Programming Club</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="staff-sign-in">
	<div class="sign-in-frame">
		<h1>Staff access</h1>
		<p>Sign in with the <strong>team@marihacks.com</strong> Google account.</p>
		{#if data.recoveryMessage}<p class="error" role="alert">{data.recoveryMessage}</p>{/if}

		<form on:submit|preventDefault={beginSignIn}>
			<button type="submit" disabled={pending}>Continue with Google</button>
		</form>

		{#if pending}<p class="status" role="status">Opening Google sign-in</p>{/if}
		{#if failed}
			<p class="error" role="alert">
				Sign-in is unavailable. Please try again.
				<span class="hint">If Google asks for another account, cancel and use team@marihacks.com.</span>
			</p>
		{/if}
		<a class="exit-link" href={resolve('/', {})}>Back to the club site</a>
	</div>
</section>

<style>
	.staff-sign-in {
		display: grid;
		min-height: 62vh;
		place-items: center;
		padding: var(--space-2xl) var(--page-gutter);
		border-bottom: var(--rule);
	}

	.sign-in-frame {
		width: min(100%, 34rem);
		padding-block: var(--space-xl);
		border-block: var(--rule-strong);
	}

	h1 + p {
		margin-top: var(--space-sm);
		color: var(--quiet-steel);
	}

	form {
		margin-top: var(--space-lg);
	}

	button {
		min-height: 2.75rem;
		padding: 0.7rem 1rem;
		border: 1px solid var(--club-blue);
		border-radius: var(--radius-xs);
		background: var(--club-blue);
		color: white;
		font-weight: 600;
		cursor: pointer;
	}

	button:disabled {
		cursor: wait;
		opacity: 0.65;
	}

	button:focus-visible,
	.exit-link:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
	}

	.status,
	.error {
		margin-top: var(--space-sm);
		font-size: var(--text-sm);
	}

	.error {
		color: var(--danger);
	}

	.error .hint {
		display: block;
		margin-top: 0.35rem;
		color: var(--quiet-steel);
	}

	.exit-link {
		display: inline-block;
		margin-top: var(--space-lg);
		color: var(--midnight);
		font-weight: 600;
	}
</style>
