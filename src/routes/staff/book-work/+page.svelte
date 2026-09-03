<script>
	import { resolve } from '$app/paths';

	export let data;
	export let form;
</script>

<svelte:head><title>Book work | Programming Club Team</title></svelte:head>

<section class="workspace">
	<header>
		<p class="eyebrow">Book delivery operations</p>
		<h1>Book work</h1>
		<p>Outstanding books grouped by pickup bookstore. Assign stores, then record pickups.</p>
	</header>
	{#if form?.message}<p class="message" role="status">{form.message}</p>{/if}
	{#if form?.errorSummary}<p class="error" role="alert">{form.errorSummary}</p>{/if}

	{#if data.unavailable}
		<div class="error panel" role="alert">
			<p>Book work is unavailable right now.</p>
			<a class="inline-action" href={resolve('/staff/book-work', {})}>Reload book work</a>
		</div>
	{:else if data.board.totalRows === 0}
		<div class="empty panel">
			<p>There is no outstanding book work.</p>
			<a class="inline-action" href={resolve('/staff', {})}>Open orders ledger</a>
		</div>
	{:else}
		{#each data.board.groups as group (group.bookstore?.id ?? 'unassigned')}
			<section class="group">
				<h2>{group.bookstore?.name ?? 'Unassigned'}</h2>
				<div class="table-wrap">
					<table>
						<thead>
							<tr
								><th>Book</th><th>Reference</th><th>Requested</th><th>Picked up</th><th>Remaining</th
								><th>Source</th><th>Age</th><th>Action</th></tr
							>
						</thead>
						<tbody>
							{#each group.rows as row (`${row.ref.kind}:${row.ref.lineId ?? row.ref.itemId}`)}
								<tr>
									<td
										><strong>{row.title}</strong>{#if row.author}<small>{row.author}</small
											>{/if}</td
									>
									<td><code class="reference">{row.reference}</code></td>
									<td>{row.requested}</td>
									<td>{row.pickedUp}</td>
									<td>{row.remaining}</td>
									<td><small>{row.source.teacher}<br />{row.source.course}</small></td>
									<td class="age age-{row.age.band}">{row.age.label}</td>
									<td>
										{#if group.bookstore === null}
											<form method="post" action="?/assign">
												<input type="hidden" name="requestId" value={row.ref.requestId} />
												<input type="hidden" name="version" value={row.version} />
												<select
													name="bookstoreId"
													aria-label={`Bookstore for ${row.title}`}
													required
												>
													<option value="">Choose</option>
													{#each data.board.bookstores as store (store.id)}
														<option value={store.id}>{store.name}</option>
													{/each}
												</select>
												<button type="submit">Assign</button>
											</form>
										{:else}
											<form method="post" action="?/pickup">
												<input type="hidden" name="kind" value={row.ref.kind} />
												<input
													type="hidden"
													name="parentId"
													value={row.ref.orderId ?? row.ref.requestId}
												/>
												<input
													type="hidden"
													name="lineId"
													value={row.ref.lineId ?? row.ref.itemId}
												/>
												<input type="hidden" name="version" value={row.version} />
												<input type="hidden" name="clientRequestId" value={row.commandId} />
												<input
													name="quantity"
													type="number"
													min="1"
													max={row.remaining}
													value="1"
													aria-label={`Copies of ${row.title}`}
													required
												/>
												<button type="submit">Record pickup</button>
											</form>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/each}
	{/if}
</section>

<style>
	.workspace {
		padding: clamp(1.25rem, 3vw, 2.5rem) var(--page-gutter) 4rem;
	}
	header {
		display: grid;
		padding-bottom: 1.25rem;
		border-bottom: var(--rule-strong);
		gap: 0.35rem;
	}
	header h1 {
		font-size: clamp(1.75rem, 3vw, 2.25rem);
		letter-spacing: -0.03em;
		line-height: 1.05;
	}
	header p:last-child,
	small {
		color: var(--color-muted);
		font-size: 0.875rem;
	}
	.group {
		margin-top: 1.5rem;
	}
	.group h2 {
		margin-bottom: 0.75rem;
		font-size: 1.125rem;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		padding: 0.65rem 0.75rem;
		border-block: var(--rule);
		text-align: left;
		vertical-align: top;
	}
	td strong,
	td small {
		display: block;
	}
	.reference {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		letter-spacing: -0.02em;
		user-select: all;
	}
	td form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	td input[type='number'] {
		width: 5rem;
		min-height: 2.75rem;
	}
	td select {
		min-width: 9rem;
		min-height: 2.75rem;
	}
	button {
		min-height: 2.75rem;
		padding: 0 0.75rem;
		border: var(--rule-strong);
		background: white;
		font-weight: 650;
		cursor: pointer;
	}
	button:focus-visible,
	td :is(input, select):focus-visible,
	.inline-action:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
	}
	.message,
	.error,
	.empty,
	.panel {
		margin-top: 1rem;
		padding: 0.85rem 1rem;
		border: var(--rule);
	}
	.panel {
		display: grid;
		gap: 0.65rem;
		justify-items: start;
	}
	.panel p {
		margin: 0;
	}
	.error {
		border-color: var(--danger);
		color: var(--danger);
	}
	.inline-action {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--club-blue);
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
	}
	.age-fresh {
		color: var(--color-muted);
	}
	.age-aging {
		color: var(--coral);
	}
	.age-overdue {
		color: var(--danger);
	}
</style>
