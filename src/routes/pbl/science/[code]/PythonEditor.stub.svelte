<script>
	/** @type {string} */
	export let source = '';
	/** @type {string} */
	export let yjsState = '';
	/** @type {string} */
	export let awarenessState = '';
	/** @type {boolean} */
	export let editable = true;
	/** @type {{ name: string, color: string, colorLight: string }} */
	export let user = { name: 'You', color: '#78dce8', colorLight: '#78dce833' };
	/** @type {string | number} */
	export let editorEpoch = 0;
	/** @type {'dark' | 'light'} */
	export let theme = 'light';
	/** @type {(payload: { source: string, yjsState: string, awarenessState: string }) => void} */
	export let onCollab = () => {};
</script>

<div
	role="textbox"
	aria-label="Python"
	aria-multiline="true"
	aria-readonly={editable ? 'false' : 'true'}
	contenteditable={editable ? 'true' : 'false'}
	data-user={user.name}
	data-editor-epoch={editorEpoch}
	data-editor-theme={theme}
	on:input={(event) =>
		onCollab({
			source: event.currentTarget.textContent ?? '',
			yjsState,
			awarenessState
		})}
>
	{source}
</div>
