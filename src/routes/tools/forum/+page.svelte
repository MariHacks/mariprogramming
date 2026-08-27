<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';

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

	/** @param {string} category */
	function categoryLabel(category) {
		if (category === 'courses') return 'Course help';
		if (category === 'student-life') return 'Student life';
		return category;
	}

	/** @param {string | Date | null | undefined} value */
	function formatWhen(value) {
		if (!value) return '';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleString(undefined, { month: 'short', day: 'numeric' });
	}

	/** @param {{ body?: string, category?: string }} thread */
	function threadPreview(thread) {
		const body = String(thread.body ?? '')
			.replace(/\s+/gu, ' ')
			.trim();
		return body || categoryLabel(thread.category ?? '');
	}
</script>

<svelte:head>
	<title>Forum | {MARITOOLS_NAME}</title>
	<meta name="description" content="Read student threads. Sign in to post." />
</svelte:head>

<div class="mt-preview">
	<section class="page page-forum">
		<header class="forum-titlebar">
			<div>
				<h1>Forum</h1>
			</div>
			<nav class="forum-tabs" aria-label="Forum categories">
				<a href={tabHref('')} class:is-active={!data.category}>Latest</a>
				<a href={tabHref('courses')} class:is-active={data.category === 'courses'}>Courses</a>
				<a href={tabHref('student-life')} class:is-active={data.category === 'student-life'}
					>Student life</a
				>
			</nav>
		</header>

		<form method="GET" class="forum-toolbar">
			<input type="hidden" name="category" value={data.category} />
			<label class="search-field">
				<span>⌕</span>
				<input name="q" value={data.query ?? ''} placeholder="Search discussions" />
			</label>
			<label>
				<span>Course</span>
				<select name="course" aria-label="Filter by course">
					<option value="">Every course</option>
					{#each data.courses as course (course.id)}
						<option value={course.id} selected={data.courseId === course.id}>
							{course.code} {course.title}
						</option>
					{/each}
				</select>
			</label>
			{#if data.signedIn}
				<a class="primary-button" href="#composer">Start a thread</a>
			{:else}
				<a class="primary-button" href="/tools/account">Sign in with Google</a>
			{/if}
		</form>

		{#if data.unavailable}
			<p class="field-error" role="alert">The forum is unavailable right now. Try again.</p>
		{:else if data.threads.length === 0}
			<p class="catalog-count">No threads yet.</p>
		{:else}
			<div class="topic-list">
				<div class="topic-head">
					<span>Topic</span><span>Category</span><span>Course</span><span>Replies</span><span>Latest</span>
				</div>
				{#each data.threads as thread (thread.id)}
					<a class="topic-row" href={`/tools/forum/${thread.id}`}>
						<div>
							<h2>{thread.title}</h2>
							<p>{threadPreview(thread)}</p>
						</div>
						<span>{categoryLabel(thread.category)}</span>
						<span class:course-chip={Boolean(thread.courseCode)}>{thread.courseCode ?? 'General'}</span>
						<strong>-</strong>
						<time>{formatWhen(thread.createdAt)}</time>
					</a>
				{/each}
			</div>
		{/if}

		{#if !data.unavailable}
			{#if data.signedIn}
			<section class="inline-composer" id="composer">
				<div class="composer-heading">
					<div>
						<span class="composer-avatar">YO</span>
						<div>
							<span>New discussion</span>
							<h2>Start a thread</h2>
						</div>
					</div>
				</div>
				<form method="POST" action="?/create">
					<div class="composer-fields">
						<label>
							<span>Title</span>
							<input name="title" required maxlength="240" placeholder="What do you want to ask or share?" />
						</label>
						<div class="composer-meta">
							<label>
								<span>Category</span>
								<select name="category" required>
									<option value="courses">Course help</option>
									<option value="student-life">Student life</option>
								</select>
							</label>
							<label>
								<span>Course tag</span>
								<select name="courseId">
									<option value="">No course tag</option>
									{#each data.courses as course (course.id)}
										<option value={course.id}>{course.code} {course.title}</option>
									{/each}
								</select>
							</label>
						</div>
						<label>
							<span>Body</span>
							<textarea
								name="body"
								rows="6"
								required
								maxlength="20000"
								placeholder="Include enough context for another student to help."
							></textarea>
						</label>
					</div>
					<div class="composer-actions">
						<p>Be kind. Do not post student numbers or private course files.</p>
						<button type="submit" class="primary-button">Post thread</button>
					</div>
				</form>
				{#if form?.error}
					<p class="field-error" role="alert">{form.error}</p>
				{/if}
			</section>
			{:else}
			<section class="inline-composer">
				<div class="composer-heading">
					<div>
						<span class="composer-avatar">?</span>
						<div>
							<span>New discussion</span>
							<h2>Start a thread</h2>
						</div>
					</div>
				</div>
				<p>Read threads without an account. Sign in with Google to post.</p>
				<a class="primary-button" href="/tools/account">Sign in with Google</a>
			</section>
			{/if}
		{/if}
	</section>
</div>
