<script>
	export let data;
	export let form;
</script>

<svelte:head><title>Book work | Programming Club Staff</title></svelte:head>

<section class="workspace">
	<header>
		<p class="eyebrow">Book delivery operations</p>
		<h1>Book work</h1>
		<p>Outstanding books grouped by pickup bookstore.</p>
	</header>
	{#if form?.message}<p class="message" role="status">{form.message}</p>{/if}
	{#if form?.errorSummary}<p class="error" role="alert">{form.errorSummary}</p>{/if}

	{#if data.unavailable}
		<p class="error" role="alert">
			Book work is unavailable right now. Reload this page to try again.
		</p>
	{:else if data.board.totalRows === 0}
		<p class="empty">There is no outstanding book work.</p>
	{:else}
		{#each data.board.groups as group (group.bookstore?.id ?? 'unassigned')}
			<section class="group">
				<h2>{group.bookstore?.name ?? 'Unassigned'}</h2>
				<div class="table-wrap">
					<table>
						<thead>
							<tr
								><th>Book</th><th>Requested</th><th>Picked up</th><th>Remaining</th><th>Source</th
								><th>Age</th><th>Action</th></tr
							>
						</thead>
						<tbody>
							{#each group.rows as row (`${row.ref.kind}:${row.ref.lineId ?? row.ref.itemId}`)}
								<tr>
									<td
										><strong>{row.title}</strong>{#if row.author}<small>{row.author}</small
											>{/if}</td
									>
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
		padding: clamp(2rem, 5vw, 4.5rem) var(--page-gutter) 5rem;
	}
	header {
		display: grid;
		padding-bottom: 2rem;
		border-bottom: var(--rule-strong);
		gap: 0.5rem;
	}
	header h1 {
		font-size: clamp(2.5rem, 6vw, 5.5rem);
	}
	header p:last-child,
	small {
		color: var(--color-muted);
	}
	.group {
		margin-top: 2rem;
	}
	.group h2 {
		margin-bottom: 0.75rem;
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
		padding: 0.75rem;
		border-block: var(--rule);
		text-align: left;
		vertical-align: top;
	}
	td strong,
	td small {
		display: block;
	}
	td form {
		display: flex;
		gap: 0.4rem;
	}
	td input[type='number'] {
		width: 5rem;
		min-height: 2.5rem;
	}
	td select {
		min-width: 9rem;
		min-height: 2.5rem;
	}
	button {
		min-height: 2.5rem;
		border: var(--rule-strong);
		background: white;
		cursor: pointer;
	}
	.message,
	.error,
	.empty {
		margin-top: 1rem;
		padding: 0.75rem;
		border: var(--rule);
	}
	.error {
		border-color: var(--danger);
		color: var(--danger);
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
