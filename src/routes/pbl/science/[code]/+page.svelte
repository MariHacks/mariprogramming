<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { clubContent } from '$lib/content/club';
	import { createWorkshopController } from '$lib/pbl/workshop-controller.js';

	$: code = $page.params.code;
	$: sharePath = `/pbl/science/${code}`;
	$: facilitatorPath = `/pbl/science/${code}/facilitator`;

	/** @type {any} */
	let state = null;
	/** @type {ReturnType<typeof createWorkshopController> | null} */
	let controller = null;
	let copied = false;
	/** @type {'lesson' | 'code' | 'output'} */
	let pane = 'lesson';

	onMount(() => {
		controller = createWorkshopController({ code });
		const stop = controller.subscribe((next) => {
			state = next;
		});
		void controller.join();
		return () => {
			stop();
		};
	});

	onDestroy(() => {
		controller?.destroy();
	});

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head>
	<title>PBL 1 studio | {clubContent.name}</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="description" content="Team Python studio for Speedrun Programming in Science." />
</svelte:head>

{#if state}
	<section class="studio" aria-label="Workshop studio" data-pane={pane}>
		<nav class="pane-switch" aria-label="Studio sections">
			<button type="button" class:current={pane === 'lesson'} on:click={() => (pane = 'lesson')}>
				Lesson
			</button>
			<button type="button" class:current={pane === 'code'} on:click={() => (pane = 'code')}>
				Code
			</button>
			<button type="button" class:current={pane === 'output'} on:click={() => (pane = 'output')}>
				Output
			</button>
		</nav>
		<aside class="lesson">
			<header class="lesson-head">
				<p class="eyebrow">PBL 1 · {state.teamName || 'Team room'} · {state.code}</p>
				<ol class="steps">
					{#each state.steps as step (step.id)}
						<li>
							<button
								type="button"
								class:current={step.id === state.currentStep}
								disabled={state.blocked === 'full' || step.id > state.unlockedStep}
								on:click={() => controller?.selectStep(step.id)}
							>
								{step.id}
							</button>
						</li>
					{/each}
				</ol>
				<h1>{state.step.title}</h1>
				<p class="minutes">about {state.step.minutes} min</p>
			</header>
			<p class="body">{state.step.body}</p>
			{#if state.step.notes}
				<ul class="notes">
					{#each state.step.notes as note (note)}
						<li>{note}</li>
					{/each}
				</ul>
			{/if}
			<div class="hints">
				<p>Hints</p>
				{#each [1, 2, 3] as level (level)}
					<button
						type="button"
						disabled={state.blocked === 'full' ||
							level > (state.openedHints?.[String(state.currentStep)] ?? 0) + 1}
						on:click={() => controller?.openHint(level)}
					>
						{level === 1 ? 'Idea' : level === 2 ? 'Syntax' : 'Partial code'}
					</button>
				{/each}
				{#if (state.openedHints?.[String(state.currentStep)] ?? 0) >= 1}
					<pre class="hint">{state.step.hints[0]}</pre>
				{/if}
				{#if (state.openedHints?.[String(state.currentStep)] ?? 0) >= 2}
					<pre class="hint">{state.step.hints[1]}</pre>
				{/if}
				{#if (state.openedHints?.[String(state.currentStep)] ?? 0) >= 3}
					<pre class="hint">{state.step.hints[2]}</pre>
				{/if}
			</div>
			{#if state.lastCheck}
				<p
					class="check"
					class:pass={state.lastCheck.passed}
					class:fail={!state.lastCheck.passed}
					role="status"
				>
					{state.lastCheck.message}
				</p>
			{/if}
			{#if state.step.stretch && state.currentStep === 11}
				<p class="stretch">{state.step.stretch}</p>
			{/if}
			<a class="quiet-link" href={resolve(facilitatorPath, {})}>Facilitator view</a>
		</aside>

		<section class="work" aria-label="Python editor">
			<div class="toolbar">
				<p>
					Share <code>{state.code}</code>
					<button type="button" on:click={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
				</p>
				<p>{state.memberCount}/10 on this team</p>
			</div>
			{#if state.blocked === 'full'}
				<p class="error" role="alert">{state.roomError || 'This team is full (10 people).'}</p>
				<p class="body">10 people already. Create or join another team.</p>
				<a class="button-primary" href={resolve('/pbl/science', {})}>Join another team</a>
			{:else}
				{#if state.roomError}
					<p class="error" role="alert">{state.roomError}</p>
				{/if}
				<p class="drive">
					{#if state.isDriver}
						You type. Teammates see this.
					{:else}
						Watching. Teammate is typing.
						<button type="button" on:click={() => controller?.takeDriver()}>Take keyboard</button>
					{/if}
				</p>
				<label class="editor-label">
					Python
					<textarea
						spellcheck="false"
						value={state.source}
						readonly={state.readOnly || !state.isDriver}
						on:input={(event) => controller?.setSource(event.currentTarget.value)}
					></textarea>
				</label>
				<label class="stdin-label">
					Program input, one line per input()
					<textarea
						class="stdin"
						value={state.stdinText}
						on:input={(event) => controller?.setStdin(event.currentTarget.value)}
					></textarea>
				</label>
				<p class="next-action">{state.nextAction}</p>
				<div class="run-row">
					<button
						class="button-primary"
						type="button"
						disabled={state.running}
						on:click={() => controller?.run()}
					>
						{state.running ? 'Running' : 'Run'}
					</button>
					{#if state.pythonError}
						<p class="error" role="status">{state.pythonError}</p>
					{/if}
				</div>
				<pre class="output" aria-label="Program output">{state.output ||
						'Output appears here.'}</pre>
				{#if Object.keys(state.files).length}
					<section class="files" aria-label="Generated files">
						<h2>Generated files</h2>
						{#each Object.entries(state.files) as [name, contents] (name)}
							<article>
								<h3>{name}</h3>
								<pre>{contents}</pre>
							</article>
						{/each}
					</section>
				{/if}
			{/if}
		</section>
	</section>
{:else}
	<p class="loading">Loading the team room.</p>
{/if}

<style>
	.studio {
		display: grid;
		min-height: calc(100svh - 4.5rem);
		background: #fff;
	}

	.lesson,
	.work {
		min-width: 0;
		padding: 1.25rem clamp(1rem, 3vw, 1.75rem);
	}

	.lesson {
		display: grid;
		align-content: start;
		border-block-end: var(--rule);
		gap: 1rem;
	}

	.eyebrow,
	.minutes {
		color: var(--quiet-steel);
		font-size: 0.75rem;
		font-weight: 650;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.steps {
		display: flex;
		flex-wrap: wrap;
		margin: 0.75rem 0 0;
		padding: 0;
		gap: 0.35rem;
		list-style: none;
	}

	.steps button {
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid rgb(var(--midnight-rgb) / 22%);
		background: #fff;
		color: inherit;
		cursor: pointer;
	}

	.steps button.current,
	.steps button:not(:disabled):hover {
		border-color: var(--club-blue);
		color: var(--club-blue);
	}

	.lesson h1 {
		max-width: 16ch;
		font-size: clamp(1.75rem, 4vw, 2.4rem);
	}

	.body,
	.stretch {
		max-width: 42rem;
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.notes {
		margin: 0;
		padding-inline-start: 1.1rem;
		color: var(--quiet-steel);
		font-size: 0.875rem;
	}

	.hints {
		display: grid;
		gap: 0.45rem;
	}

	.hints p,
	.files h2,
	.files h3 {
		font-family: var(--font-body);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.hints button {
		min-height: 2.75rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid rgb(var(--midnight-rgb) / 22%);
		background: #fff;
		text-align: left;
		cursor: pointer;
	}

	.hint,
	.output,
	.files pre,
	textarea {
		width: 100%;
		margin: 0;
		padding: 0.75rem;
		border: 1px solid rgb(var(--midnight-rgb) / 18%);
		background: var(--mist);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.45;
		white-space: pre-wrap;
	}

	.check {
		font-size: 0.875rem;
		font-weight: 650;
	}

	.check.pass {
		color: var(--club-blue);
	}

	.check.fail,
	.next-action {
		font-size: 0.875rem;
		font-weight: 650;
	}

	.check.fail {
		color: var(--danger);
	}

	.next-action {
		margin: 0.85rem 0 0;
	}

	.drive {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		margin: 0.75rem 0 0;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 650;
	}

	.drive button {
		min-height: 2.75rem;
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--club-blue);
		background: #fff;
		color: var(--club-blue);
		font-weight: 650;
		cursor: pointer;
	}

	.pane-switch {
		display: none;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.8125rem;
	}

	.toolbar button {
		min-height: 2.75rem;
		margin-inline-start: 0.5rem;
		border: 0;
		background: transparent;
		color: var(--club-blue);
		font-weight: 650;
		cursor: pointer;
	}

	.editor-label,
	.stdin-label {
		display: grid;
		margin-block-start: 0.85rem;
		gap: 0.35rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	textarea {
		min-height: 18rem;
		background: #fff;
		resize: vertical;
	}

	.stdin {
		min-height: 4.5rem;
	}

	.run-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		margin-block: 0.85rem;
		gap: 0.75rem;
	}

	.output {
		min-height: 8rem;
		background: #061431;
		color: #f8fafc;
	}

	.error {
		color: var(--danger);
		font-size: 0.875rem;
		font-weight: 650;
	}

	.loading {
		padding: 2rem;
	}

	@media (max-width: 63.99rem) {
		.pane-switch {
			display: flex;
			flex-wrap: wrap;
			grid-column: 1 / -1;
			border-block-end: var(--rule);
		}

		.pane-switch button {
			flex: 1;
			min-height: 2.75rem;
			border: 0;
			background: #fff;
			cursor: pointer;
		}

		.pane-switch button.current {
			color: var(--club-blue);
			font-weight: 700;
		}

		.studio[data-pane='lesson'] .work {
			display: none;
		}

		.studio[data-pane='code'] .lesson,
		.studio[data-pane='code'] .output,
		.studio[data-pane='code'] .files {
			display: none;
		}

		.studio[data-pane='output'] .lesson,
		.studio[data-pane='output'] .editor-label,
		.studio[data-pane='output'] .stdin-label {
			display: none;
		}

		textarea {
			min-height: 10rem;
		}
	}

	@media (min-width: 64rem) {
		.studio {
			grid-template-columns: minmax(18rem, 0.42fr) minmax(0, 1.58fr);
		}

		.lesson {
			border-block-end: 0;
			border-inline-end: var(--rule);
		}
	}
</style>
