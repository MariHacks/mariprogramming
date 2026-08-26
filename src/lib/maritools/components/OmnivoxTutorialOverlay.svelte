<script>
	import { OMNIVOX_TUTORIAL_STEPS } from '$lib/maritools/tutorial-steps.js';

	export let open = false;

	/** @type {() => void} */
	export let onFinish = () => {};
	/** @type {() => void} */
	export let onSkip = () => {};

	let stepIndex = 0;

	$: step = OMNIVOX_TUTORIAL_STEPS[stepIndex];

	function next() {
		if (stepIndex >= OMNIVOX_TUTORIAL_STEPS.length - 1) {
			onFinish();
			return;
		}
		stepIndex += 1;
	}

	function back() {
		if (stepIndex > 0) stepIndex -= 1;
	}
</script>

{#if open}
	<div class="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
		<div class="tutorial-shell">
			<aside class="tutorial-rail">
				<p>Omnivox import</p>
				<ol>
					{#each OMNIVOX_TUTORIAL_STEPS as item, index (item.n)}
						<li><button type="button" class:is-current={index === stepIndex} on:click={() => (stepIndex = index)}>{item.title}</button></li>
					{/each}
				</ol>
			</aside>
			<section class="tutorial-stage">
				<button class="tutorial-close" type="button" aria-label="Close tutorial" on:click={onSkip}>×</button>
				<div class="tutorial-copy">
					<span>Step {step.n} of {OMNIVOX_TUTORIAL_STEPS.length}</span>
					<h1 id="tutorial-title">{step.title}</h1>
					<p>{step.body}</p>
				</div>
				<div class="tutorial-frame" aria-hidden="true">
					<img src={`/maritools/omnivox/step-${String(step.n).padStart(2, '0')}.webp`} alt="" />
					<div class="tutorial-fallback"><strong>{step.title}</strong></div>
				</div>
				<footer>
					<button class="quiet" type="button" disabled={stepIndex === 0} on:click={back}>Back</button>
					<button class="text" type="button" on:click={onSkip}>Skip tutorial</button>
					<button class="primary" type="button" on:click={next}>
						{stepIndex === OMNIVOX_TUTORIAL_STEPS.length - 1 ? 'Done' : 'Next'}
					</button>
				</footer>
			</section>
		</div>
	</div>
{/if}

<style>
	.tutorial-overlay {
		position: fixed;
		z-index: 200;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgb(var(--midnight-rgb) / 48%);
	}

	.tutorial-shell {
		display: grid;
		width: min(100%, 56rem);
		max-height: calc(100vh - 2rem);
		grid-template-columns: 12rem minmax(0, 1fr);
		overflow: hidden;
		border: 1px solid rgb(var(--midnight-rgb) / 16%);
		background: #fff;
	}

	.tutorial-rail {
		padding: 1rem;
		border-right: 1px solid rgb(var(--midnight-rgb) / 12%);
		background: #f7f9fc;
		overflow: auto;
	}

	.tutorial-rail p {
		margin: 0 0 0.75rem;
		color: var(--quiet-steel);
		font-size: 0.625rem;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.tutorial-rail ol {
		display: grid;
		gap: 0.35rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.tutorial-rail button {
		width: 100%;
		padding: 0.45rem 0.55rem;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
		text-align: left;
		cursor: pointer;
	}

	.tutorial-rail button.is-current {
		background: #fff;
		font-weight: 650;
	}

	.tutorial-stage {
		display: grid;
		align-content: start;
		padding: 1.25rem 1.5rem 1.5rem;
		gap: 1rem;
		overflow: auto;
	}

	.tutorial-close {
		justify-self: end;
		border: 0;
		background: transparent;
		font-size: 1.25rem;
		cursor: pointer;
	}

	.tutorial-copy span {
		color: var(--quiet-steel);
		font-size: 0.75rem;
		font-weight: 650;
	}

	.tutorial-copy h1 {
		margin: 0.35rem 0;
		font-family: var(--font-display);
		font-size: 1.75rem;
	}

	.tutorial-frame {
		position: relative;
		min-height: 14rem;
		border: 1px solid rgb(var(--midnight-rgb) / 12%);
		background: #eef2f6;
	}

	.tutorial-frame img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.tutorial-fallback {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		text-align: center;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.primary,
	.quiet,
	.text {
		min-height: var(--control-height);
		padding-inline: 1rem;
		border-radius: var(--radius-xs);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
	}

	.primary {
		margin-left: auto;
		border: 0;
		background: var(--club-blue);
		color: #fff;
	}

	.quiet,
	.text {
		border: 0;
		background: transparent;
		color: inherit;
	}

	@media (max-width: 48rem) {
		.tutorial-shell {
			grid-template-columns: 1fr;
		}
	}
</style>
