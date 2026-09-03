<script>
	import { resolve } from '$app/paths';
	export let data;
	const yearLabels = { first: 'First year', second: 'Second year', third: 'Third year' };
	$: memberName =
		[data.member?.firstName, data.member?.lastName].filter(Boolean).join(' ') ||
		data.member?.displayName;
</script>

<svelte:head><title>Member | Programming Club Team</title></svelte:head>
{#if data.unavailable}<p role="alert">Member details are unavailable right now.</p>
{:else if data.member}
	<section class="member-detail">
		<a class="back-link" href={resolve('/staff/members', {})}>Back to members</a>
		<header class="member-heading">
			{#if data.member.profileImageDataUrl}<img
				class="profile-picture"
				src={data.member.profileImageDataUrl}
				alt={`${memberName}'s profile`}
			/>{/if}
			<div>
				<p class="eyebrow">Programming Club member</p>
				<h1>{memberName}</h1>
				{#if data.member.username}<p class="username">@{data.member.username}</p>{/if}
			</div>
		</header>
		<dl>
			<dt>First name</dt>
			<dd>{data.member.firstName}</dd>
			<dt>Last name</dt>
			<dd>{data.member.lastName}</dd>
			<dt>Email</dt>
			<dd>{data.member.email}</dd>
			<dt>Student number</dt>
			<dd>{data.member.studentId}</dd>
			<dt>Program</dt>
			<dd>{data.member.program}</dd>
			<dt>Current year</dt>
			<dd>{yearLabels[data.member.yearLevel] ?? data.member.yearLevel}</dd>
			<dt>Experience</dt>
			<dd>{data.member.experienceLevel}</dd>
			<dt>Interests</dt>
			<dd>{data.member.interests.join(', ')}</dd>
			<dt>What they want from the club</dt>
			<dd>{data.member.clubGoals}</dd>
		</dl>
		<h2>Imported schedule</h2>
		{#if !data.member.scheduleSharedAt}<p>This member has not imported a schedule.</p>
		{:else if data.member.scheduleInvalid}<p>The imported schedule needs a valid Omnivox import.</p>
		{:else}<div class="course-list">
				{#each data.member.courses as course (`${course.code}-${course.section ?? ''}`)}<article>
						<h3>{course.code}: {course.title}</h3>
						{#if course.meetings?.length}<ul>
								{#each course.meetings as meeting (`${meeting.weekday}-${meeting.startTime}-${meeting.endTime}`)}<li
									>
										{meeting.weekday}, {meeting.startTime} to {meeting.endTime}
									</li>{/each}
							</ul>{/if}
					</article>{/each}
			</div>{/if}
	</section>
{/if}

<style>
	.member-detail {
		max-width: 72rem;
		margin: 0 auto;
		padding: 3rem var(--page-gutter) 5rem;
	}
	.back-link {
		display: inline-block;
		margin-bottom: 2rem;
		color: var(--club-blue);
		font-weight: 700;
	}
	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--club-blue);
		font-size: 0.75rem;
		font-weight: 750;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h1 {
		max-width: 14ch;
		margin: 0;
		font-size: clamp(2.75rem, 7vw, 6rem);
		line-height: 0.9;
		letter-spacing: -0.055em;
	}
	.member-heading {
		display: flex;
		align-items: end;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}
	.profile-picture {
		width: clamp(6rem, 12vw, 9rem);
		aspect-ratio: 1;
		object-fit: cover;
		border: var(--rule-strong);
	}
	.username {
		margin: 0.6rem 0 0;
		color: var(--color-muted);
		font-weight: 700;
	}
	dl {
		display: grid;
		grid-template-columns: minmax(9rem, 0.45fr) 1fr;
		margin: 0 0 3rem;
		border-top: var(--rule-strong);
	}
	dt,
	dd {
		margin: 0;
		padding: 0.85rem 0;
		border-bottom: var(--rule);
	}
	dt {
		color: var(--color-muted);
		font-size: 0.8rem;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	dd {
		font-weight: 650;
	}
	h2 {
		margin-top: 0;
		font-size: 1.75rem;
	}
	.course-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0.75rem;
	}
	.course-list article {
		padding: 1rem;
		border: var(--rule-strong);
		background: #fff;
	}
	.course-list h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
	}
	.course-list ul {
		margin: 0;
		padding-left: 1.2rem;
		color: var(--color-muted);
	}
</style>
