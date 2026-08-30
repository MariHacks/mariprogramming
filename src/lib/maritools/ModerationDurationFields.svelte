<script>
	import {
		BAN_PRESETS,
		DEFAULT_BAN_PRESET,
		DEFAULT_MUTE_PRESET,
		MUTE_PRESETS
	} from '$lib/maritools/moderation-duration.js';

	/** @type {'mute' | 'ban'} */
	export let kind = 'mute';

	/** @type {string} */
	export let idPrefix = kind;

	let preset = kind === 'mute' ? DEFAULT_MUTE_PRESET : DEFAULT_BAN_PRESET;
	let customAmount = 1;
	/** @type {'hours' | 'days'} */
	let customUnit = 'days';

	$: presets = kind === 'mute' ? MUTE_PRESETS : BAN_PRESETS;
	$: customUnits =
		kind === 'mute'
			? [
					['hours', 'Hours'],
					['days', 'Days']
				]
			: [
					['days', 'Days'],
					['hours', 'Hours']
				];
</script>

<div class="mod-duration" data-kind={kind}>
	<label class="mod-duration-preset">
		<span>{kind === 'mute' ? 'Mute for' : 'Ban for'}</span>
		<select name={`${kind}Preset`} id={`${idPrefix}-preset`} bind:value={preset}>
			{#each presets as row (row.id)}
				<option value={row.id}>{row.label}</option>
			{/each}
		</select>
	</label>
	{#if preset === 'custom'}
		<label class="mod-duration-custom">
			<span class="visually-hidden">Custom amount</span>
			<input
				type="number"
				name={`${kind}CustomAmount`}
				id={`${idPrefix}-amount`}
				min="1"
				max="366"
				bind:value={customAmount}
				required
			/>
		</label>
		<label class="mod-duration-unit">
			<span class="visually-hidden">Custom unit</span>
			<select name={`${kind}CustomUnit`} id={`${idPrefix}-unit`} bind:value={customUnit}>
				{#each customUnits as unit (unit[0])}
					<option value={unit[0]}>{unit[1]}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

<style>
	.mod-duration {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}

	.mod-duration label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		font-weight: 650;
		color: var(--color-muted, #5b6b7c);
	}

	.mod-duration select,
	.mod-duration input[type='number'] {
		min-height: 2rem;
		padding: 0.2rem 0.4rem;
		border: var(--rule, 1px solid #c9d2dc);
		background: white;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		color: inherit;
	}

	.mod-duration input[type='number'] {
		width: 3.5rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
