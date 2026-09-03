<script>
	import { OMNIVOX_TUTORIAL_STEPS } from '$lib/maritools/tutorial-steps.js';

	export let open = false;

	/** @type {() => void} */
	export let onFinish = () => {};
	/** @type {() => void} */
	export let onSkip = () => {};

	let stepIndex = 0;
	/** Hide failed screenshot so the HTML mock frame stays visible. */
	let screenshotFailed = false;

	$: step = OMNIVOX_TUTORIAL_STEPS[stepIndex];
	$: stepSrc = `/maritools/omnivox/step-${String(step.n).padStart(2, '0')}.webp`;
	$: (stepSrc, (screenshotFailed = false));

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

	/** @param {Event & { currentTarget: HTMLImageElement }} event */
	function onScreenshotError(event) {
		screenshotFailed = true;
		event.currentTarget.hidden = true;
	}
</script>

{#if open}
	<div class="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
		<div class="tutorial-shell">
			<aside class="tutorial-rail">
				<div>
					<span>MariTools guide</span>
					<h2>Import from Omnivox</h2>
					<p>
						Nine short steps. Your student number and legal name stay out of MariTools. Screens are
						redacted captures of the Omnivox path.
					</p>
				</div>
				<ol>
					{#each OMNIVOX_TUTORIAL_STEPS as item, index (item.n)}
						<li>
							<button
								type="button"
								aria-label={item.title}
								class:is-current={index === stepIndex}
								on:click={() => (stepIndex = index)}
							>
								<span>{item.n}</span><b>{item.title}</b>
							</button>
						</li>
					{/each}
				</ol>
			</aside>
			<section class="tutorial-stage">
				<button class="tutorial-close" type="button" aria-label="Close tutorial" on:click={onSkip}
					>×</button
				>
				<div class="tutorial-content">
					<div class="tutorial-copy">
						<span>Step {step.n} of {OMNIVOX_TUTORIAL_STEPS.length}</span>
						<h1 id="tutorial-title">{step.title}</h1>
						<p>{step.body}</p>
					</div>
					<div class="tutorial-frame" data-step={step.n} aria-hidden="true">
						{#if screenshotFailed}
							<div class="mock-omnivox">
								<aside>
									<b>Omnivox</b><span>Services</span><span>Course Schedule</span><span
										>Documents</span
									>
								</aside>
								<div>
									<span>Step {step.n}</span>
									<strong>{step.title}</strong>
									<small>Illustrative guide frame</small>
									<i class="mock-focus"></i>
								</div>
							</div>
						{/if}
						<div class="tutorial-screenshots">
							<img
								data-tutorial-step={step.n}
								src={stepSrc}
								alt=""
								hidden={screenshotFailed}
								on:error={onScreenshotError}
							/>
						</div>
					</div>
				</div>
				<footer>
					<button
						class="quiet-button tutorial-back"
						type="button"
						disabled={stepIndex === 0}
						on:click={back}>Back</button
					>
					<button class="text-button tutorial-skip" type="button" on:click={onSkip}
						>Skip tutorial</button
					>
					<button class="primary-button" type="button" on:click={next}>
						{stepIndex === OMNIVOX_TUTORIAL_STEPS.length - 1 ? 'Done' : 'Next'}
					</button>
				</footer>
			</section>
		</div>
	</div>
{/if}
