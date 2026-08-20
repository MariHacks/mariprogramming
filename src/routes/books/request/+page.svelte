<script>
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { createClubContactLinks } from '$lib/club-contact.js';

	let { data, form } = $props();

	const contact = $derived(data.contact ?? createClubContactLinks());
	const teachers = $derived(data.teachers ?? []);
	const courses = $derived(data.courses ?? []);
	const fields = $derived(new Set(/** @type {any} */ (form)?.fields ?? []));

	let interactive = $state(false);
	let teacherChoice = $state('');
	let courseChoice = $state('');
	const showTeacherOther = $derived(!interactive || teacherChoice === 'other');
	const showCourseOther = $derived(!interactive || courseChoice === 'other');

	onMount(() => {
		interactive = true;
	});
</script>

<svelte:head>
	<title>Request a book | Marianopolis Programming Club</title>
</svelte:head>

<section class="page-shell request-page" aria-labelledby="request-heading">
	<p class="section-kicker">Book Delivery</p>
	<h1 id="request-heading">Request a book we do not carry</h1>
	<p class="lede">
		Tell us the teacher, course, and titles. Attach a course outline if you have one. Questions:
		<a href={contact.inquiry.href}>{contact.inquiry.label}</a>
		or
		<a href={contact.bug.href}>{contact.bug.label}</a>.
	</p>

	{#if data.unavailable}
		<p class="form-error" role="alert">Book requests are unavailable right now. Try again later.</p>
	{:else}
		{#if form?.errorSummary}
			<p class="form-error" role="alert">{form.errorSummary}</p>
		{/if}

		<form
			class="request-form"
			method="POST"
			action="?/submit"
			enctype="multipart/form-data"
			use:enhance
		>
			<input type="hidden" name="clientRequestId" value={data.clientRequestId} />

			<label class="field">
				<span>Your name</span>
				<input
					type="text"
					name="name"
					autocomplete="name"
					maxlength="160"
					required
					aria-invalid={fields.has('name') ? 'true' : undefined}
				/>
			</label>

			<label class="field">
				<span>Email</span>
				<input
					type="email"
					name="email"
					autocomplete="email"
					maxlength="320"
					required
					aria-invalid={fields.has('email') ? 'true' : undefined}
				/>
			</label>

			<fieldset class="choice-fieldset">
				<legend>Teacher</legend>
				<label class="field">
					<span>Catalogue teacher</span>
					<select
						name="teacher"
						bind:value={teacherChoice}
						aria-invalid={fields.has('teacher') ? 'true' : undefined}
					>
						<option value="">Select a teacher</option>
						{#each teachers as teacher (teacher.id)}
							<option value={teacher.id}>{teacher.name}</option>
						{/each}
						<option value="other">Other</option>
					</select>
				</label>
				<label class="field" hidden={!showTeacherOther}>
					<span>Other teacher</span>
					<input
						type="text"
						name="teacherOther"
						maxlength="160"
						required={teacherChoice === 'other'}
					/>
				</label>
			</fieldset>

			<fieldset class="choice-fieldset">
				<legend>Course</legend>
				<label class="field">
					<span>Catalogue course</span>
					<select
						name="course"
						bind:value={courseChoice}
						aria-invalid={fields.has('course') ? 'true' : undefined}
					>
						<option value="">Select a course</option>
						{#each courses as course (course.id)}
							<option value={course.id}>{course.code}: {course.title}</option>
						{/each}
						<option value="other">Other</option>
					</select>
				</label>
				<label class="field" hidden={!showCourseOther}>
					<span>Other course</span>
					<input
						type="text"
						name="courseOther"
						maxlength="200"
						required={courseChoice === 'other'}
					/>
				</label>
			</fieldset>

			{#each [1, 2, 3, 4, 5] as index (index)}
				<fieldset class="book-fieldset">
					<legend>Book {index}{index === 1 ? '' : ' (optional)'}</legend>
					<label class="field">
						<span>Title</span>
						<input
							type="text"
							name="title"
							maxlength="240"
							required={index === 1}
							aria-invalid={fields.has('title') ? 'true' : undefined}
						/>
					</label>
					<label class="field">
						<span>Author</span>
						<input type="text" name="author" maxlength="200" />
					</label>
					<label class="field">
						<span>ISBN</span>
						<input type="text" name="isbn" maxlength="32" />
					</label>
					<label class="field">
						<span>Quantity</span>
						<input type="number" name="quantity" min="1" max="20" value="1" />
					</label>
				</fieldset>
			{/each}

			<label class="field">
				<span>Note (optional)</span>
				<textarea name="notes" maxlength="1000" rows="4"></textarea>
			</label>

			<label class="field">
				<span>Course outline PDF (optional, 2 MB max)</span>
				<input type="file" name="outline" accept="application/pdf,.pdf" />
			</label>

			<button class="button button-solid" type="submit">Submit request</button>
		</form>
	{/if}
</section>

<style>
	.request-page {
		display: grid;
		gap: 1.25rem;
		padding-block: 2.5rem 4rem;
	}

	.request-form,
	.choice-fieldset,
	.book-fieldset {
		display: grid;
		gap: 1rem;
	}

	.choice-fieldset,
	.book-fieldset {
		margin: 0;
		padding: 1rem 0 0;
		border: 0;
		border-top: var(--rule);
	}

	.field {
		display: grid;
		gap: 0.4rem;
		color: var(--color-muted);
		font-size: 0.92rem;
	}

	.field input,
	.field select,
	.field textarea {
		min-height: 2.75rem;
		padding: 0.7rem 0.85rem;
		border: var(--rule-strong);
		border-radius: 0;
		background: var(--paper);
		color: var(--color-text);
		font: inherit;
	}

	.form-error {
		color: var(--danger);
		font-size: 0.9rem;
	}
</style>
