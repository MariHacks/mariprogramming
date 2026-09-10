<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';
	import { SCIENCE_PBL_ID } from '$lib/pbl/catalog.js';
	import { normalizeRoomCode } from '$lib/pbl/room-code.js';
	import { requestStudentAuthorization } from '$lib/auth/student-sign-in.js';

	/** @type {{ signedIn?: boolean, email?: string | null }} */
	export let data;

	$: signedIn = Boolean(data?.signedIn);
	$: accountHref = resolve('/tools/account', {});

	let teamName = '';
	let joinCode = '';
	let error = '';
	let busy = false;
	let signingIn = false;

	async function startSignIn() {
		error = '';
		signingIn = true;
		try {
			const callbackURL = `${$page.url.origin}${$page.url.pathname}`;
			const url = await requestStudentAuthorization(callbackURL);
			window.location.assign(url);
		} catch (err) {
			signingIn = false;
			error =
				err instanceof Error && err.message
					? err.message
					: 'Sign-in is unavailable. Try again from your club account page.';
		}
	}

	async function createRoom() {
		error = '';
		if (!signedIn) {
			error = 'Sign in with your club Google account before creating a team.';
			return;
		}
		busy = true;
		try {
			const response = await fetch('/api/pbl/rooms', {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ pblId: SCIENCE_PBL_ID, teamName })
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				error = typeof payload.error === 'string' ? payload.error : 'Could not create the team.';
				return;
			}
			await goto(resolve(`/pbl/science/${payload.code}`, {}));
		} catch {
			error = 'Could not create the team.';
		} finally {
			busy = false;
		}
	}

	async function joinRoom() {
		error = '';
		if (!signedIn) {
			error = 'Sign in with your club Google account before joining a team.';
			return;
		}
		const code = normalizeRoomCode(joinCode);
		if (!code) {
			error = 'Enter a 6-character room code.';
			return;
		}
		busy = true;
		try {
			const response = await fetch(`/api/pbl/rooms/${code}/join`, {
				method: 'POST',
				headers: { accept: 'application/json' }
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				error = typeof payload.error === 'string' ? payload.error : 'Could not join that team.';
				return;
			}
			await goto(resolve(`/pbl/science/${payload.code}`, {}));
		} catch {
			error = 'Could not join that team.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>PBL 1 | {clubContent.name}</title>
	<meta
		name="description"
		content="Speedrun Programming in Science. Create or join a team room and build one data analyzer in the browser."
	/>
</svelte:head>

<section class="join-page surface-paper editorial-page">
	<div class="page-container join-frame editorial-frame">
		<div class="problem">
			<p class="series-label">PBL 1</p>
			<SectionIntro
				title="Speedrun Programming in Science"
				summary="Build one growing program together. Create a team or join with a room code. Up to 10 people share the same Python editor."
			/>
			<ul class="facts">
				<li>In-browser Python. No install.</li>
				<li>Each Run is checked. Three hints per step if you get stuck.</li>
				<li>Everyone types at once. Colored cursors show who is where.</li>
			</ul>
		</div>

		{#if !signedIn}
			<div class="sign-in-card" role="region" aria-labelledby="pbl-sign-in-title">
				<h2 id="pbl-sign-in-title">Club account required</h2>
				<p>
					Create or join a workshop team with the same Google account you use for MariTools. That
					way staff can see who is on each team.
				</p>
				<div class="sign-in-actions">
					<button class="button-primary" type="button" disabled={signingIn} on:click={startSignIn}>
						{signingIn ? 'Opening Google…' : 'Sign in with Google'}
					</button>
					<a class="quiet-link" href={accountHref}>Open club account page <span aria-hidden="true">→</span></a>
				</div>
			</div>
		{:else}
			<p class="signed-in-note">
				Signed in{data.email ? ` as ${data.email}` : ''}. You can create or join a team below.
			</p>
		{/if}

		<div class="join-panels" class:disabled-panels={!signedIn}>
			<form class="panel" on:submit|preventDefault={createRoom} aria-labelledby="create-title">
				<h2 id="create-title">Create a team</h2>
				<label>
					Team name
					<input bind:value={teamName} name="teamName" maxlength="80" required disabled={!signedIn || busy} />
				</label>
				<button class="button-primary" type="submit" disabled={!signedIn || busy}>Create room</button>
			</form>

			<form class="panel" on:submit|preventDefault={joinRoom} aria-labelledby="join-title">
				<h2 id="join-title">Join a team</h2>
				<label>
					Room code
					<input bind:value={joinCode} name="joinCode" maxlength="12" autocomplete="off" disabled={!signedIn || busy} />
				</label>
				<button class="button-secondary" type="submit" disabled={!signedIn || busy}>Join room</button>
			</form>
		</div>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<nav class="back" aria-label="Workshop links">
			<a class="quiet-link" href={resolve('/pbl', {})}
				>All workshops <span aria-hidden="true">→</span></a
			>
			<a class="quiet-link" href={resolve('/our-workshops', {})}
				>Workshop archive <span aria-hidden="true">→</span></a
			>
		</nav>
	</div>
</section>

<style>

	.sign-in-card {
		display: grid;
		gap: 0.75rem;
		padding: 1.15rem 1.35rem 1.25rem;
		border: var(--rule);
		border-radius: 0.5rem;
		background: #fff;
	}

	.sign-in-card h2 {
		font-size: var(--text-xl);
	}

	.sign-in-card p {
		margin: 0;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.55;
	}

	.sign-in-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.85rem 1.25rem;
	}

	.signed-in-note {
		margin: 0;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
	}

	.disabled-panels {
		opacity: 0.72;
	}

	.join-frame {
		gap: clamp(1.75rem, 4vw, 2.75rem);
	}

	.problem {
		display: grid;
		gap: 1rem;
		padding-block-end: 0.5rem;
	}

	.series-label {
		color: var(--quiet-steel);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.facts {
		margin: 0;
		padding-inline-start: 1.15rem;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.55;
	}

	.join-panels {
		display: grid;
		border: var(--rule);
		border-radius: 0.5rem;
		background: #fff;
		overflow: hidden;
	}

	.panel {
		display: grid;
		justify-items: start;
		padding: 1.25rem 1.35rem 1.4rem;
		gap: var(--space-sm);
	}

	.panel + .panel {
		border-block-start: var(--rule);
	}

	.panel h2 {
		font-size: var(--text-xl);
	}

	label {
		display: grid;
		width: min(100%, 22rem);
		gap: 0.35rem;
		font-size: var(--text-sm);
		font-weight: 600;
	}

	input {
		min-height: var(--control-height);
		padding: 0.55rem 0.75rem;
		border: 1px solid rgb(var(--midnight-rgb) / 24%);
		border-radius: 0.35rem;
		background: #fff;
	}

	.error {
		color: var(--danger);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.back {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
	}

	@media (min-width: 52rem) {
		.join-frame {
			grid-template-columns: minmax(16rem, 0.9fr) minmax(0, 1.1fr);
			align-items: start;
		}

		.join-panels {
			grid-template-columns: 1fr 1fr;
		}

		.panel + .panel {
			border-block-start: 0;
			border-inline-start: var(--rule);
		}
	}
</style>
