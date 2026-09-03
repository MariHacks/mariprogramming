<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ModerationDurationDialog from '$lib/maritools/ModerationDurationDialog.svelte';
	export let data;
	/** @type {any} */
	export let form = null;
	/** @type {'mute' | 'ban' | null} */
	let durationPrompt = null;
	$: memberName =
		[data.member?.firstName, data.member?.lastName].filter(Boolean).join(' ') ||
		data.member?.displayName;
	$: roleLabel = roleName(data.member?.role);

	/** @param {unknown} role */
	function roleName(role) {
		if (role === 'moderator') return 'Executive';
		if (role === 'staff') return 'Protected account';
		return 'Member';
	}

	/** @param {unknown} year */
	function yearName(year) {
		if (year === 'first') return 'First year';
		if (year === 'second') return 'Second year';
		if (year === 'third') return 'Third year';
		return String(year ?? '');
	}

	/** @param {Date | string | null | undefined} value */
	function dateLabel(value) {
		if (!value) return '';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat('en-CA', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	/** @param {HTMLFormElement} node */
	function enhanceDurationForm(node) {
		return enhance(node);
	}
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
				<p class="role-badge">{roleLabel}</p>
			</div>
		</header>
		{#if form?.error}<p class="control-error" role="alert">{form.error}</p>{/if}
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
			<dd>{yearName(data.member.yearLevel)}</dd>
			<dt>Experience</dt>
			<dd>{data.member.experienceLevel}</dd>
			<dt>Interests</dt>
			<dd>{data.member.interests.join(', ')}</dd>
			<dt>What they want from the club</dt>
			<dd>{data.member.clubGoals}</dd>
		</dl>
		<section class="member-controls" aria-labelledby="member-controls-title">
			<header>
				<p class="eyebrow">Moderation</p>
				<h2 id="member-controls-title">Member controls</h2>
			</header>
			{#if data.member.role === 'staff'}
				<p class="protected-note">This protected account cannot be changed.</p>
			{:else}
				<div class="control-group">
					<div>
						<h3>Club role</h3>
						<p>{roleLabel}</p>
					</div>
					{#if data.member.role === 'moderator'}
						<form method="POST" action="?/demoteMember" use:enhance>
							<button type="submit" class="secondary-button">Demote to member</button>
						</form>
					{:else}
						<form method="POST" action="?/promoteExecutive" use:enhance>
							<button type="submit" class="primary-button">Promote to executive</button>
						</form>
					{/if}
				</div>
				<div class="control-group">
					<div>
						<h3>Posting</h3>
						<p>
							{#if data.member.isMuted}
								Muted until {dateLabel(data.member.mutedUntil)}
							{:else}
								Can post and reply
							{/if}
						</p>
					</div>
					{#if data.member.isMuted}
						<form method="POST" action="?/unmute" use:enhance>
							<button type="submit" class="secondary-button">Unmute</button>
						</form>
					{:else}
						<button
							type="button"
							class="secondary-button"
							on:click={() => (durationPrompt = 'mute')}>Mute</button
						>
					{/if}
				</div>
				<div class="control-group danger-control">
					<div>
						<h3>Account access</h3>
						<p>
							{#if data.member.isBanned}
								{data.member.bannedPermanent
									? 'Banned permanently'
									: `Banned until ${dateLabel(data.member.bannedUntil)}`}
							{:else}
								Account is active
							{/if}
						</p>
					</div>
					{#if data.member.isBanned}
						<form method="POST" action="?/unban" use:enhance>
							<button type="submit" class="secondary-button">Unban</button>
						</form>
					{:else}
						<button type="button" class="danger-button" on:click={() => (durationPrompt = 'ban')}
							>Ban</button
						>
					{/if}
				</div>
			{/if}
		</section>
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

{#if durationPrompt}
	<ModerationDurationDialog
		kind={durationPrompt}
		formaction={durationPrompt === 'mute' ? '?/mute' : '?/ban'}
		title={durationPrompt === 'mute' ? 'Mute duration' : 'Ban duration'}
		confirmLabel={durationPrompt === 'mute' ? 'Confirm mute' : 'Confirm ban'}
		idPrefix={`member-${durationPrompt}`}
		onCancel={() => (durationPrompt = null)}
		enhance={enhanceDurationForm}
	/>
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
	.role-badge {
		display: inline-flex;
		margin: 0.75rem 0 0;
		padding: 0.4rem 0.65rem;
		border: var(--rule-strong);
		background: #edf4ff;
		font-size: 0.82rem;
		font-weight: 800;
	}
	.control-error {
		padding: 0.85rem 1rem;
		border: 1px solid #c73b4a;
		background: #fff5f6;
		color: #9d2936;
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
	.member-controls {
		margin-bottom: 3rem;
		border: var(--rule-strong);
		background: #fff;
	}
	.member-controls > header {
		padding: 1.25rem 1.5rem;
		border-bottom: var(--rule-strong);
	}
	.member-controls h2,
	.member-controls h3,
	.member-controls p {
		margin: 0;
	}
	.control-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		min-height: 6rem;
		padding: 1rem 1.5rem;
		border-bottom: var(--rule);
	}
	.control-group:last-child {
		border-bottom: 0;
	}
	.control-group h3 {
		font-size: 1rem;
	}
	.control-group p,
	.protected-note {
		margin-top: 0.35rem;
		color: var(--color-muted);
	}
	.protected-note {
		padding: 1.5rem;
	}
	.primary-button,
	.secondary-button,
	.danger-button {
		min-height: 2.75rem;
		padding: 0.65rem 1rem;
		border: var(--rule-strong);
		background: #fff;
		font: inherit;
		font-weight: 750;
		cursor: pointer;
	}
	.primary-button {
		border-color: var(--club-blue);
		background: var(--club-blue);
		color: #fff;
	}
	.danger-button {
		border-color: #c73b4a;
		color: #9d2936;
	}
	@media (max-width: 40rem) {
		.control-group {
			align-items: flex-start;
			flex-direction: column;
		}
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
