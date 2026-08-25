<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { requestStudentAuthorization } from '$lib/auth/student-sign-in.js';

	export let data;
	export let form = null;

	let pending = false;
	let failed = false;

	async function beginSignIn() {
		if (pending) return;
		pending = true;
		failed = false;
		try {
			const authorizationUrl = await requestStudentAuthorization(data.callbackURL);
			globalThis.location.assign(authorizationUrl);
		} catch {
			pending = false;
			failed = true;
		}
	}
</script>

<svelte:head>
	<title>Your account | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Sign in with Google and save your student number for MariTools."
	/>
</svelte:head>

<section class="account-page page-container">
	<header class="intro">
		<h1>Your account</h1>
		{#if data.view.kind === 'guest'}
			<p>Sign in with Google to save outlines and contribute to the catalog. Any Google account works.</p>
		{:else if data.view.kind === 'incomplete'}
			<p>
				We keep your student number on the server. It does not show on the catalog, forum, or
				schedule pages.
			</p>
		{:else}
			<p>Signed in as {data.view.email}.</p>
		{/if}
	</header>

	{#if data.recoveryMessage}
		<p class="error" role="alert">{data.recoveryMessage}</p>
	{/if}
	{#if data.unavailable}
		<p class="error" role="alert">Account details are unavailable right now. Try again.</p>
	{/if}
	{#if form?.error}
		<p class="error" role="alert">{form.error}</p>
	{/if}
	{#if form?.success}
		<p class="status" role="status">Account saved.</p>
	{/if}

	{#if data.view.kind === 'guest'}
		<form on:submit|preventDefault={beginSignIn}>
			<button type="submit" class="primary" disabled={pending}>Continue with Google</button>
		</form>
		{#if pending}<p class="status" role="status">Opening Google sign-in</p>{/if}
		{#if failed}<p class="error" role="alert">Sign-in is unavailable. Try again.</p>{/if}
	{:else if data.view.kind === 'incomplete'}
		<p class="email">{data.view.email}</p>
		<form method="POST" action="?/complete" class="account-form">
			<label>
				Student number
				<input
					name="studentId"
					inputmode="numeric"
					autocomplete="off"
					required
					minlength="5"
					maxlength="8"
				/>
			</label>
			<label>
				Display name, optional
				<input name="displayName" maxlength="120" />
			</label>
			<label class="disclose">
				<input type="checkbox" name="nimAccepted" />
				{data.nimDisclosure}
			</label>
			<button type="submit" class="primary">Save account</button>
		</form>
	{:else}
		<dl class="profile">
			<div>
				<dt>Email</dt>
				<dd>{data.view.email}</dd>
			</div>
			{#if data.view.displayName}
				<div>
					<dt>Display name</dt>
					<dd>{data.view.displayName}</dd>
				</div>
			{/if}
			<div>
				<dt>Student number</dt>
				<dd>Saved, and kept off other pages.</dd>
			</div>
			<div>
				<dt>NVIDIA outline analysis</dt>
				<dd>{data.view.nimAccepted ? 'Accepted' : 'Not accepted yet'}</dd>
			</div>
		</dl>
		{#if !data.view.nimAccepted}
			<form method="POST" action="?/complete" class="account-form">
				<label>
					Student number
					<input name="studentId" inputmode="numeric" required minlength="5" maxlength="8" />
				</label>
				<label class="disclose">
					<input type="checkbox" name="nimAccepted" />
					{data.nimDisclosure}
				</label>
				<button type="submit" class="primary">Save account</button>
			</form>
		{/if}
	{/if}
</section>

<style>
	.account-page {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-md);
		max-width: 42rem;
	}

	.intro h1 {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		line-height: 1.05;
	}

	.intro p,
	.disclose,
	.email {
		max-width: 52ch;
	}

	.email {
		color: var(--quiet-steel);
	}

	.account-form,
	.profile {
		display: grid;
		gap: var(--space-sm);
	}

	.account-form label,
	.profile div {
		display: grid;
		gap: var(--space-3xs);
		padding-block: var(--space-sm);
		border-block-start: var(--rule);
	}

	.disclose {
		grid-template-columns: auto 1fr;
		align-items: start;
		font-weight: 400;
		font-size: var(--text-sm);
	}

	input:not([type='checkbox']) {
		height: var(--control-height);
		padding-inline: var(--space-xs);
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--graphite);
		font: inherit;
	}

	.primary {
		justify-self: start;
		height: var(--control-height);
		padding-inline: var(--space-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--club-blue);
		color: #fff;
		font-weight: 650;
	}

	.primary:disabled {
		cursor: wait;
		opacity: 0.65;
	}

	.primary:focus-visible {
		outline: var(--focus-ring-width) solid var(--club-blue);
		outline-offset: var(--focus-ring-offset);
	}

	.error {
		color: var(--danger);
	}

	.status {
		font-size: var(--text-sm);
		color: var(--quiet-steel);
	}

	dt {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--quiet-steel);
	}
</style>
