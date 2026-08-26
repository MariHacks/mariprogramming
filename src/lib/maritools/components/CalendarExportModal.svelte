<script>
	export let open = false;
	export let exportError = '';
	export let signedIn = false;
	export let googleCalendarConnected = false;
	export let connectHref = '/tools/schedule/google-calendar/connect';
	export let pushTermId = '';

	/** @type {() => void} */
	export let onDownloadGoogle = () => {};
	/** @type {() => void} */
	export let onDownloadApple = () => {};
	/** @type {() => void} */
	export let onClose = () => {};
</script>

{#if open}
	<div class="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-export-title">
		<div class="calendar-modal-card">
			<button class="modal-close" type="button" aria-label="Close export dialog" on:click={onClose}
				>×</button
			>
			<h2 id="calendar-export-title">Add to Google Calendar</h2>
			{#if signedIn && googleCalendarConnected}
				<p>Push this semester straight into your Google Calendar, or download an .ics file instead.</p>
				<div class="export-actions">
					<slot name="push-form" />
					<button type="button" class="quiet" on:click={onDownloadApple}
						>Download .ics for Apple / Outlook</button
					>
				</div>
			{:else if signedIn}
				<p>
					Connect Google Calendar once, then MariTools can add your classes directly. You can still
					download an .ics file without connecting.
				</p>
				<div class="export-actions">
					<a class="primary link-button" href={connectHref}>Connect Google Calendar</a>
					<button type="button" class="quiet" on:click={onDownloadGoogle}
						>Download for Google Calendar</button
					>
					<button type="button" class="quiet" on:click={onDownloadApple}
						>Download .ics for Apple / Outlook</button
					>
				</div>
			{:else}
				<p>
					Sign in to push events directly to Google Calendar. Without an account, download an
					<strong>.ics</strong> file and import it manually.
				</p>
				<div class="export-actions">
					<a class="primary link-button" href="/tools/account">Sign in to push to Google Calendar</a>
					<button type="button" class="quiet" on:click={onDownloadGoogle}
						>Download for Google Calendar</button
					>
					<button type="button" class="quiet" on:click={onDownloadApple}
						>Download .ics for Apple / Outlook</button
					>
				</div>
			{/if}
			{#if exportError}
				<p class="error" role="alert">{exportError}</p>
			{/if}
			{#if signedIn && googleCalendarConnected && !pushTermId}
				<p class="hint">Choose a term in the sidebar before pushing.</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.calendar-modal {
		position: fixed;
		z-index: 180;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgb(var(--midnight-rgb) / 42%);
	}

	.calendar-modal-card {
		position: relative;
		width: min(100%, 28rem);
		padding: 1.5rem;
		border: 1px solid rgb(var(--midnight-rgb) / 16%);
		background: #fff;
	}

	.modal-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		border: 0;
		background: transparent;
		color: inherit;
		font-size: 1.25rem;
		cursor: pointer;
	}

	h2 {
		margin: 0 0 0.75rem;
		font-family: var(--font-display);
		font-size: 1.35rem;
	}

	p {
		margin: 0 0 1rem;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.export-actions {
		display: grid;
		gap: 0.65rem;
	}

	.export-actions :global(.primary),
	.primary,
	.quiet,
	.link-button {
		min-height: var(--control-height);
		padding-inline: 1rem;
		border-radius: var(--radius-xs);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
		text-align: center;
		text-decoration: none;
	}

	.primary,
	.link-button.primary {
		display: inline-grid;
		place-items: center;
		border: 0;
		background: var(--club-blue);
		color: #fff;
	}

	.quiet {
		border: var(--rule);
		background: #fff;
		color: inherit;
	}

	.error {
		margin-top: 0.75rem;
		color: var(--danger);
		font-size: var(--text-sm);
	}

	.hint {
		margin-top: 0.75rem;
		margin-bottom: 0;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
	}
</style>
