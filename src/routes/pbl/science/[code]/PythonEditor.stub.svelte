<script>
	/** @type {string} */
	export let source = '';
	/** @type {boolean} */
	export let editable = true;
	/** @type {(value: string) => void} */
	export let onSource = () => {};
</script>

<div
	role="textbox"
	aria-label="Python"
	aria-multiline="true"
	aria-readonly={editable ? 'false' : 'true'}
	contenteditable={editable ? 'true' : 'false'}
	on:input={(event) => onSource(event.currentTarget.textContent ?? '')}
>
	{source}
</div>
