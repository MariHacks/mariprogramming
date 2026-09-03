<script>
	import { onDestroy, tick } from 'svelte';

	export let id = 'profile-image';
	export let name = 'profileImage';
	export let label = 'Profile picture';
	export let existingSrc = '';
	export let initials = '';
	export let variant = 'field';

	const MAX_BYTES = 512 * 1024;
	const OUTPUT_STEPS = [
		{ size: 512, quality: 0.9 },
		{ size: 448, quality: 0.82 },
		{ size: 384, quality: 0.74 },
		{ size: 320, quality: 0.66 },
		{ size: 256, quality: 0.56 },
		{ size: 192, quality: 0.46 }
	];

	/** @type {{ sourceUrl: string, naturalWidth: number, naturalHeight: number, zoom: number, x: number, y: number, fileName: string } | null} */
	let draft = null;
	/** @type {HTMLImageElement | null} */
	let loadedImage = null;
	/** @type {File | null} */
	let confirmedFile = null;
	let confirmedUrl = '';
	let error = '';
	let busy = false;
	/** @type {HTMLInputElement | undefined} */
	let sourceInput;
	/** @type {HTMLInputElement | undefined} */
	let outputInput;
	/** @type {HTMLCanvasElement | undefined} */
	let previewCanvas;
	/** @type {HTMLButtonElement | undefined} */
	let chooseButton;
	/** @type {HTMLButtonElement | undefined} */
	let useButton;
	/** @type {HTMLElement | undefined} */
	let cropDialog;
	/** @type {number | null} */
	let pointerId = null;
	let pointerX = 0;
	let pointerY = 0;
	let operationGeneration = 0;
	/** @type {HTMLElement | null} */
	let returnFocus = null;

	$: if (draft && loadedImage && previewCanvas) {
		draft.zoom;
		draft.x;
		draft.y;
		drawCrop(previewCanvas, loadedImage, draft, previewCanvas.width || 480);
	}

	/** @param {number} value @param {number} min @param {number} max */
	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	/**
	 * @param {HTMLCanvasElement} canvas
	 * @param {HTMLImageElement} image
	 * @param {{ naturalWidth: number, naturalHeight: number, zoom: number, x: number, y: number }} crop
	 * @param {number} size
	 */
	function drawCrop(canvas, image, crop, size) {
		const context = canvas.getContext('2d');
		if (!context) return;
		canvas.width = size;
		canvas.height = size;
		const visible = Math.min(crop.naturalWidth, crop.naturalHeight) / crop.zoom;
		const sourceX = ((crop.naturalWidth - visible) * (crop.x + 1)) / 2;
		const sourceY = ((crop.naturalHeight - visible) * (crop.y + 1)) / 2;
		context.clearRect(0, 0, size, size);
		context.drawImage(image, sourceX, sourceY, visible, visible, 0, 0, size, size);
	}

	/** @param {HTMLCanvasElement} canvas @param {string} type @param {number} quality @returns {Promise<Blob | null>} */
	function canvasBlob(canvas, type, quality) {
		return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
	}

	/** @param {HTMLImageElement} image @param {NonNullable<typeof draft>} crop */
	async function createOutput(image, crop) {
		const canvas = document.createElement('canvas');
		for (const type of ['image/webp', 'image/jpeg']) {
			for (const step of OUTPUT_STEPS) {
				drawCrop(canvas, image, crop, step.size);
				const blob = await canvasBlob(canvas, type, step.quality);
				if (blob && blob.size <= MAX_BYTES) {
					const outputType = blob.type || type;
					const extension =
						{ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[outputType] ?? 'jpg';
					return new File([blob], `profile-picture.${extension}`, {
						type: outputType,
						lastModified: Date.now()
					});
				}
			}
		}
		return null;
	}

	/** @param {string} url @returns {Promise<HTMLImageElement>} */
	function loadImage(url) {
		return new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = () => reject(new Error('Image failed to load'));
			image.src = url;
		});
	}

	function revokeDraftUrl() {
		if (draft?.sourceUrl) URL.revokeObjectURL(draft.sourceUrl);
	}

	function revokeConfirmedUrl() {
		if (confirmedUrl) URL.revokeObjectURL(confirmedUrl);
		confirmedUrl = '';
	}

	function clearPicker() {
		if (sourceInput) sourceInput.value = '';
	}

	/** @param {Event} event */
	async function selectImage(event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const file = input.files?.[0];
		if (!file) return;
		const selectionGeneration = ++operationGeneration;
		error = '';
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			error = 'Choose a JPEG, PNG, or WebP image.';
			clearPicker();
			return;
		}

		returnFocus = chooseButton ?? null;
		revokeDraftUrl();
		const sourceUrl = URL.createObjectURL(file);
		try {
			const image = await loadImage(sourceUrl);
			if (selectionGeneration !== operationGeneration) {
				URL.revokeObjectURL(sourceUrl);
				return;
			}
			loadedImage = image;
			draft = {
				sourceUrl,
				naturalWidth: image.naturalWidth,
				naturalHeight: image.naturalHeight,
				zoom: 1,
				x: 0,
				y: 0,
				fileName: file.name
			};
			await tick();
			if (cropDialog) cropDialog.scrollTop = 0;
			useButton?.focus({ preventScroll: true });
		} catch {
			URL.revokeObjectURL(sourceUrl);
			error = 'That image could not be opened. Choose another one.';
			clearPicker();
		}
	}

	async function closeDialog() {
		operationGeneration += 1;
		revokeDraftUrl();
		draft = null;
		loadedImage = null;
		pointerId = null;
		busy = false;
		error = '';
		clearPicker();
		await tick();
		returnFocus?.focus();
	}

	function resetCrop() {
		if (!draft) return;
		draft = { ...draft, zoom: 1, x: 0, y: 0 };
	}

	async function confirmCrop() {
		if (!draft || !loadedImage || busy) return;
		const confirmationGeneration = ++operationGeneration;
		busy = true;
		error = '';
		let output;
		try {
			output = await createOutput(loadedImage, draft);
		} catch {
			if (confirmationGeneration === operationGeneration) {
				busy = false;
				error = 'This image could not be prepared. Choose another one.';
			}
			return;
		}
		if (confirmationGeneration !== operationGeneration) return;
		busy = false;
		if (!output) {
			error = 'This image could not be made small enough. Choose another one.';
			return;
		}
		confirmedFile = output;
		revokeConfirmedUrl();
		confirmedUrl = URL.createObjectURL(output);
		if (!outputInput) return;
		const transfer = new DataTransfer();
		transfer.items.add(output);
		outputInput.files = transfer.files;
		await closeDialog();
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key === 'Escape' && draft) {
			event.preventDefault();
			closeDialog();
		}

		if (event.key === 'Tab' && draft) {
			const controls = [
				...document.querySelectorAll('[data-crop-dialog] button, [data-crop-dialog] input')
			].filter(
				(element) => element instanceof HTMLButtonElement || element instanceof HTMLInputElement
			);
			if (!controls.length) return;
			const first = controls[0];
			const last = controls[controls.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	/** @param {PointerEvent} event */
	function startDrag(event) {
		if (!draft) return;
		pointerId = event.pointerId;
		pointerX = event.clientX;
		pointerY = event.clientY;
		const target = event.currentTarget;
		if (target instanceof HTMLCanvasElement) target.setPointerCapture?.(event.pointerId);
	}

	/** @param {PointerEvent} event */
	function drag(event) {
		if (!draft || pointerId !== event.pointerId) return;
		if (!previewCanvas) return;
		const width = previewCanvas.getBoundingClientRect().width || 1;
		const nextX = clamp(draft.x - ((event.clientX - pointerX) / width) * 2, -1, 1);
		const nextY = clamp(draft.y - ((event.clientY - pointerY) / width) * 2, -1, 1);
		pointerX = event.clientX;
		pointerY = event.clientY;
		draft = { ...draft, x: nextX, y: nextY };
	}

	/** @param {PointerEvent} event */
	function stopDrag(event) {
		if (pointerId === event.pointerId) pointerId = null;
	}

	onDestroy(() => {
		revokeDraftUrl();
		revokeConfirmedUrl();
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class:cropper--avatar={variant === 'avatar'} class="cropper">
	{#if variant === 'avatar'}
		<button
			bind:this={chooseButton}
			class="avatar-picker"
			type="button"
			aria-label="Change profile picture"
			on:click={() => sourceInput?.click()}
		>
			<span class="avatar-picker__image">
				{#if confirmedUrl || existingSrc}
					<img src={confirmedUrl || existingSrc} alt="Selected avatar" />
				{:else}
					{initials}
				{/if}
			</span>
			<span class="avatar-picker__action">Change photo</span>
		</button>
	{:else}
		<div class="field-heading">
			<span>{label} <small class="optional-badge">Optional</small></span>
			{#if confirmedUrl || existingSrc}<img
					src={confirmedUrl || existingSrc}
					alt="Selected avatar"
				/>{/if}
		</div>
		<div class="field-picker">
			<button bind:this={chooseButton} type="button" on:click={() => sourceInput?.click()}
				>Choose image</button
			>
			<span class:selected={confirmedFile}
				>{confirmedFile?.name ||
					(existingSrc ? 'Current profile picture' : 'No image selected')}</span
			>
		</div>
		<small>Shown on your account and forum posts. We crop it to a square under 512 KB.</small>
	{/if}

	<input
		bind:this={sourceInput}
		hidden
		type="file"
		accept="image/jpeg,image/png,image/webp"
		aria-label="Choose profile picture file"
		on:change={selectImage}
	/>
	<input
		bind:this={outputInput}
		hidden
		type="file"
		{id}
		{name}
		data-testid="cropped-profile-image"
		tabindex="-1"
	/>
	{#if error}<p class="crop-error" role="alert">{error}</p>{/if}
</div>

{#if draft}
	<div class="dialog-backdrop" data-crop-dialog>
		<div
			bind:this={cropDialog}
			class="crop-dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby={`${id}-crop-title`}
		>
			<header>
				<div>
					<p>Profile picture</p>
					<h2 id={`${id}-crop-title`}>Crop profile picture</h2>
				</div>
				<button
					type="button"
					class="icon-button"
					aria-label="Close crop dialog"
					on:click={closeDialog}>×</button
				>
			</header>
			<div class="crop-preview-wrap">
				<canvas
					bind:this={previewCanvas}
					class="crop-preview"
					width="480"
					height="480"
					aria-label="Profile picture crop preview"
					on:pointerdown={startDrag}
					on:pointermove={drag}
					on:pointerup={stopDrag}
					on:pointercancel={stopDrag}
				></canvas>
				<span aria-hidden="true">Drag to reposition</span>
			</div>
			<div class="crop-controls">
				<label
					>Zoom <input type="range" min="1" max="3" step="0.05" bind:value={draft.zoom} /></label
				>
				<label
					>Horizontal position <input
						type="range"
						min="-1"
						max="1"
						step="0.01"
						bind:value={draft.x}
					/></label
				>
				<label
					>Vertical position <input
						type="range"
						min="-1"
						max="1"
						step="0.01"
						bind:value={draft.y}
					/></label
				>
			</div>
			<footer>
				<button type="button" class="text-button" on:click={resetCrop}>Reset</button>
				<div>
					<button type="button" class="quiet-button" on:click={closeDialog}>Cancel</button>
					<button
						bind:this={useButton}
						type="button"
						class="primary-button"
						disabled={busy}
						on:click={confirmCrop}>{busy ? 'Preparing photo' : 'Use photo'}</button
					>
				</div>
			</footer>
		</div>
	</div>
{/if}

<style>
	.cropper {
		display: grid;
		gap: 0.45rem;
		color: var(--steel, #667790);
		font-family: var(--font-sans, sans-serif);
	}

	.field-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		font-size: 0.82rem;
		font-weight: 650;
	}

	.field-heading small {
		padding: 0.18rem 0.42rem;
		border: 1px solid var(--line, #bdc9d9);
		background: var(--paper-blue, #f0f5ff);
		color: var(--ink, #071b38);
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.field-heading img {
		width: 3rem;
		aspect-ratio: 1;
		border: 1px solid var(--line, #bdc9d9);
		object-fit: cover;
	}

	.field-picker {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		min-height: 2.8rem;
		border: 1px solid var(--line, #bdc9d9);
		background: white;
	}

	.field-picker button {
		border: 0;
		border-right: 1px solid var(--line, #bdc9d9);
		padding: 0 1rem;
		background: var(--blue, #1457d9);
		color: white;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.field-picker span {
		align-self: center;
		overflow: hidden;
		padding: 0 0.9rem;
		font-size: 0.8rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.field-picker span.selected {
		color: var(--ink, #051a33);
	}

	.cropper > small {
		font-size: 0.72rem;
	}

	.cropper--avatar {
		width: clamp(8.5rem, 13vw, 10.5rem);
	}

	.avatar-picker {
		position: relative;
		display: grid;
		width: 100%;
		aspect-ratio: 1;
		overflow: hidden;
		border: 1px solid var(--ink, #051a33);
		padding: 0;
		background: var(--ink, #051a33);
		color: white;
		font: inherit;
		font-size: 2rem;
		font-weight: 700;
		cursor: pointer;
	}

	.avatar-picker__image,
	.avatar-picker__image img {
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		object-fit: cover;
	}

	.avatar-picker__action {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		padding: 0.65rem;
		background: rgb(5 26 51 / 88%);
		font-size: 0.72rem;
		font-weight: 700;
	}

	.avatar-picker:focus-visible,
	.field-picker button:focus-visible {
		outline: 3px solid rgb(20 87 217 / 28%);
		outline-offset: 3px;
	}

	.crop-error {
		margin: 0;
		color: #c7273b;
		font-size: 0.76rem;
	}

	.dialog-backdrop {
		position: fixed;
		z-index: 1000;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1.25rem;
		background: rgb(2 14 31 / 72%);
	}

	.crop-dialog {
		display: grid;
		width: min(92vw, 36rem);
		max-height: calc(100vh - 2.5rem);
		overflow: auto;
		border: 1px solid var(--ink, #051a33);
		background: white;
		box-shadow: 0 1.5rem 5rem rgb(2 14 31 / 32%);
		color: var(--ink, #051a33);
		font-family: var(--font-sans, sans-serif);
	}

	.crop-dialog header,
	.crop-dialog footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
	}

	.crop-dialog header {
		border-bottom: 1px solid var(--line, #bdc9d9);
	}

	.crop-dialog header p,
	.crop-dialog header h2 {
		margin: 0;
	}

	.crop-dialog header p {
		color: var(--steel, #667790);
		font-size: 0.72rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.crop-dialog header h2 {
		font-size: clamp(1.35rem, 4vw, 1.8rem);
		letter-spacing: -0.03em;
	}

	.icon-button,
	.text-button,
	.quiet-button,
	.primary-button {
		border: 1px solid var(--line, #bdc9d9);
		padding: 0.72rem 1rem;
		background: white;
		color: inherit;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.icon-button {
		width: 2.65rem;
		height: 2.65rem;
		padding: 0;
		font-size: 1.7rem;
		line-height: 1;
	}

	.text-button {
		border-color: transparent;
		color: var(--blue, #1457d9);
	}

	.primary-button {
		border-color: var(--blue, #1457d9);
		background: var(--blue, #1457d9);
		color: white;
	}

	.primary-button:disabled {
		cursor: wait;
		opacity: 0.58;
	}

	.crop-preview-wrap {
		display: grid;
		justify-items: center;
		gap: 0.55rem;
		padding: 1.35rem 1.35rem 0.85rem;
	}

	.crop-preview {
		width: min(100%, 22rem);
		aspect-ratio: 1;
		background: #eef3f9;
		box-shadow:
			0 0 0 5px white,
			0 0 0 6px var(--line, #bdc9d9);
		touch-action: none;
		cursor: grab;
	}

	.crop-preview:active {
		cursor: grabbing;
	}

	.crop-preview-wrap span {
		color: var(--steel, #667790);
		font-size: 0.72rem;
	}

	.crop-controls {
		display: grid;
		gap: 0.7rem;
		padding: 0.85rem 1.35rem 1.25rem;
	}

	.crop-controls label {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr);
		align-items: center;
		gap: 0.8rem;
		color: var(--steel, #667790);
		font-size: 0.76rem;
		font-weight: 650;
	}

	.crop-controls input {
		width: 100%;
		accent-color: var(--blue, #1457d9);
	}

	.crop-dialog footer {
		border-top: 1px solid var(--line, #bdc9d9);
	}

	.crop-dialog footer > div {
		display: flex;
		gap: 0.65rem;
	}

	@media (max-width: 34rem) {
		.dialog-backdrop {
			place-items: stretch;
			padding: 0;
		}

		.crop-dialog {
			width: 100vw;
			height: 100dvh;
			max-height: none;
			border: 0;
		}

		.crop-dialog header {
			position: sticky;
			z-index: 2;
			top: 0;
			min-height: 2.75rem;
			background: white;
		}

		.crop-dialog footer {
			position: sticky;
			z-index: 2;
			bottom: 0.125rem;
			min-height: 2.75rem;
			background: white;
		}

		.crop-dialog button,
		.crop-dialog input {
			min-height: 2.75rem;
		}

		.crop-preview-wrap {
			padding: 1rem 1.25rem 0.65rem;
		}

		.crop-preview {
			width: min(100%, 19rem);
		}

		.crop-controls label {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}

		.crop-dialog footer {
			align-items: center;
			flex-direction: row;
			padding: 0.65rem 0.75rem;
			gap: 0.5rem;
		}

		.crop-dialog footer > div {
			display: flex;
			gap: 0.4rem;
		}

		.crop-dialog footer button {
			padding-inline: 0.75rem;
		}
	}
</style>
