<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';

	export let data;
	export let form = null;
</script>

<svelte:head>
	<title>Forum | {MARITOOLS_NAME}</title>
	<meta name="description" content="Read student threads. Sign in to post. Course tags come from the catalog." />
</svelte:head>

<section class="forum-page page-container">
	<header class="intro">
		<h1>Forum</h1>
		<p>Anyone can read threads. Sign in with Google to post or reply. Course tags come from the catalog.</p>
	</header>

	<form method="GET" class="filters">
		<label>
			Category
			<select name="category">
				<option value="">All</option>
				<option value="courses" selected={data.category === 'courses'}>Courses</option>
				<option value="student-life" selected={data.category === 'student-life'}>Student life</option>
			</select>
		</label>
		<label>
			Course
			<select name="course">
				<option value="">All courses</option>
				{#each data.courses as course (course.id)}
					<option value={course.id} selected={data.courseId === course.id}>
						{course.code} {course.title}
					</option>
				{/each}
			</select>
		</label>
		<button type="submit" class="primary">Show threads</button>
	</form>

	{#if data.unavailable}
		<p class="error" role="alert">The forum is unavailable right now. Try again.</p>
	{:else if data.threads.length === 0}
		<p>No threads yet.</p>
	{:else}
		<ul class="threads">
			{#each data.threads as thread (thread.id)}
				<li>
					<a href={`/tools/forum/${thread.id}`}>
						<strong>{thread.title}</strong>
						<span class="meta">
							{thread.category}{thread.courseCode ? ` · ${thread.courseCode}` : ''}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.signedIn}
		<section class="panel">
			<h2>Start a thread</h2>
			<form method="POST" action="?/create" class="stack">
				<label>
					Category
					<select name="category" required>
						<option value="courses">Courses</option>
						<option value="student-life">Student life</option>
					</select>
				</label>
				<label>
					Course tag
					<select name="courseId">
						<option value="">No course tag</option>
						{#each data.courses as course (course.id)}
							<option value={course.id}>{course.code} {course.title}</option>
						{/each}
					</select>
				</label>
				<label>
					Title
					<input name="title" required maxlength="240" />
				</label>
				<label>
					Body
					<textarea name="body" rows="6" required maxlength="20000"></textarea>
				</label>
				<button type="submit" class="primary">Post thread</button>
			</form>
			{#if form?.error}
				<p class="error" role="alert">{form.error}</p>
			{/if}
		</section>
	{:else}
		<p><a href="/tools/account">Sign in with Google</a> to post.</p>
	{/if}
</section>

<style>
	.forum-page {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-md);
	}

	h1 {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		line-height: 1.05;
	}

	.intro p {
		max-width: 52ch;
	}

	.filters {
		display: grid;
		grid-template-columns: minmax(0, 16rem) minmax(0, 16rem) auto;
		gap: var(--space-sm);
		align-items: end;
		border-block: var(--rule);
		padding-block: var(--space-sm);
	}

	.threads {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.threads a {
		display: grid;
		gap: var(--space-3xs);
		padding-block: var(--space-sm);
		border-block-start: var(--rule);
		text-decoration: none;
		color: inherit;
	}

	.meta {
		color: var(--quiet-steel);
		font-size: var(--text-sm);
	}

	.panel {
		border-block-start: var(--rule);
		padding-block-start: var(--space-md);
	}

	.stack,
	label {
		display: grid;
		gap: var(--space-3xs);
	}

	.stack {
		gap: var(--space-sm);
		max-width: 40rem;
	}

	label {
		font-size: var(--text-sm);
		font-weight: 600;
	}

	input,
	textarea,
	select,
	button {
		font: inherit;
	}

	input,
	textarea,
	select {
		width: 100%;
		height: var(--control-height);
		padding-inline: var(--space-xs);
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
	}

	textarea {
		height: auto;
		padding: var(--space-sm);
	}

	.primary {
		justify-self: start;
		height: var(--control-height);
		padding-inline: var(--space-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--club-blue);
		color: #fff;
		font-weight: 650;
	}

	.primary:focus-visible,
	select:focus-visible,
	input:focus-visible,
	textarea:focus-visible {
		outline: var(--focus-ring-width) solid var(--club-blue);
		outline-offset: var(--focus-ring-offset);
	}

	.error {
		color: var(--danger);
		font-size: var(--text-sm);
	}

	@media (max-width: 40rem) {
		.filters {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
