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
	<div
		class="calendar-modal"
		role="dialog"
		aria-modal="true"
		aria-labelledby="calendar-export-title"
	>
		<div class="calendar-modal-panel">
			<button class="calendar-modal-close" type="button" aria-label="Close calendar export" on:click={onClose}
				>×</button
			>
			<span>Calendar export</span>
			<h2 id="calendar-export-title">Add this week to Google Calendar</h2>
			{#if signedIn && googleCalendarConnected}
				<p>
					Push this semester into Google Calendar, or download an .ics file and import it yourself.
				</p>
				<div class="calendar-modal-actions">
					<slot name="push-form" />
					<button type="button" class="quiet-button" on:click={onDownloadApple}
						>Download .ics for Apple / Outlook</button
					>
				</div>
				{#if !pushTermId}
					<small>Choose a term before pushing.</small>
				{/if}
			{:else if signedIn}
				<p>
					Connect Google Calendar once, then MariTools can add your classes. You can still download an
					.ics file without connecting.
				</p>
				<div class="calendar-modal-actions">
					<a class="primary-button" href={connectHref}>Connect Google Calendar</a>
					<button type="button" class="quiet-button" on:click={onDownloadGoogle}
						>Download for Google Calendar</button
					>
					<button type="button" class="quiet-button" on:click={onDownloadApple}
						>Download .ics for Apple / Outlook</button
					>
				</div>
			{:else}
				<p>
					Google Calendar imports an <strong>.ics</strong> file. Download it here, then import the
					file from Google Calendar settings.
				</p>
				<div class="calendar-modal-actions">
					<button type="button" class="primary-button" on:click={onDownloadGoogle}
						>Download for Google Calendar</button
					>
					<button type="button" class="quiet-button" on:click={onDownloadApple}
						>Download .ics for Apple / Outlook</button
					>
				</div>
				<small>
					In Google Calendar, open Settings, Import & export, then choose the downloaded file.
				</small>
			{/if}
			{#if exportError}
				<p class="field-error" role="alert">{exportError}</p>
			{/if}
		</div>
	</div>
{/if}
