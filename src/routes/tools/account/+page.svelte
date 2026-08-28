<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { initialsFromDisplayName } from '$lib/maritools/header-account.js';
	import { requestStudentAuthorization } from '$lib/auth/student-sign-in.js';
	import { endStaffSession } from '$lib/auth/staff-sign-out.js';

	export let data;
	export let form = null;

	let pending = false;
	let failed = false;
	let signInError = '';
	let signOutFailed = false;

	/** @param {string} email */
	function labelFromEmail(email) {
		return email.split('@')[0] || 'Account';
	}

	/** @param {string} callbackURL */
	function googleSignInUnavailableMessage(callbackURL) {
		try {
			const host = new URL(callbackURL).hostname;
			if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
				return 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local to a real Google Cloud OAuth web client, then restart the dev server.';
			}
		} catch {
		}
		return 'Google sign-in is not configured on this site.';
	}

	async function beginSignIn() {
		if (pending || data.googleSignInConfigured === false) return;
		pending = true;
		failed = false;
		signInError = '';
		try {
			const authorizationUrl = await requestStudentAuthorization(data.callbackURL);
			globalThis.location.assign(authorizationUrl);
		} catch (error) {
			pending = false;
			failed = true;
			if (error instanceof Error && error.message === 'Google sign-in is not configured') {
				signInError = googleSignInUnavailableMessage(data.callbackURL);
			} else {
				signInError = 'Sign-in is unavailable. Try again.';
			}
		}
	}

	async function signOut() {
		if (pending) return;
		pending = true;
		signOutFailed = false;
		try {
			await endStaffSession();
			globalThis.location.assign('/tools/account');
		} catch {
			pending = false;
			signOutFailed = true;
		}
	}
</script>

<svelte:head>
	<title>Your account | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Sign in with Google. Save your student number for MariTools."
	/>
</svelte:head>

<div class="mt-preview">
	<section class="page page-account">
		<header class="index-title">
			<div>
				<h1>Your account</h1>
				{#if data.view.kind === 'guest'}
					<p>Sign in with Google to save outlines and use the catalog. Any Google account works.</p>
				{:else if data.view.kind === 'incomplete'}
					<p>
						Your student number stays on the server. It does not show on the catalog, forum, or
						schedule.
					</p>
				{:else}
					<p>Your Google account is linked. Student number stays off other pages.</p>
				{/if}
			</div>
		</header>

		{#if data.recoveryMessage}
			<p class="field-error" role="alert">{data.recoveryMessage}</p>
		{/if}
		{#if data.unavailable}
			<p class="field-error" role="alert">Account details are unavailable right now. Try again.</p>
		{/if}
		{#if form?.error}
			<p class="field-error" role="alert">{form.error}</p>
		{/if}
		{#if form?.success}
			<p role="status">Account saved.</p>
		{/if}
		{#if signOutFailed}
			<p class="field-error" role="alert">Sign out is unavailable. Try again.</p>
		{/if}

		<div class="account-layout">
			<div class="settings-sheet">
				{#if data.view.kind === 'guest'}
					<section>
						<header>
							<div>
								<h2>Sign in</h2>
								<p>Use Google to save schedules, outlines, and forum posts.</p>
							</div>
						</header>
						{#if data.googleSignInConfigured === false}
							<p class="field-error" role="alert">
								{googleSignInUnavailableMessage(data.callbackURL)}
							</p>
						{:else}
							<form on:submit|preventDefault={beginSignIn}>
								<button type="submit" class="primary-button" disabled={pending}
									>Continue with Google</button
								>
							</form>
							{#if pending}<p role="status">Opening Google sign-in</p>{/if}
							{#if failed}<p class="field-error" role="alert">{signInError}</p>{/if}
						{/if}
					</section>
				{:else if data.view.kind === 'incomplete'}
					<section>
						<header>
							<div>
								<h2>Profile</h2>
								<p>Shown next to discussions and contributions.</p>
							</div>
							<span class="signed-status"><i></i> Signed in</span>
						</header>
						<div class="identity-row">
							<span class="identity-avatar"
								>{initialsFromDisplayName(labelFromEmail(data.view.email))}</span
							>
							<div>
								<strong>{labelFromEmail(data.view.email)}</strong>
								<p>{data.view.email}</p>
							</div>
							<button class="quiet-button" type="button" on:click={signOut} disabled={pending}
								>Sign out</button
							>
						</div>
					</section>
					<section>
						<header>
							<div>
								<h2>Student details</h2>
								<p>Used only to connect your schedule and semester.</p>
							</div>
						</header>
						<form method="POST" action="?/complete">
							<div class="setting-row">
								<label>
									<span>Student number</span>
									<input
										name="studentId"
										inputmode="numeric"
										autocomplete="off"
										required
										minlength="5"
										maxlength="8"
									/>
								</label>
								<div>
									<span>Storage</span>
									<strong>Encrypted</strong>
									<small>Never displayed publicly</small>
								</div>
							</div>
							<label>
								<span>Display name, optional</span>
								<input name="displayName" maxlength="120" />
							</label>
							<label class="share-band">
								<input type="checkbox" name="nimAccepted" />
								<span>{data.nimDisclosure}</span>
							</label>
							<button type="submit" class="dark-button">Save changes</button>
						</form>
					</section>
					<section>
						<header>
							<div>
								<h2>Privacy and data</h2>
								<p>What we store and how the student number is kept.</p>
							</div>
						</header>
						<details>
							<summary>How your student number is protected</summary>
							<p>
								Your student number is encrypted before storage and is never used as a public
								identifier.
							</p>
						</details>
					</section>
				{:else}
					<section>
						<header>
							<div>
								<h2>Profile</h2>
								<p>Shown next to discussions and contributions.</p>
							</div>
							<span class="signed-status"><i></i> Signed in</span>
						</header>
						<div class="identity-row">
							<span class="identity-avatar">
								{initialsFromDisplayName(data.view.displayName ?? labelFromEmail(data.view.email))}
							</span>
							<div>
								<strong>{data.view.displayName ?? labelFromEmail(data.view.email)}</strong>
								<p>{data.view.email}</p>
							</div>
							<button class="quiet-button" type="button" on:click={signOut} disabled={pending}
								>Sign out</button
							>
						</div>
					</section>
					<section>
						<header>
							<div>
								<h2>Student details</h2>
								<p>Used only to connect your schedule and semester.</p>
							</div>
						</header>
						<div class="setting-row">
							<div>
								<span>Student number</span>
								<strong>Saved</strong>
								<small>Kept off other pages</small>
							</div>
							<div>
								<span>Storage</span>
								<strong>Encrypted</strong>
								<small>Never displayed publicly</small>
							</div>
						</div>
						<div class="setting-row">
							<div>
								<span>NVIDIA outline analysis</span>
								<strong>{data.view.nimAccepted ? 'Accepted' : 'Not accepted yet'}</strong>
							</div>
						</div>
						{#if !data.view.nimAccepted}
							<form method="POST" action="?/complete">
								<label>
									<span>Student number</span>
									<input name="studentId" inputmode="numeric" required minlength="5" maxlength="8" />
								</label>
								<label class="share-band">
									<input type="checkbox" name="nimAccepted" />
									<span>{data.nimDisclosure}</span>
								</label>
								<button type="submit" class="dark-button">Save changes</button>
							</form>
						{/if}
					</section>
					<section>
						<header>
							<div>
								<h2>Privacy and data</h2>
								<p>What we store and how the student number is kept.</p>
							</div>
						</header>
						<details>
							<summary>How your student number is protected</summary>
							<p>
								Your student number is encrypted before storage and is never used as a public
								identifier.
							</p>
						</details>
					</section>
				{/if}
			</div>
		</div>
	</section>
</div>
