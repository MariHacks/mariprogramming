<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import '$lib/maritools/styles/index-pages.css';

	export let data;
	export let form = null;

	/** @param {string} value */
	function tabHref(value) {
		const params = new URLSearchParams();
		if (value) params.set('category', value);
		if (data.courseId) params.set('course', data.courseId);
		const query = params.toString();
		return query ? `?${query}` : '/tools/forum';
	}
</script>

<svelte:head>
	<title>Forum | {MARITOOLS_NAME}</title>
	<meta name="description" content="Read student threads. Sign in to post. Course tags come from the catalog." />
</svelte:head>

<section class="mt-index-page forum-page">
	<header class="mt-titlebar forum-titlebar">
		<div>
			<h1>Forum</h1>
		</div>
		<nav class="mt-forum-tabs" aria-label="Forum categories">
			<a href={tabHref('')} class:is-active={!data.category}>All</a>
			<a href={tabHref('courses')} class:is-active={data.category === 'courses'}>Courses</a>
			<a href={tabHref('student-life')} class:is-active={data.category === 'student-life'}>Student life</a>
		</nav>
	</header>

	<p class="forum-intro">Anyone can read threads. Sign in with Google to post or reply. Course tags come from the catalog.</p>

	<form method="GET" class="mt-forum-toolbar">
		<input type="hidden" name="category" value={data.category} />
		<label class="mt-search-field">
			<span aria-hidden="true">⌕</span>
			<span>Course</span>
			<select name="course" aria-label="Filter by course">
				<option value="">All courses</option>
				{#each data.courses as course (course.id)}
					<option value={course.id} selected={data.courseId === course.id}>
						{course.code} {course.title}
					</option>
				{/each}
			</select>
		</label>
		<div></div>
		<button type="submit" class="mt-dark-button">Show threads</button>
	</form>

	{#if data.unavailable}
		<p class="mt-error" role="alert">The forum is unavailable right now. Try again.</p>
	{:else if data.threads.length === 0}
		<p class="mt-count-bar">No threads yet.</p>
	{:else}
		<div class="mt-index-table">
			<div class="mt-index-head mt-topic-row">
				<span>Topic</span><span>Category</span><span>Course</span>
			</div>
			{#each data.threads as thread (thread.id)}
				<a class="mt-topic-row" href={`/tools/forum/${thread.id}`}>
					<div>
						<h2>{thread.title}</h2>
						<p>{thread.category}{thread.courseCode ? ` · ${thread.courseCode}` : ''}</p>
					</div>
					<span>{thread.category}</span>
					<span>{thread.courseCode ?? 'General'}</span>
				</a>
			{/each}
		</div>
	{/if}

	{#if data.signedIn}
		<section class="mt-panel">
			<h2>Start a thread</h2>
			<form method="POST" action="?/create" class="mt-stack">
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
				<button type="submit" class="mt-primary-button">Post thread</button>
			</form>
			{#if form?.error}
				<p class="mt-error" role="alert">{form.error}</p>
			{/if}
		</section>
	{:else}
		<p class="mt-panel"><a href="/tools/account">Sign in with Google</a> to post.</p>
	{/if}
</section>

<style>
	.forum-intro {
		margin: 0;
		padding: 0.75rem clamp(1.25rem, 3vw, 3rem) 0;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		max-width: 52ch;
	}

	.forum-titlebar {
		border-bottom: 1px solid var(--midnight);
	}
</style>
