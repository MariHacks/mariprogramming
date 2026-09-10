<script>
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { clubContent } from '$lib/content/club';
	import PythonEditor from '$lib/pbl/PythonEditor.svelte';
	import {
		monokaiPalette,
		readStoredEditorTheme,
		storeEditorTheme
	} from '$lib/pbl/python-editor.js';
	import { createWorkshopController } from '$lib/pbl/workshop-controller.js';

	const LESSON_WIDTH_KEY = 'pbl-studio-lesson-width';
	const CONSOLE_HEIGHT_KEY = 'pbl-studio-console-height';
	const LESSON_MIN = 240;
	const LESSON_MAX = 560;
	const CONSOLE_MIN = 140;
	const CONSOLE_MAX = 480;

	$: code = $page.params.code;
	$: sharePath = `/pbl/science/${code}`;

	/** @type {any} */
	let state = null;
	/** @type {ReturnType<typeof createWorkshopController> | null} */
	let controller = null;
	let copied = false;
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let copyReset;
	/** @type {'lesson' | 'code' | 'output'} */
	let pane = 'lesson';
	/** @type {'testcase' | 'output'} */
	let consoleTab = 'output';
	let lessonWidth = 320;
	let consoleHeight = 220;
	/** @type {'dark' | 'light'} */
	let editorTheme = typeof window !== 'undefined' ? readStoredEditorTheme() : 'dark';

	$: editorPalette = monokaiPalette(editorTheme);

	$: canGoNext =
		!!state &&
		state.blocked !== 'full' &&
		state.currentStep < state.steps.length - 1 &&
		(state.unlockedStep > state.currentStep ||
			(state.lastCheck?.passed === true && state.lastCheck.step === state.currentStep));
	$: showFinished =
		!!state &&
		state.currentStep >= state.steps.length - 1 &&
		state.lastCheck?.passed === true &&
		state.lastCheck.step === state.currentStep;

	onMount(() => {
		try {
			const storedLesson = Number(sessionStorage.getItem(LESSON_WIDTH_KEY));
			if (Number.isFinite(storedLesson)) {
				lessonWidth = Math.min(LESSON_MAX, Math.max(LESSON_MIN, storedLesson));
			}
			const storedConsole = Number(sessionStorage.getItem(CONSOLE_HEIGHT_KEY));
			if (Number.isFinite(storedConsole)) {
				consoleHeight = Math.min(CONSOLE_MAX, Math.max(CONSOLE_MIN, storedConsole));
			}
		} catch {
			/* sessionStorage may be unavailable */
		}

		editorTheme = readStoredEditorTheme();

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
		if (copyReset !== undefined) clearTimeout(copyReset);
		controller?.destroy();
	});

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
			copied = true;
			if (copyReset !== undefined) clearTimeout(copyReset);
			copyReset = setTimeout(() => {
				copied = false;
				copyReset = undefined;
			}, 1500);
		} catch {
			copied = false;
		}
	}

	function runProgram() {
		consoleTab = 'output';
		pane = 'output';
		void controller?.run();
	}

	function goNext() {
		if (!state || !canGoNext) return;
		controller?.selectStep(state.currentStep + 1);
	}

	function toggleEditorTheme() {
		const next = editorTheme === 'light' ? 'dark' : 'light';
		editorTheme = next;
		storeEditorTheme(next);
	}

	/** @param {PointerEvent} event */
	function startLessonResize(event) {
		if (event.button !== 0) return;
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = lessonWidth;
		/** @param {PointerEvent} move */
		function onMove(move) {
			lessonWidth = Math.min(
				LESSON_MAX,
				Math.max(LESSON_MIN, startWidth + (move.clientX - startX))
			);
		}
		function onUp() {
			try {
				sessionStorage.setItem(LESSON_WIDTH_KEY, String(Math.round(lessonWidth)));
			} catch {
				/* ignore */
			}
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		}
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	/** @param {PointerEvent} event */
	function startConsoleResize(event) {
		if (event.button !== 0) return;
		event.preventDefault();
		const startY = event.clientY;
		const startHeight = consoleHeight;
		/** @param {PointerEvent} move */
		function onMove(move) {
			consoleHeight = Math.min(
				CONSOLE_MAX,
				Math.max(CONSOLE_MIN, startHeight - (move.clientY - startY))
			);
		}
		function onUp() {
			try {
				sessionStorage.setItem(CONSOLE_HEIGHT_KEY, String(Math.round(consoleHeight)));
			} catch {
				/* ignore */
			}
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		}
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}
</script>

<svelte:head>
	<title>PBL 1 studio | {clubContent.name}</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="description" content="Team Python studio for Speedrun Programming in Science." />
</svelte:head>

{#if state}
	<section
		class="studio"
		aria-label="Workshop studio"
		data-pane={pane}
		style="--lesson-width: {lessonWidth}px; --console-height: {consoleHeight}px"
	>
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
			<div class="lesson-scroll">
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
				{#if state.lastCheck && state.lastCheck.step === state.currentStep}
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
			</div>
			<div class="lesson-footer">
				<header class="team-footer" aria-label="Team">
					<p class="series-label">PBL 1</p>
					<div class="team-row">
						<p class="team-name">{state.teamName || 'Team room'}</p>
						<div class="team-chips">
							<button
								type="button"
								class="team-chip team-chip-code"
								aria-label={copied ? 'Copied share link' : `Copy share link ${state.code}`}
								on:click={copyLink}
							>
								{copied ? 'Copied' : state.code}
							</button>
							<span
								class="team-chip team-chip-count"
								aria-label={`${state.memberCount} of 10 on this team`}
							>
								<svg class="person-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
									<path
										d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.25 6.5a5.25 5.25 0 0 1 10.5 0V15h-10.5v-.5Z"
										fill="currentColor"
									/>
								</svg>
								{state.memberCount}/10
							</span>
						</div>
					</div>
				</header>
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
				{#if state.currentStep < state.steps.length - 1}
					<button
						class="button-primary next-step"
						type="button"
						disabled={!canGoNext}
						on:click={goNext}
					>
						Next
					</button>
				{:else if showFinished}
					<p class="finished" role="status">Finished</p>
				{/if}
			</div>
		</aside>

		<div
			class="split-x"
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize lesson and code"
			on:pointerdown={startLessonResize}
		></div>

		<section
			class="work"
			aria-label="Python editor"
			data-editor-theme={editorTheme}
			style="--pbl-editor-bg: {editorPalette.bg}; --pbl-editor-gutter: {editorPalette.bgGutter}; --pbl-editor-ink: {editorPalette.ink}; --pbl-editor-comment: {editorPalette.comment}; --pbl-editor-yellow: {editorPalette.yellow}; --pbl-editor-cyan: {editorPalette.cyan}; --pbl-editor-red: {editorPalette.red}; --pbl-editor-panel: {editorPalette.panel}; --pbl-editor-panel-deep: {editorPalette.panelDeep}; --pbl-editor-muted: {editorPalette.muted}; --pbl-editor-rule: {editorPalette.rule}; --pbl-editor-line: {editorPalette.line}"
		>
			<div class="toolbar">
				<div class="toolbar-actions">
					<button
						type="button"
						class="theme-toggle"
						aria-pressed={editorTheme === 'light'}
						aria-label={editorTheme === 'light' ? 'Switch to dark editor colors' : 'Switch to light editor colors'}
						on:click={toggleEditorTheme}
					>
						{editorTheme === 'light' ? 'Dark colors' : 'Light colors'}
					</button>
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
			</div>
			{#if state.blocked === 'full'}
				<p class="error" role="alert">{state.roomError || 'This team is full (10 people).'}</p>
				<p class="body">10 people already. Create or join another team.</p>
				<a class="button-primary" href={resolve('/pbl/science', {})}>Join another team</a>
			{:else}
				{#if state.roomError}
					<p class="error" role="alert">{state.roomError}</p>
				{/if}
				<div class="editor-shell">
					<PythonEditor
						source={state.source}
						yjsState={state.yjsState ?? ''}
						awarenessState={state.awarenessState ?? ''}
						editable={!state.readOnly}
						theme={editorTheme}
						onCollab={(payload) => controller?.setCollab(payload)}
					/>
				</div>
				<div
					class="split-y"
					role="separator"
					aria-orientation="horizontal"
					aria-label="Resize editor and output"
					on:pointerdown={startConsoleResize}
				></div>
				<div class="work-bottom">
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
							{#if state.nextAction}
								<span class="console-status">{state.nextAction}</span>
							{/if}
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
				</div>
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
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 1.1rem 1.25rem 1.5rem;
		border-block-end: var(--rule);
		background: #fff;
	}

	.lesson-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		display: grid;
		align-content: start;
		gap: 0.85rem;
	}

	.minutes {
		color: var(--quiet-steel);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.lesson-footer {
		flex: 0 0 auto;
		display: grid;
		gap: 0.55rem;
		margin-top: 0.75rem;
		padding-top: 0.85rem;
		border-block-start: var(--rule);
	}

	.team-footer {
		display: grid;
		gap: 0.3rem;
	}

	.series-label {
		margin: 0;
		color: var(--quiet-steel);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.team-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.55rem;
	}

	.team-name {
		margin: 0;
		min-width: 0;
		font-size: 0.95rem;
		font-weight: 650;
		line-height: 1.25;
	}

	.team-chips {
		display: flex;
		flex-shrink: 0;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: 0.35rem;
	}

	.team-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		min-height: 1.55rem;
		padding: 0.12rem 0.45rem;
		border: 1px solid rgb(var(--midnight-rgb) / 14%);
		border-radius: 0.35rem;
		background: rgb(var(--midnight-rgb) / 4%);
		color: var(--quiet-steel);
		font-size: 0.75rem;
		font-weight: 650;
		line-height: 1.2;
		white-space: nowrap;
	}

	.team-chip-code {
		font-family: var(--font-mono);
		color: var(--club-blue);
		cursor: pointer;
	}

	.team-chip-code:focus-visible {
		outline: 2px solid var(--club-blue);
		outline-offset: 2px;
	}

	.person-icon {
		width: 0.75rem;
		height: 0.75rem;
		flex-shrink: 0;
	}

	.next-step {
		width: 100%;
		min-height: 2.5rem;
	}

	.next-step:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.finished {
		margin: 0;
		padding: 0.55rem 0.75rem;
		border-radius: 0.35rem;
		background: #ecf8ef;
		color: #157347;
		font-size: 0.875rem;
		font-weight: 700;
		text-align: center;
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
		border-radius: 0.35rem;
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

	.body,
	.stretch {
		max-width: 42rem;
		font-size: 0.9375rem;
		line-height: 1.55;
		white-space: pre-line;
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

	.pane-switch {
		display: none;
	}

	.split-x,
	.split-y {
		display: none;
		touch-action: none;
		user-select: none;
	}

	.work {
		display: flex;
		flex-direction: column;
		background: var(--pbl-editor-bg, #2d2a2e);
		color: var(--pbl-editor-ink, #fcfcfa);
	}

	.toolbar {
		display: flex;
		flex: 0 0 auto;
		flex-wrap: wrap;
		align-items: center;
		align-self: stretch;
		justify-content: flex-end;
		height: auto;
		padding: 0.45rem 0.85rem;
		gap: 0.65rem;
		background: var(--pbl-editor-panel, #221f22);
		border-block-end: 1px solid var(--pbl-editor-rule, #3e3b3f);
		font-size: 0.8125rem;
	}

	.toolbar-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem 0.65rem;
	}

	.toolbar button:not(.run) {
		flex: 0 0 auto;
		align-self: center;
		height: auto;
		min-height: 2.15rem;
		border: 0;
		background: transparent;
		font-weight: 650;
		cursor: pointer;
	}

	.theme-toggle {
		margin-inline-start: 0 !important;
		padding: 0.35rem 0.7rem;
		border-radius: 0.35rem;
		border: 1px solid var(--pbl-editor-rule, #3e3b3f) !important;
		background: var(--pbl-editor-line, #3e3b3f) !important;
		color: var(--pbl-editor-ink, #fcfcfa) !important;
		font-weight: 650;
	}

	.run {
		flex: 0 0 auto;
		align-self: center;
		height: auto;
		min-height: 2.15rem;
		padding: 0.35rem 0.7rem;
		border-radius: 0.35rem;
	}

	.editor-shell {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-width: 0;
		min-height: 14rem;
		overflow: hidden;
		/* Isolate from sibling .error margins — CM gutters must not shift. */
		background: var(--pbl-editor-bg, #2d2a2e);
	}

	.work-bottom {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.stdin-label {
		display: grid;
		padding: 0.65rem 0.85rem 0;
		gap: 0.35rem;
		color: var(--pbl-editor-muted, #c8c4c6);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.stdin,
	.output,
	.files pre {
		border-color: var(--pbl-editor-rule, #3e3b3f);
		background: var(--pbl-editor-panel, #221f22);
		color: var(--pbl-editor-ink, #fcfcfa);
	}

	.stdin {
		min-height: 4.2rem;
		resize: vertical;
	}

	.console {
		display: flex;
		flex-direction: column;
		align-content: flex-start;
		min-height: 0;
		border-block-start: 1px solid var(--pbl-editor-rule, #3e3b3f);
		background: var(--pbl-editor-panel, #221f22);
	}

	.console-tabs {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		align-self: stretch;
		width: 100%;
		gap: 0.35rem;
		padding: 0.28rem 0.55rem;
		height: auto;
		border-block-end: 1px solid var(--pbl-editor-rule, #3e3b3f);
		background: var(--pbl-editor-panel-deep, #1e1b1e);
	}

	.console-status {
		margin: 0;
		margin-left: auto;
		color: var(--pbl-editor-muted, #8b8789);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.35;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: min(28rem, 55%);
	}

	.console-tabs button {
		flex: 0 0 auto;
		align-self: center;
		height: auto;
		min-height: 0;
		padding: 0.18rem 0.55rem;
		border: 0;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--pbl-editor-muted, #8b8789);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.35;
		cursor: pointer;
	}

	.console-tabs button[aria-selected='true'] {
		background: var(--pbl-editor-bg, #2d2a2e);
		color: var(--pbl-editor-ink, #fcfcfa);
	}

	.output {
		flex: 1 1 auto;
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
		color: var(--pbl-editor-muted, #c8c4c6);
	}

	/* Room/sync errors sit above .editor-shell (never inside CM scroller). */
	.error {
		flex: 0 0 auto;
		margin: 0.5rem 1rem;
		color: var(--pbl-editor-red, #ff6188);
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

	.console[data-tab='testcase'] .output {
		display: none;
	}

	.console[data-tab='output'] .stdin-label {
		display: none;
	}

	@media (max-width: 63.99rem) {
		.studio {
			grid-template-rows: auto minmax(0, 1fr);
			height: calc(100svh - 4.5rem);
			min-height: calc(100svh - 4.5rem);
			overflow: hidden;
		}

		.pane-switch {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			align-self: stretch;
			grid-column: 1 / -1;
			gap: 0.25rem;
			height: auto;
			padding: 0.35rem 0.55rem;
			background: #fff;
			border-block-end: var(--rule);
		}

		.pane-switch button {
			flex: 0 0 auto;
			align-self: center;
			height: auto;
			min-height: 0;
			padding: 0.35rem 0.75rem;
			border: 0;
			border-radius: 0.35rem;
			background: transparent;
			color: var(--quiet-steel);
			font-size: 0.875rem;
			font-weight: 500;
			line-height: 1.35;
			cursor: pointer;
		}

		.pane-switch button.current {
			background: rgb(var(--club-blue-rgb) / 10%);
			color: var(--club-blue);
			font-weight: 700;
		}

		.lesson,
		.work {
			overflow: hidden;
		}

		.studio[data-pane='lesson'] .work {
			display: none;
		}

		.studio[data-pane='code'] .lesson,
		.studio[data-pane='code'] .work-bottom {
			display: none;
		}

		.studio[data-pane='output'] .lesson,
		.studio[data-pane='output'] .editor-shell {
			display: none;
		}

		.studio[data-pane='output'] .toolbar {
			flex: 0 0 auto;
		}

		.studio[data-pane='output'] .work-bottom,
		.studio[data-pane='output'] .console {
			flex: 1 1 auto;
			min-height: 0;
		}

		.studio[data-pane='output'] .work-bottom {
			overflow: auto;
		}

		.studio[data-pane='output'] .output {
			min-height: 12rem;
		}

		.editor-shell {
			min-height: 0;
		}
	}

	@media (min-width: 64rem) {
		.studio {
			grid-template-columns: var(--lesson-width, 20rem) 1px minmax(0, 1fr);
		}

		.lesson {
			border-block-end: 0;
			border-inline-end: 0;
			overflow: hidden;
		}

		.split-x,
		.split-y {
			position: relative;
			z-index: 2;
		}

		/* Expand hit target without reserving gutter layout space. */
		.split-x::before,
		.split-y::before {
			content: '';
			position: absolute;
		}

		.split-x {
			display: block;
			cursor: col-resize;
			background: #d7d9de;
		}

		.split-x::before {
			inset: 0 -5px;
		}

		.split-x:hover,
		.split-x:active {
			background: rgb(var(--club-blue-rgb) / 55%);
		}

		.work {
			overflow: hidden;
		}

		.split-y {
			display: block;
			flex: 0 0 1px;
			height: 1px;
			cursor: row-resize;
			background: var(--pbl-editor-rule, #3e3b3f);
		}

		.split-y::before {
			inset: -5px 0;
		}

		.split-y:hover,
		.split-y:active {
			background: #78dce8;
		}

		.work-bottom {
			flex: 0 0 var(--console-height, 14rem);
			max-height: var(--console-height, 14rem);
			overflow: auto;
		}

		.console {
			flex: 1 1 auto;
			min-height: 0;
		}

	}
</style>
