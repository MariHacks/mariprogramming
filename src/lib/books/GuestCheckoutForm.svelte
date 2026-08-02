<script>
	import { createEventDispatcher, tick } from 'svelte';

	/** @type {boolean} */
	export let submitting = false;

	/** @type {string} */
	export let errorMessage = '';

	const dispatch = createEventDispatcher();

	let name = '';
	let email = '';
	let nameError = '';
	let emailError = '';
	/** @type {HTMLInputElement} */
	let nameInput;
	/** @type {HTMLInputElement} */
	let emailInput;
	let handoffPending = false;

	$: isSubmitting = Boolean(submitting);
	$: parentError = typeof errorMessage === 'string' ? errorMessage.trim() : '';
	$: if (isSubmitting || parentError) handoffPending = false;
	$: isBusy = isSubmitting || handoffPending;
	$: hasValidationError = Boolean(nameError || emailError);

	/** @param {string} value */
	function normalizeName(value) {
		return value.trim().replace(/\s+/g, ' ');
	}

	/** @param {string} value */
	function normalizeEmail(value) {
		return value.trim().toLowerCase();
	}

	/** @param {string} value */
	function isLikelyEmail(value) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
	}

	function clearNameError() {
		nameError = '';
	}

	function clearEmailError() {
		emailError = '';
	}

	/** @param {SubmitEvent} event */
	async function submitGuestDetails(event) {
		event.preventDefault();

		if (isBusy) return;

		const normalizedName = normalizeName(name);
		const normalizedEmail = normalizeEmail(email);

		nameError = normalizedName ? '' : 'Enter the name for pickup.';
		emailError = !normalizedEmail
			? 'Enter an email for your receipt.'
			: isLikelyEmail(normalizedEmail)
				? ''
				: 'Enter an email in the usual name@example.com format.';

		if (nameError || emailError) {
			await tick();
			(nameError ? nameInput : emailInput)?.focus();
			return;
		}

		handoffPending = true;
		dispatch('submit', { name: normalizedName, email: normalizedEmail });
	}
</script>

<form
	class="guest-checkout-form"
	aria-labelledby="guest-details-title"
	aria-busy={isBusy ? 'true' : undefined}
	novalidate
	on:submit={submitGuestDetails}
>
	<header class="form-header">
		<p class="utility-label">Guest checkout</p>
		<h2 id="guest-details-title">Guest details</h2>
		<p class="form-intro">Use the pickup name and receipt email you want attached to this order.</p>
	</header>

	{#if parentError}
		<p class="form-feedback form-feedback--parent" role="status" aria-live="polite">
			{parentError}
		</p>
	{/if}

	{#if hasValidationError}
		<div class="form-feedback" role="status" aria-live="polite">
			{#if nameError}
				<span id="pickup-name-error">{nameError}</span>
			{/if}
			{#if emailError}
				<span id="receipt-email-error">{emailError}</span>
			{/if}
		</div>
	{/if}

	<div class="form-fields">
		<div class="field">
			<label for="pickup-name">Name for pickup</label>
			<input
				id="pickup-name"
				bind:this={nameInput}
				bind:value={name}
				type="text"
				name="name"
				autocomplete="name"
				required
				disabled={isBusy}
				aria-invalid={nameError ? 'true' : undefined}
				aria-describedby={nameError ? 'pickup-name-error' : undefined}
				on:input={clearNameError}
			/>
		</div>

		<div class="field">
			<label for="receipt-email">Email for receipt</label>
			<input
				id="receipt-email"
				bind:this={emailInput}
				bind:value={email}
				type="email"
				name="email"
				autocomplete="email"
				inputmode="email"
				spellcheck="false"
				required
				disabled={isBusy}
				aria-invalid={emailError ? 'true' : undefined}
				aria-describedby={emailError ? 'receipt-email-error' : undefined}
				on:input={clearEmailError}
			/>
		</div>
	</div>

	<p class="secure-handoff">
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<path d="M4.5 7V5.25a3.5 3.5 0 0 1 7 0V7M3.5 7h9v6h-9zM8 9.5v1" />
		</svg>
		<span>Payment details are entered on the next secure page.</span>
	</p>

	<button class="submit-button" type="submit" disabled={isBusy}>
		{#if isBusy}
			<span>Preparing secure payment</span>
		{:else}
			<span>Continue to secure payment</span>
		{/if}
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<path d="M3 8h9M8.5 3.5 13 8l-4.5 4.5" />
		</svg>
	</button>
</form>

<style>
	.guest-checkout-form {
		display: grid;
		min-width: 0;
		padding: clamp(1.25rem, 4vw, 2rem);
		border: 1px solid rgb(5 13 46 / 24%);
		border-block-start: 0.375rem solid var(--sky);
		border-radius: var(--radius-md);
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		color: var(--graphite);
		gap: var(--space-md);
	}

	.form-header,
	.form-fields,
	.field {
		display: grid;
		min-width: 0;
	}

	.form-header {
		gap: var(--space-2xs);
	}

	h2,
	p,
	span {
		margin: 0;
	}

	h2 {
		color: var(--midnight);
		font-size: var(--text-xl);
	}

	.form-intro {
		color: rgb(24 27 37 / 76%);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.form-fields {
		gap: var(--space-sm);
	}

	.field {
		gap: 0.4rem;
	}

	label {
		color: var(--midnight);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.06em;
		line-height: 1.35;
		text-transform: uppercase;
	}

	input {
		inline-size: 100%;
		min-block-size: 3rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid rgb(5 13 46 / 38%);
		border-radius: var(--radius-xs);
		background: var(--paper);
		color: var(--midnight);
		font: inherit;
		line-height: 1.35;
	}

	input[aria-invalid='true'] {
		border-color: var(--coral);
		background: rgb(223 91 72 / 7%);
	}

	input:disabled {
		color: rgb(24 27 37 / 58%);
		cursor: wait;
	}

	input:focus-visible,
	.submit-button:focus-visible {
		outline: 3px solid var(--coral);
		outline-offset: 3px;
		box-shadow: 0 0 0 6px var(--paper);
	}

	.form-feedback {
		display: grid;
		padding: var(--space-xs) var(--space-sm);
		border-inline-start: 0.25rem solid var(--coral);
		background: rgb(223 91 72 / 9%);
		color: var(--midnight);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.45;
		gap: 0.25rem;
	}

	.form-feedback--parent {
		border-inline-start-color: var(--club-blue);
		background: rgb(153 194 255 / 26%);
	}

	.secure-handoff {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		padding: var(--space-sm);
		border: 1px solid rgb(5 13 46 / 20%);
		border-radius: var(--radius-xs);
		background: var(--sky);
		color: var(--midnight);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.45;
		gap: var(--space-xs);
	}

	.secure-handoff svg,
	.submit-button svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.5;
	}

	.secure-handoff svg {
		margin-block-start: 0.2rem;
	}

	.submit-button {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		inline-size: 100%;
		min-block-size: 3.25rem;
		padding: 0.7rem var(--space-sm);
		border: 1px solid var(--midnight);
		border-radius: var(--radius-xs);
		background: var(--midnight);
		color: var(--paper);
		font: inherit;
		font-weight: 700;
		line-height: 1.25;
		text-align: start;
		cursor: pointer;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out);
	}

	.submit-button:disabled {
		background: var(--club-blue);
		cursor: wait;
	}

	@media (hover: hover) and (pointer: fine) {
		.submit-button:not(:disabled):hover {
			background: var(--club-blue);
		}
	}

	@media (max-width: 22rem) {
		.guest-checkout-form {
			padding: var(--space-md);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.submit-button {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.guest-checkout-form,
		input,
		.secure-handoff,
		.submit-button {
			border-color: CanvasText;
		}

		.guest-checkout-form,
		input,
		.form-feedback,
		.secure-handoff {
			background: Canvas;
			color: CanvasText;
		}

		.submit-button {
			background: ButtonFace;
			color: ButtonText;
		}
	}
</style>
