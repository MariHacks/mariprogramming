<script>
	import {
		PAINT_WEEKDAYS,
		paintCellKey,
		paintSlotLabel,
		paintSlotTimes
	} from '$lib/maritools/schedule/freeTimeBoard.js';

	/** @type {Set<string>} */
	export let freeCells = new Set();

	/** @type {Set<string>} */
	export let commonCells = new Set();

	/** @type {string[]} */
	export let dayHeaders = [...PAINT_WEEKDAYS];

	/**
	 * Optional term-aware columns. When present, closed / out-of-term days are grayed and not paintable.
	 * @type {{ weekday: string, header: string, isNoClass: boolean, outOfTerm: boolean }[] | null}
	 */
	export let dayColumns = null;

	/** @type {(cells: Set<string>) => void} */
	export let onChange = () => {};

	const slotTimes = paintSlotTimes();
	let painting = false;
	/** @type {boolean | null} */
	let paintValue = null;
	/** @type {Set<string>} */
	let paintedCells = new Set();

	$: columns =
		Array.isArray(dayColumns) && dayColumns.length === PAINT_WEEKDAYS.length
			? dayColumns
			: PAINT_WEEKDAYS.map((weekday, index) => ({
					weekday,
					header: dayHeaders[index] ?? weekday,
					isNoClass: false,
					outOfTerm: false
				}));

	$: closedWeekdays = new Set(
		columns.filter((column) => column.isNoClass).map((column) => column.weekday)
	);

	/** @param {string} weekday */
	function isClosed(weekday) {
		return closedWeekdays.has(weekday);
	}

	/** @param {string} key @param {boolean} selected */
	function setCell(key, selected) {
		const weekday = key.slice(0, key.indexOf('-'));
		if (isClosed(weekday)) return;
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
		const cell = target instanceof Element ? target.closest('.paint-cell') : null;
		if (!(cell instanceof HTMLElement)) return;
		if (cell.disabled || cell.classList.contains('no-class')) return;
		const key = cell.dataset.cell;
		if (!key || paintedCells.has(key)) return;
		paintedCells.add(key);
		setCell(key, paintValue === true);
	}

	/** @param {PointerEvent} event */
	function onPointerDown(event) {
		const cell = /** @type {HTMLElement | null} */ (event.currentTarget);
		const key = cell?.dataset.cell;
		if (!key || cell?.disabled) return;
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
			<button type="button" class="text-button clear-paint" on:click={clearPaint}>Clear</button>
		</div>
	</div>
	{#if freeCells.size === 0 && commonCells.size === 0}
		<p class="paint-empty-hint">
			Paint free slots below, or import an Omnivox schedule from the side panel.
		</p>
	{/if}
	<div class="paint-grid" aria-label="Interactive free-time grid">
		<b>Time</b>
		{#each columns as column (column.weekday)}
			<b class:is-no-class={column.isNoClass}>
				<span>{column.header}</span>
				{#if column.isNoClass && !column.outOfTerm}<i class="muted">No class</i>{/if}
			</b>
		{/each}
		{#each slotTimes as time (time)}
			<span class="paint-time">{paintSlotLabel(time)}</span>
			{#each columns as column (column.weekday + time)}
				{@const key = paintCellKey(/** @type {'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'} */ (column.weekday), time)}
				<button
					type="button"
					class="paint-cell"
					class:selected={freeCells.has(key) && !column.isNoClass}
					class:common={commonCells.has(key) && !column.isNoClass}
					class:no-class={column.isNoClass}
					data-cell={key}
					aria-label="{column.weekday} {time}"
					aria-pressed={freeCells.has(key) && !column.isNoClass}
					disabled={column.isNoClass}
					on:pointerdown={onPointerDown}
					on:keydown={(event) => onCellKeydown(event, key)}
				></button>
			{/each}
		{/each}
	</div>
	<p class="no-login-caption">
		No login required. Anyone with the link can add availability using a display name.
	</p>
</div>
