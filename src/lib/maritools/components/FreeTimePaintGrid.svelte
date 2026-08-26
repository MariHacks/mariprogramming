<script>
	import {
		PAINT_WEEKDAYS,
		paintCellKey,
		paintSlotTimes
	} from '$lib/maritools/schedule/freeTimeBoard.js';

	/** @type {Set<string>} */
	export let freeCells = new Set();

	/** @type {Set<string>} */
	export let commonCells = new Set();

	/** @type {(cells: Set<string>) => void} */
	export let onChange = () => {};

	const slotTimes = paintSlotTimes();
	let painting = false;
	/** @type {boolean | null} */
	let paintValue = null;
	/** @type {Set<string>} */
	let paintedCells = new Set();

	/** @param {string} key @param {boolean} selected */
	function setCell(key, selected) {
		const next = new Set(freeCells);
		if (selected) next.add(key);
		else next.delete(key);
		freeCells = next;
		onChange(next);
	}

	/** @param {string} key */
	function toggleCell(key) {
		setCell(key, !freeCells.has(key));
	}

	/** @param {Element | null | undefined} target */
	function paintCell(target) {
		if (!(target instanceof HTMLElement)) return;
		const key = target.dataset.cell;
		if (!key || paintedCells.has(key)) return;
		paintedCells.add(key);
		setCell(key, paintValue === true);
	}

	/** @param {PointerEvent} event */
	function onPointerDown(event) {
		const cell = /** @type {HTMLElement | null} */ (event.currentTarget);
		const key = cell?.dataset.cell;
		if (!key) return;
		event.preventDefault();
		painting = true;
		paintValue = !freeCells.has(key);
		paintedCells = new Set();
		paintCell(cell);
	}

	function onPointerUp() {
		painting = false;
		paintedCells = new Set();
	}

	function clearPaint() {
		freeCells = new Set();
		onChange(freeCells);
	}

	/** @param {KeyboardEvent} event @param {string} key */
	function onCellKeydown(event, key) {
		if (event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		toggleCell(key);
	}
</script>

<svelte:window
	on:pointerup={onPointerUp}
	on:pointermove={(event) => {
		if (!painting) return;
		paintCell(document.elementFromPoint(event.clientX, event.clientY));
	}}
/>

<div class="paint-wrap">
	<div class="paint-toolbar">
		<div>
			<strong>Drag to paint your free time</strong>
			<span>Click or drag cells. Green bands show where everyone overlaps.</span>
		</div>
		<div class="paint-legend">
			<span><i class="legend-you"></i>Your free time</span>
			<span><i class="legend-common"></i>Common free</span>
			<button type="button" class="text-button" on:click={clearPaint}>Clear</button>
		</div>
	</div>
	<div class="paint-grid" aria-label="Interactive free-time grid">
		<b aria-hidden="true"></b>
		{#each PAINT_WEEKDAYS as weekday (weekday)}
			<b>{weekday}</b>
		{/each}
		{#each slotTimes as time (time)}
			<b class="paint-time">{time}</b>
			{#each PAINT_WEEKDAYS as weekday (weekday + time)}
				{@const key = paintCellKey(weekday, time)}
				<button
					type="button"
					class="paint-cell"
					class:selected={freeCells.has(key)}
					class:common={commonCells.has(key)}
					data-cell={key}
					aria-label="{weekday} {time}"
					aria-pressed={freeCells.has(key)}
					on:pointerdown={onPointerDown}
					on:keydown={(event) => onCellKeydown(event, key)}
				></button>
			{/each}
		{/each}
	</div>
</div>

<style>
	.paint-wrap {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: var(--rule);
		background: var(--surface-raised);
	}

	.paint-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.paint-toolbar strong {
		display: block;
		font-size: var(--text-sm);
	}

	.paint-toolbar span,
	.paint-legend span {
		color: var(--quiet-steel);
		font-size: var(--text-xs);
	}

	.paint-legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.paint-legend i {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		margin-right: 0.25rem;
		border: 1px solid rgb(var(--midnight-rgb) / 18%);
		vertical-align: middle;
	}

	.legend-you {
		background: rgb(var(--sky-rgb) / 40%);
	}

	.legend-common {
		background: #dff4ea;
	}

	.text-button {
		border: 0;
		background: transparent;
		color: var(--club-blue);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
	}

	.paint-grid {
		display: grid;
		grid-template-columns: 3rem repeat(5, minmax(0, 1fr));
		grid-auto-rows: 1.35rem;
		gap: 1px;
		overflow-x: auto;
		background: rgb(var(--midnight-rgb) / 8%);
	}

	.paint-grid > b {
		display: grid;
		place-items: center;
		background: var(--mist);
		color: var(--quiet-steel);
		font-size: 0.625rem;
		font-weight: 650;
	}

	.paint-time {
		justify-content: end;
		padding-right: 0.35rem;
		font-variant-numeric: tabular-nums;
	}

	.paint-cell {
		border: 0;
		background: #fff;
		cursor: pointer;
	}

	.paint-cell.selected {
		background: rgb(var(--sky-rgb) / 35%);
	}

	.paint-cell.common {
		box-shadow: inset 0 -3px 0 #177b59;
	}

	.paint-cell.common.selected {
		background: #dff4ea;
	}
</style>
