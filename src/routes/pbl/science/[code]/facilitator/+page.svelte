<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { clubContent } from '$lib/content/club';
	import { getScienceStep } from '$lib/pbl/science-workshop.js';
	import { teamPace, timeOnStepLabel } from '$lib/pbl/workshop-session.js';

	$: code = $page.params.code;
	/** @type {any} */
	let room = null;
	$: pace = room
		? teamPace(getScienceStep(room.currentStep), room.lastCheck, room.stepEnteredAt, now)
		: null;
	let error = '';
	let now = Date.now();
	/** @type {ReturnType<typeof setInterval> | null} */
	let timer = null;

	async function load() {
		try {
			const response = await fetch(`/api/pbl/rooms/${code}`, {
				headers: { accept: 'application/json' }
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				error = typeof payload.error === 'string' ? payload.error : 'Room not found.';
				return;
			}
			room = payload;
			error = '';
		} catch {
			error = 'Could not load this team.';
		}
	}

	onMount(() => {
		void load();
		timer = setInterval(() => {
			now = Date.now();
			void load();
		}, 2000);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<svelte:head>
	<title>Facilitator | {clubContent.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="facilitator editorial-page surface-paper">
	<div class="page-container editorial-frame">
		<p class="eyebrow">PBL 1 facilitator</p>
		<h1>Team {room?.teamName ?? code}</h1>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{:else if room}
			<dl>
				<div>
					<dt>Room code</dt>
					<dd>{room.code}</dd>
				</div>
				<div>
					<dt>Current step</dt>
					<dd>
						{room.currentStep}. {getScienceStep(room.currentStep)?.title ?? ''}
					</dd>
				</div>
				<div>
					<dt>Pace</dt>
					<dd>
						{pace?.label ?? ''}
						{#if pace?.detail}
							· {pace.detail}
						{/if}
					</dd>
				</div>
				<div>
					<dt>Time on current step</dt>
					<dd>{timeOnStepLabel(room.stepEnteredAt, now)}</dd>
				</div>
				<div>
					<dt>Last check</dt>
					<dd>
						{room.lastCheck
							? `${room.lastCheck.passed ? 'passed' : 'not yet'}: ${room.lastCheck.message}`
							: 'none yet'}
					</dd>
				</div>
				<div>
					<dt>Hints opened</dt>
					<dd>
						{Object.keys(room.openedHints ?? {}).length
							? Object.entries(room.openedHints)
									.map(([step, level]) => `step ${step} hint ${level}`)
									.join(', ')
							: 'none'}
					</dd>
				</div>
				<div>
					<dt>People</dt>
					<dd>{room.memberCount}/10</dd>
				</div>
			</dl>
		{/if}
		<a class="quiet-link" href={resolve(`/pbl/science/${code}`, {})}>Student page</a>
	</div>
</section>

<style>
	.facilitator {
		padding-block: clamp(2rem, 6vw, 4rem);
	}

	.eyebrow {
		color: var(--club-blue);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	h1 {
		max-width: 16ch;
		margin-block: 0.75rem 1.5rem;
	}

	dl {
		display: grid;
		max-width: 40rem;
		margin: 0 0 1.5rem;
		border-block: var(--rule-strong);
	}

	dl div {
		display: grid;
		padding-block: 0.9rem;
		border-block-end: var(--rule);
		gap: 0.25rem;
	}

	dt {
		color: var(--quiet-steel);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	dd {
		margin: 0;
		font-size: 1rem;
	}

	.error {
		color: var(--danger);
		font-weight: 650;
	}
</style>
