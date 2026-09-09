<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { clubContent } from '$lib/content/club';
	import PythonEditor from '$lib/pbl/PythonEditor.svelte';
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
	/** @type {'testcase' | 'output'} */
	let consoleTab = 'output';

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

	function runProgram() {
		consoleTab = 'output';
		void controller?.run();
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
			<div class="title-row">
				<h1>{state.step.title}</h1>
				<p class="minutes">{state.step.minutes} min</p>
			</div>
			<p class="body">{state.step.body}</p>
			{#if state.step.notes}
				<section class="examples" aria-label="Notes">
					<h2>Examples</h2>
					<ul class="notes">
						{#each state.step.notes as note (note)}
							<li>{note}</li>
						{/each}
					</ul>
				</section>
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
					<span class="verdict">{state.lastCheck.passed ? 'Accepted' : 'Wrong Answer'}</span>
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
				<div class="toolbar-meta">
					<p class="lang">Python</p>
					<p>
						Share <code>{state.code}</code>
						<button type="button" on:click={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
					</p>
					<p>{state.memberCount}/10 on this team</p>
				</div>
				{#if state.blocked !== 'full'}
					<button
						class="button-primary run"
						type="button"
						disabled={state.running}
						on:click={runProgram}
					>
						{state.running ? 'Running' : 'Run'}
					</button>
				{/if}
			</div>
			{#if state.blocked === 'full'}
				<p class="error" role="alert">{state.roomError || 'This team is full (10 people).'}</p>
				<p class="body">10 people already. Create or join another team.</p>
				<a class="button-primary" href={resolve('/pbl/science', {})}>Join another team</a>
			{:else}
				{#if state.roomError}
					<p class="error" role="alert">{state.roomError}</p>
				{/if}
				<p class="drive">Everyone can type.</p>
				<div class="editor-shell">
					<PythonEditor
						source={state.source}
						yjsState={state.yjsState ?? ''}
						awarenessState={state.awarenessState ?? ''}
						editable={!state.readOnly}
						onCollab={(payload) => controller?.setCollab(payload)}
					/>
				</div>
				<p class="next-action">{state.nextAction}</p>
				<div class="console" data-tab={consoleTab}>
					<div class="console-tabs" role="tablist" aria-label="Program console">
						<button
							type="button"
							role="tab"
							aria-selected={consoleTab === 'testcase'}
							on:click={() => (consoleTab = 'testcase')}
						>
							Testcase
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={consoleTab === 'output'}
							on:click={() => (consoleTab = 'output')}
						>
							Output
						</button>
					</div>
					<label class="stdin-label">
						Program input, one line per input()
						<textarea
							class="stdin"
							value={state.stdinText}
							on:input={(event) => controller?.setStdin(event.currentTarget.value)}
						></textarea>
					</label>
					{#if state.pythonError}
						<p class="error" role="status">{state.pythonError}</p>
					{/if}
					<pre class="output" aria-label="Program output">{state.output ||
							'Output appears here.'}</pre>
				</div>
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
		background: #f4f5f7;
	}

	.lesson,
	.work {
		min-width: 0;
		min-height: 0;
	}

	.lesson {
		display: grid;
		align-content: start;
		padding: 1.1rem 1.25rem 1.5rem;
		border-block-end: var(--rule);
		gap: 0.85rem;
		background: #fff;
	}

	.eyebrow,
	.minutes,
	.lang {
		color: var(--quiet-steel);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.steps {
		display: flex;
		flex-wrap: wrap;
		margin: 0;
		padding: 0;
		gap: 0.3rem;
		list-style: none;
	}

	.steps button {
		width: 2.15rem;
		height: 2.15rem;
		border: 1px solid rgb(var(--midnight-rgb) / 16%);
		border-radius: 999px;
		background: #fff;
		color: inherit;
		font-size: 0.8rem;
		font-weight: 650;
		cursor: pointer;
	}

	.steps button.current,
	.steps button:not(:disabled):hover {
		border-color: var(--club-blue);
		background: rgb(var(--club-blue-rgb) / 8%);
		color: var(--club-blue);
	}

	.steps button:disabled {
		opacity: 0.38;
		cursor: not-allowed;
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.65rem 1rem;
	}

	.lesson h1 {
		max-width: 18ch;
		font-size: clamp(1.45rem, 3vw, 1.85rem);
		line-height: 1.15;
	}

	.minutes {
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: #fff4d6;
		color: #8a5a00;
	}

	.body,
	.stretch {
		max-width: 42rem;
		font-size: 0.9375rem;
		line-height: 1.55;
	}

	.examples h2,
	.hints p,
	.files h2,
	.files h3 {
		margin: 0;
		font-family: var(--font-body);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.notes {
		margin: 0.4rem 0 0;
		padding-inline-start: 1.1rem;
		color: var(--quiet-steel);
		font-size: 0.875rem;
	}

	.hints {
		display: grid;
		gap: 0.4rem;
	}

	.hints button {
		min-height: 2.4rem;
		padding: 0.45rem 0.7rem;
		border: 1px solid rgb(var(--midnight-rgb) / 16%);
		border-radius: 0.35rem;
		background: #fff;
		text-align: left;
		cursor: pointer;
	}

	.hints button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.hint,
	.output,
	.files pre,
	.stdin {
		width: 100%;
		margin: 0;
		padding: 0.75rem;
		border: 1px solid rgb(var(--midnight-rgb) / 12%);
		border-radius: 0.35rem;
		background: var(--mist);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.45;
		white-space: pre-wrap;
	}

	.check {
		padding: 0.7rem 0.8rem;
		border-radius: 0.35rem;
		font-size: 0.875rem;
		font-weight: 650;
	}

	.verdict {
		display: block;
		margin-bottom: 0.15rem;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.check.pass {
		background: #ecf8ef;
		color: #157347;
	}

	.check.fail {
		background: #fdecec;
		color: var(--danger);
	}

	.next-action {
		margin: 0;
		padding: 0 1rem;
		color: var(--quiet-steel);
		font-size: 0.8125rem;
		font-weight: 650;
	}

	.drive {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		align-self: stretch;
		box-sizing: border-box;
		width: 100%;
		margin: 0;
		padding: 0.45rem 1rem;
		gap: 0.5rem;
		border-block-end: 1px solid #3e3b3f;
		background: #2d2a2e;
		color: #fcfcfa;
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: 0;
		text-transform: none;
	}



	.pane-switch {
		display: none;
	}

	.work {
		display: flex;
		flex-direction: column;
		background: #2d2a2e;
		color: #fcfcfa;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem 0.85rem;
		gap: 0.65rem;
		background: #221f22;
		border-block-end: 1px solid #3e3b3f;
		font-size: 0.8125rem;
	}

	.toolbar-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.1rem;
	}

	.lang {
		padding: 0.2rem 0.5rem;
		border-radius: 0.25rem;
		background: #3e3b3f;
		color: #ffd866;
	}

	.toolbar code {
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		background: #3e3b3f;
		color: #78dce8;
	}

	.toolbar button:not(.run) {
		min-height: 2.15rem;
		margin-inline-start: 0.35rem;
		border: 0;
		background: transparent;
		color: #78dce8;
		font-weight: 650;
		cursor: pointer;
	}

	.run {
		min-height: 2.35rem;
		padding-inline: 1.1rem;
	}

	.editor-shell {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 14rem;
		overflow: hidden;
	}

	.stdin-label {
		display: grid;
		padding: 0.65rem 0.85rem 0;
		gap: 0.35rem;
		color: #c8c4c6;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.stdin,
	.output,
	.files pre {
		border-color: #3e3b3f;
		background: #221f22;
		color: #fcfcfa;
	}

	.stdin {
		min-height: 4.2rem;
		resize: vertical;
	}

	.console {
		display: grid;
		border-block-start: 1px solid #3e3b3f;
		background: #221f22;
	}

	.console-tabs {
		display: flex;
		gap: 0.15rem;
		padding: 0.35rem 0.55rem 0;
	}

	.console-tabs button {
		min-height: 2.15rem;
		padding: 0.3rem 0.75rem;
		border: 0;
		border-radius: 0.3rem 0.3rem 0 0;
		background: transparent;
		color: #c8c4c6;
		font-weight: 650;
		cursor: pointer;
	}

	.console-tabs button[aria-selected='true'] {
		background: #2d2a2e;
		color: #fcfcfa;
	}

	.output {
		min-height: 7rem;
		border: 0;
		border-radius: 0;
		letter-spacing: 0;
		text-transform: none;
	}

	.files {
		padding: 0.75rem 1rem 1rem;
	}

	.files h2,
	.files h3 {
		color: #c8c4c6;
	}

	.error {
		margin: 0.5rem 1rem;
		color: #ff6188;
		font-size: 0.875rem;
		font-weight: 650;
	}

	.loading {
		padding: 2rem;
	}

	.work > .button-primary {
		align-self: start;
		margin: 0.75rem 1rem;
	}

	@media (max-width: 63.99rem) {
		.pane-switch {
			display: flex;
			flex-wrap: wrap;
			grid-column: 1 / -1;
			background: #fff;
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
		.studio[data-pane='code'] .console,
		.studio[data-pane='code'] .files {
			display: none;
		}

		.studio[data-pane='output'] .lesson,
		.studio[data-pane='output'] .editor-shell,
		.studio[data-pane='output'] .drive {
			display: none;
		}

		.editor-shell {
			min-height: 16rem;
		}
	}

	@media (min-width: 64rem) {
		.studio {
			grid-template-columns: minmax(18rem, 0.4fr) minmax(0, 1.6fr);
		}

		.lesson {
			border-block-end: 0;
			border-inline-end: var(--rule);
			overflow: auto;
		}

		.work {
			overflow: hidden;
		}

		.console[data-tab='testcase'] .output {
			display: none;
		}

		.console[data-tab='output'] .stdin-label {
			display: none;
		}
	}
</style>
