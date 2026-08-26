<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { initialsFromDisplayName } from '$lib/maritools/header-account.js';
	import '$lib/maritools/styles/index-pages.css';
	import { requestStudentAuthorization } from '$lib/auth/student-sign-in.js';

	export let data;
	export let form = null;

	let pending = false;
	let failed = false;

	/** @param {string} email */
	function labelFromEmail(email) {
		return email.split('@')[0] || 'Account';
	}

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

<section class="mt-index-page mt-account-page">
	<header class="mt-account-header">
		<h1>Your account</h1>
		{#if data.view.kind === 'guest'}
			<p>Sign in with Google to save outlines and contribute to the catalog. Any Google account works.</p>
		{:else if data.view.kind === 'incomplete'}
			<p>
				We keep your student number on the server. It does not show on the catalog, forum, or schedule
				pages.
			</p>
		{:else}
			<p>Save personal tools and control what MariTools keeps.</p>
		{/if}
	</header>

	{#if data.recoveryMessage}
		<p class="mt-error" role="alert">{data.recoveryMessage}</p>
	{/if}
	{#if data.unavailable}
		<p class="mt-error" role="alert">Account details are unavailable right now. Try again.</p>
	{/if}
	{#if form?.error}
		<p class="mt-error" role="alert">{form.error}</p>
	{/if}
	{#if form?.success}
		<p class="mt-status" role="status">Account saved.</p>
	{/if}

	<div class="mt-account-sheet">
		{#if data.view.kind === 'guest'}
			<section class="mt-account-section">
				<header>
					<div>
						<h2>Sign in</h2>
						<p>Use Google to save schedules, outlines, and forum posts.</p>
					</div>
				</header>
				<form on:submit|preventDefault={beginSignIn}>
					<button type="submit" class="mt-primary-button" disabled={pending}>Continue with Google</button>
				</form>
				{#if pending}<p class="mt-status" role="status">Opening Google sign-in</p>{/if}
				{#if failed}<p class="mt-error" role="alert">Sign-in is unavailable. Try again.</p>{/if}
			</section>
		{:else if data.view.kind === 'incomplete'}
			<section class="mt-account-section">
				<header>
					<div>
						<h2>Profile</h2>
						<p>Shown next to discussions and contributions.</p>
					</div>
				</header>
				<div class="mt-account-identity">
					<span class="mt-account-avatar">{initialsFromDisplayName(labelFromEmail(data.view.email))}</span>
					<div>
						<strong>{labelFromEmail(data.view.email)}</strong>
						<p>{data.view.email}</p>
					</div>
				</div>
			</section>
			<section class="mt-account-section">
				<header>
					<div>
						<h2>Student details</h2>
						<p>Used only to connect your schedule and semester.</p>
					</div>
				</header>
				<form method="POST" action="?/complete" class="mt-account-form">
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
					<button type="submit" class="mt-primary-button">Save account</button>
				</form>
			</section>
		{:else}
			<section class="mt-account-section">
				<header>
					<div>
						<h2>Profile</h2>
						<p>Shown next to discussions and contributions.</p>
					</div>
					<span class="mt-account-signed"><i></i> Signed in</span>
				</header>
				<div class="mt-account-identity">
					<span class="mt-account-avatar">
						{initialsFromDisplayName(data.view.displayName ?? labelFromEmail(data.view.email))}
					</span>
					<div>
						<strong>{data.view.displayName ?? labelFromEmail(data.view.email)}</strong>
						<p>{data.view.email}</p>
					</div>
				</div>
			</section>
			<section class="mt-account-section">
				<header>
					<div>
						<h2>Student details</h2>
						<p>Used only to connect your schedule and semester.</p>
					</div>
				</header>
				<dl class="mt-account-profile">
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
					<form method="POST" action="?/complete" class="mt-account-form">
						<label>
							Student number
							<input name="studentId" inputmode="numeric" required minlength="5" maxlength="8" />
						</label>
						<label class="disclose">
							<input type="checkbox" name="nimAccepted" />
							{data.nimDisclosure}
						</label>
						<button type="submit" class="mt-primary-button">Save account</button>
					</form>
				{/if}
			</section>
		{/if}
	</div>
</section>
