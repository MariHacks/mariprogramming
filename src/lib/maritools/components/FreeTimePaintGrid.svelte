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

	/** @type {'edit' | 'view'} */
	export let mode = 'edit';

	/**
	 * View-mode heat stats keyed by paint cell.
	 * @type {Record<string, { free: string[], busy: string[], freeCount: number, total: number, ratio: number }>}
	 */
	export let cellStats = {};

	const slotTimes = paintSlotTimes();
	let painting = false;
	/** @type {boolean | null} */
	let paintValue = null;
	/** @type {Set<string>} */
	let paintedCells = new Set();
	/** @type {{ key: string, top: number, left: number } | null} */
	let tip = null;

	$: viewing = mode === 'view';
	$: if (!viewing && tip) tip = null;

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
		if (viewing) return;
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
		if (viewing) return;
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
		if (viewing) return;
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
		if (viewing) return;
		freeCells = new Set();
		onChange(freeCells);
	}

	/** @param {KeyboardEvent} event @param {string} key */
	function onCellKeydown(event, key) {
		if (viewing) {
			if (event.key === 'Escape') hideTip(key);
			return;
		}
		if (event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		toggleCell(key);
	}

	/** @param {string} key @param {EventTarget | null | undefined} target */
	function showTip(key, target) {
		if (!viewing) return;
		if (!(target instanceof HTMLElement)) return;
		const rect = target.getBoundingClientRect();
		tip = {
			key,
			top: rect.bottom + 8,
			left: rect.left + rect.width / 2
		};
	}

	/** @param {string} key */
	function hideTip(key) {
		if (tip?.key === key) tip = null;
	}

	$: tipStats = tip
		? (cellStats[tip.key] ?? {
				free: [],
				busy: [],
				freeCount: 0,
				total: 0,
				ratio: 0
			})
		: null;
</script>

<svelte:window
	on:pointerup={onPointerUp}
	on:pointermove={(event) => {
		if (!painting || viewing) return;
		paintCell(document.elementFromPoint(event.clientX, event.clientY));
	}}
/>

<div class="paint-wrap" data-board-mode={viewing ? 'view' : 'edit'}>
	<div class="paint-toolbar">
		<div>
			{#if viewing}
				<strong>Group free time</strong>
				<span>Darker green means more of the included members are free.</span>
			{:else}
				<strong>Drag to paint your free time</strong>
				<span>Click or drag cells. Green bands show where selected members overlap.</span>
			{/if}
		</div>
		{#if viewing}
			<div class="paint-legend heat-legend" aria-label="Heat scale">
				<span>Fewer free</span>
				<i class="heat-scale"></i>
				<span>More free</span>
			</div>
		{:else}
			<div class="paint-legend">
				<span><i class="legend-you"></i>Your free time</span>
				<span><i class="legend-common"></i>Common free</span>
				<button type="button" class="text-button clear-paint" on:click={clearPaint}>Clear</button>
			</div>
		{/if}
	</div>
	<div class="paint-grid" class:is-view={viewing} aria-label="Interactive free-time grid">
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
				{@const key = paintCellKey(
					/** @type {'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'} */ (column.weekday),
					time
				)}
				{@const stats = cellStats[key] ?? {
					free: [],
					busy: [],
					freeCount: 0,
					total: 0,
					ratio: 0
				}}
				<button
					type="button"
					class="paint-cell"
					class:selected={!viewing && freeCells.has(key) && !column.isNoClass}
					class:common={!viewing && commonCells.has(key) && !column.isNoClass}
					class:heat={viewing && !column.isNoClass}
					class:no-class={column.isNoClass}
					style={viewing && !column.isNoClass ? `--heat-ratio: ${stats.ratio}` : undefined}
					data-cell={key}
					data-free-count={viewing && !column.isNoClass ? String(stats.freeCount) : undefined}
					aria-label="{column.weekday} {time}"
					aria-pressed={viewing ? undefined : freeCells.has(key) && !column.isNoClass}
					aria-describedby={viewing && tip?.key === key ? 'free-time-cell-tip' : undefined}
					disabled={column.isNoClass}
					on:pointerdown={onPointerDown}
					on:pointerenter={(event) => showTip(key, event.currentTarget)}
					on:pointerleave={() => hideTip(key)}
					on:focus={(event) => showTip(key, event.currentTarget)}
					on:blur={() => hideTip(key)}
					on:keydown={(event) => onCellKeydown(event, key)}
				></button>
			{/each}
		{/each}
	</div>
	{#if viewing && tip && tipStats}
		<div
			id="free-time-cell-tip"
			class="paint-tooltip"
			role="tooltip"
			style="top: {tip.top}px; left: {tip.left}px"
		>
			{#if tipStats.total === 0}
				<p>No members included</p>
			{:else}
				<div>
					<strong>Available</strong>
					{#if tipStats.free.length === 0}
						<p>None</p>
					{:else}
						<ul>
							{#each tipStats.free as name, index (`${name}-${index}`)}
								<li>{name}</li>
							{/each}
						</ul>
					{/if}
				</div>
				<div>
					<strong>Unavailable</strong>
					{#if tipStats.busy.length === 0}
						<p>None</p>
					{:else}
						<ul>
							{#each tipStats.busy as name, index (`${name}-${index}`)}
								<li>{name}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
	<p class="no-login-caption">
		No login required. Anyone with the link can add availability using a display name.
	</p>
</div>
