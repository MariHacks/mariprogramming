<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import OmnivoxTutorialOverlay from '$lib/maritools/components/OmnivoxTutorialOverlay.svelte';
	import ScheduleCalendar from '$lib/maritools/components/ScheduleCalendar.svelte';
	import { initialsFromDisplayName } from '$lib/maritools/header-account.js';
	import { mondayOfWeek, weekGridForTermWeek } from '$lib/maritools/schedule/academicWeekView.js';
	import { parseOmnivox } from '$lib/maritools/schedule/parseOmnivox.js';
	import { calendarDate, rulesForTerm } from '$lib/maritools/term/calendar.js';
	import { termResolution } from '$lib/maritools/term/session.js';
	import { requestStudentAuthorization } from '$lib/auth/student-sign-in.js';
	import { endStaffSession } from '$lib/auth/staff-sign-out.js';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';

	export let data;
	/** @type {{ error?: string, success?: boolean, joined?: boolean, onboardingComplete?: boolean, invalidTab?: string } | null} */
	export let form = null;

	let pending = false;
	let failed = false;
	let signInError = '';
	let signOutFailed = false;
	let editingProfile = false;
	let profileTab = 'information';
	let profileImageName = '';
	let username = data.onboardingDraft?.username ?? data.view.username ?? '';
	let firstName = data.onboardingDraft?.firstName ?? data.view.firstName ?? '';
	let lastName = data.onboardingDraft?.lastName ?? data.view.lastName ?? '';
	let studentId = data.onboardingDraft?.studentId ?? '';
	let program = data.onboardingDraft?.program ?? '';
	let yearLevel = data.onboardingDraft?.yearLevel ?? '';
	let experienceLevel = data.onboardingDraft?.experienceLevel ?? '';
	let interests = data.onboardingDraft?.interests ?? [];
	let clubGoals = data.onboardingDraft?.clubGoals ?? '';
	let schedulePaste = data.onboardingDraft?.paste ?? '';
	let interestError = false;
	let memberFormOpened = false;
	let scheduleTutorialOpen = false;
	let scheduleWeekStartIso = mondayOfWeek(calendarDate());
	let draftReady = false;
	const signupDraftKey = `programming-club-signup-draft:${data.view.email ?? 'signed-out'}`;

	const fallbackPrograms = [
		'Arts and Sciences',
		'Arts, Literature and Communication',
		'Liberal Arts',
		'Music',
		'Science, Health Science',
		'Science, Honours Health Science',
		'Science, Pure and Applied Science',
		'Science, Honours Pure and Applied Science',
		'Social Science, Core',
		'Social Science, Commerce',
		'Social Science, Human Behaviour',
		'Social Science, Law, Society and Justice',
		'Double DEC, Music and Science',
		'Double DEC, Music and Social Science'
	];
	const interestOptions = data.clubInterests ?? [
		'algorithms',
		'games',
		'hardware',
		'open-source',
		'web',
		'workshops'
	];
	const programOptions = data.programs ?? fallbackPrograms;
	const validYearLevels = data.yearLevels ?? ['first', 'second', 'third'];
	const validExperienceLevels = ['new', 'learning', 'comfortable', 'advanced'];

	/** @type {Record<string, string>} */
	const yearLabels = {
		first: 'First year',
		second: 'Second year',
		third: 'Third year'
	};

	/** @param {string} email */
	function labelFromEmail(email) {
		return email.split('@')[0] || 'Account';
	}

	/** @param {string} callbackURL */
	function googleSignInUnavailableMessage(callbackURL) {
		if (URL.canParse(callbackURL)) {
			const host = new URL(callbackURL).hostname;
			if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
				return 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local to a real Google Cloud OAuth web client, then restart the dev server.';
			}
		}
		return 'Google sign-in is not configured on this site.';
	}

	async function beginSignIn() {
		if (pending || data.googleSignInConfigured === false) return;
		pending = true;
		failed = false;
		signInError = '';
		try {
			const authorizationUrl = await requestStudentAuthorization(data.callbackURL);
			globalThis.location.assign(authorizationUrl);
		} catch (error) {
			pending = false;
			failed = true;
			if (error instanceof Error && error.message === 'Google sign-in is not configured') {
				signInError = googleSignInUnavailableMessage(data.callbackURL);
			} else {
				signInError = 'Sign-in is unavailable. Try again.';
			}
		}
	}

	async function signOut() {
		if (pending) return;
		pending = true;
		signOutFailed = false;
		try {
			await endStaffSession();
			globalThis.location.assign('/tools/account');
		} catch {
			pending = false;
			signOutFailed = true;
		}
	}

	/** @param {Event} event */
	function chooseProfileImage(event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		profileImageName = input.files?.[0]?.name ?? '';
	}

	function beginProfileEdit() {
		username = data.view.username ?? '';
		firstName = data.view.firstName ?? '';
		lastName = data.view.lastName ?? '';
		profileImageName = '';
		editingProfile = true;
	}

	function cancelProfileEdit() {
		username = data.view.username ?? '';
		firstName = data.view.firstName ?? '';
		lastName = data.view.lastName ?? '';
		profileImageName = '';
		editingProfile = false;
	}

	function fullName() {
		const joined = [data.view.firstName, data.view.lastName]
			.filter((part) => typeof part === 'string' && part.trim())
			.join(' ');
		return joined || data.view.displayName || labelFromEmail(data.view.email ?? '');
	}

	function profileUsername() {
		const value = String(data.view.username ?? '').trim();
		return value || labelFromEmail(data.view.email ?? '');
	}

	function membershipRole() {
		return ['executive', 'staff', 'moderator'].includes(data.communityProfile?.role)
			? 'Executive'
			: 'Member';
	}

	function membershipLine() {
		const since = monthYear(data.communityProfile?.joinedAt);
		return since ? `${membershipRole()} since ${since}` : membershipRole();
	}

	/** @param {string | Date | null | undefined} value */
	function monthYear(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
	}

	/** @param {string | Date | null | undefined} value */
	function shortDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
	}

	/** @param {string | null | undefined} value */
	function categoryLabel(value) {
		if (value === 'student-life') return 'Student life';
		if (value === 'courses') return 'Course help';
		return value || 'Discussion';
	}

	/** @param {any} outline */
	function outlineCode(outline) {
		return outline.courseCode ?? outline.extraction?.proposals?.courseCode ?? 'Course';
	}

	/** @param {any} outline */
	function outlineTitle(outline) {
		return outline.title ?? outline.extraction?.proposals?.title ?? 'Untitled outline';
	}

	/** @param {any} draft */
	function restoreSignupDraft(draft) {
		if (
			['information', 'interests', 'schedule', 'member-form'].includes(String(draft.profileTab))
		) {
			profileTab = String(draft.profileTab);
		}
		username = typeof draft.username === 'string' ? draft.username : '';
		firstName = typeof draft.firstName === 'string' ? draft.firstName : '';
		lastName = typeof draft.lastName === 'string' ? draft.lastName : '';
		studentId = typeof draft.studentId === 'string' ? draft.studentId : '';
		program = typeof draft.program === 'string' ? draft.program : '';
		yearLevel = typeof draft.yearLevel === 'string' ? draft.yearLevel : '';
		experienceLevel = typeof draft.experienceLevel === 'string' ? draft.experienceLevel : '';
		interests = Array.isArray(draft.interests)
			? draft.interests.filter((/** @type {unknown} */ interest) => typeof interest === 'string')
			: [];
		clubGoals = typeof draft.clubGoals === 'string' ? draft.clubGoals : '';
		schedulePaste = typeof draft.schedulePaste === 'string' ? draft.schedulePaste : '';
		memberFormOpened = draft.memberFormOpened === true;
	}

	function tryPersistSignupDraft() {
		if (!browser || !draftReady) return;
		try {
			localStorage.setItem(
				signupDraftKey,
				JSON.stringify({
					profileTab,
					username,
					firstName,
					lastName,
					studentId,
					program,
					yearLevel,
					experienceLevel,
					interests,
					clubGoals,
					schedulePaste,
					memberFormOpened
				})
			);
		} catch {
			return;
		}
	}

	/** @param {MouseEvent} event */
	async function submitSignup(event) {
		const button = event.currentTarget;
		if (!(button instanceof HTMLButtonElement)) return;
		const signupForm = button.form;
		if (!signupForm) return;
		const invalidField = signupForm.querySelector(':invalid');
		if (invalidField instanceof HTMLElement) {
			const panel = invalidField.closest('[data-signup-tab]');
			if (panel instanceof HTMLElement) profileTab = panel.dataset.signupTab ?? profileTab;
			await tick();
			signupForm.reportValidity();
			return;
		}
		if (interests.length === 0) {
			interestError = true;
			profileTab = 'interests';
			await tick();
			const firstInterest = signupForm.querySelector('.profile-interests input');
			if (firstInterest instanceof HTMLElement) firstInterest.focus();
			return;
		}
		signupForm.requestSubmit();
	}

	onMount(() => {
		if (form?.onboardingComplete || data.club?.kind?.startsWith('joined_')) {
			localStorage.removeItem(signupDraftKey);
			return;
		}
		try {
			const savedDraft = localStorage.getItem(signupDraftKey);
			if (savedDraft) restoreSignupDraft(JSON.parse(savedDraft));
		} catch {
			localStorage.removeItem(signupDraftKey);
		}
		if (
			form?.invalidTab &&
			['information', 'interests', 'schedule', 'member-form'].includes(form.invalidTab)
		) {
			profileTab = form.invalidTab;
		}
		draftReady = true;
	});

	$: scheduleResult = schedulePaste.trim() ? parseOmnivox(schedulePaste) : null;
	$: scheduleTerm = $termResolution.selected;
	$: scheduleRules = scheduleTerm ? rulesForTerm(scheduleTerm.id) : null;
	$: scheduleGrid =
		scheduleTerm && scheduleRules
			? weekGridForTermWeek(
					scheduleWeekStartIso,
					scheduleTerm,
					scheduleRules,
					scheduleResult?.ok ? scheduleResult.courses : []
				)
			: [];
	$: if (draftReady) {
		profileTab;
		username;
		firstName;
		lastName;
		studentId;
		program;
		yearLevel;
		experienceLevel;
		interests;
		clubGoals;
		schedulePaste;
		memberFormOpened;
		tryPersistSignupDraft();
	}
	$: informationIsValid =
		username.length >= 3 &&
		username.length <= 24 &&
		/^[A-Za-z0-9_]+$/.test(username) &&
		firstName.trim().length > 0 &&
		firstName.length <= 80 &&
		lastName.trim().length > 0 &&
		lastName.length <= 80 &&
		(data.club?.kind === 'needs_required_form'
			? studentId.trim().length === 0 || /^\d{5,8}$/.test(studentId)
			: /^\d{5,8}$/.test(studentId)) &&
		programOptions.includes(program) &&
		validYearLevels.includes(yearLevel);
	$: interestsAreValid =
		validExperienceLevels.includes(experienceLevel) &&
		interests.length > 0 &&
		interests.every((/** @type {string} */ interest) => interestOptions.includes(interest)) &&
		clubGoals.length <= 1000;
	$: scheduleIsValid =
		schedulePaste.length <= 100000 &&
		(schedulePaste.trim().length === 0 || parseOmnivox(schedulePaste).ok);
	$: signupIsReady = informationIsValid && interestsAreValid && scheduleIsValid && memberFormOpened;
	$: signupBlockedMessage = !memberFormOpened
		? ''
		: !informationIsValid || !interestsAreValid
			? 'Complete all required fields before joining.'
			: !scheduleIsValid
				? 'Fix or remove the schedule paste before joining.'
				: '';

	function closeScheduleTutorial() {
		scheduleTutorialOpen = false;
	}
</script>

<svelte:head>
	<title>Your profile | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Manage your Programming Club membership and MariTools account."
	/>
</svelte:head>

<div class="mt-preview">
	<section
		class="page page-account profile-page"
		class:profile-page--guest={data.view.kind === 'guest'}
	>
		{#if data.view.kind === 'guest'}
			<header class="profile-hero profile-hero--guest">
				<div class="profile-hero__copy">
					<h1>Sign in to the Programming Club</h1>
					<p>Join the Programming Club and manage your schedule with your Google account.</p>
					<p class="profile-time">Plan for about 5 minutes.</p>
					{#if data.googleSignInConfigured === false}
						<p class="field-error" role="alert">
							{googleSignInUnavailableMessage(data.callbackURL)}
						</p>
					{:else}
						<form on:submit|preventDefault={beginSignIn}>
							<button type="submit" class="primary-button profile-google" disabled={pending}>
								Continue with Google
							</button>
						</form>
						{#if pending}<p role="status">Opening Google sign-in</p>{/if}
						{#if failed}<p class="field-error" role="alert">{signInError}</p>{/if}
					{/if}
				</div>
			</header>
		{:else if data.club?.kind === 'needs_club_details' || data.view.kind === 'incomplete'}
			<header class="profile-hero profile-hero--member">
				<div class="profile-identity">
					<span class="profile-avatar">
						{initialsFromDisplayName(labelFromEmail(data.view.email ?? ''))}
					</span>
					<div>
						<h1>Finish your club profile</h1>
						<p>{data.view.email}</p>
					</div>
				</div>
				<div class="profile-session">
					<button class="quiet-button" type="button" on:click={signOut} disabled={pending}
						>Sign out</button
					>
				</div>
			</header>
		{:else if data.club?.kind === 'needs_required_form'}
			<header class="profile-hero profile-hero--member">
				<div class="profile-identity">
					<span class="profile-avatar">
						{#if data.view.profileImageDataUrl}
							<img
								src={data.view.profileImageDataUrl}
								alt={`${data.view.displayName ?? 'Member'} profile picture`}
							/>
						{:else}{initialsFromDisplayName(
								data.view.displayName ?? labelFromEmail(data.view.email ?? '')
							)}{/if}
					</span>
					<div>
						<h1>Complete signup</h1>
						<strong>{data.view.displayName ?? labelFromEmail(data.view.email ?? '')}</strong>
						<p>{data.view.email}</p>
					</div>
				</div>
				<div class="profile-session">
					<button class="quiet-button" type="button" on:click={signOut} disabled={pending}
						>Sign out</button
					>
				</div>
			</header>
		{:else}
			<header class="community-profile-hero">
				{#if editingProfile}
					<form
						class="community-profile-edit"
						method="POST"
						action="?/updateProfile"
						enctype="multipart/form-data"
						aria-label="Edit profile"
					>
						<label class="community-avatar community-avatar--editable">
							<span class="community-avatar__image">
								{#if data.view.profileImageDataUrl}
									<img src={data.view.profileImageDataUrl} alt="" />
								{:else}
									{initialsFromDisplayName(fullName())}
								{/if}
							</span>
							<span class="community-avatar__action">Change photo</span>
							<input
								type="file"
								name="profileImage"
								accept="image/jpeg,image/png,image/webp,image/gif"
								aria-label="Change profile picture"
								on:change={chooseProfileImage}
							/>
							{#if profileImageName}<small>{profileImageName}</small>{/if}
						</label>
						<div class="community-edit-fields">
							<label>
								<span>Username</span>
								<input
									name="username"
									bind:value={username}
									required
									minlength="3"
									maxlength="24"
									pattern="[A-Za-z0-9_]+"
								/>
							</label>
							<div>
								<label>
									<span>First name</span>
									<input name="firstName" bind:value={firstName} required maxlength="80" />
								</label>
								<label>
									<span>Last name</span>
									<input name="lastName" bind:value={lastName} required maxlength="80" />
								</label>
							</div>
						</div>
						<div class="community-profile-actions">
							<button class="quiet-button" type="button" on:click={cancelProfileEdit}>Cancel</button
							>
							<button class="dark-button" type="submit">Save profile</button>
						</div>
					</form>
				{:else}
					<div class="community-profile-identity">
						<span class="community-avatar">
							{#if data.view.profileImageDataUrl}
								<img src={data.view.profileImageDataUrl} alt={`${fullName()} profile picture`} />
							{:else}
								{initialsFromDisplayName(fullName())}
							{/if}
						</span>
						<div>
							<h1>{profileUsername()}</h1>
							<p class="community-full-name">{fullName()}</p>
							<p class="community-membership">{membershipLine()}</p>
						</div>
					</div>
					<div class="community-profile-actions">
						<button class="primary-button" type="button" on:click={beginProfileEdit}>
							<svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
								<path d="M3 11.5V13h1.5l7.7-7.7-1.5-1.5L3 11.5Z" />
								<path d="m9.8 4.7 1.5 1.5" />
							</svg>
							Edit profile
						</button>
						<button class="quiet-button" type="button" on:click={signOut} disabled={pending}>
							<svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
								<path d="M6.5 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.5" />
								<path d="M8 8h5M11 5l3 3-3 3" />
							</svg>
							Sign out
						</button>
					</div>
				{/if}
			</header>
		{/if}

		{#if data.recoveryMessage || data.unavailable || form?.error || form?.success || signOutFailed}
			<div class="profile-alerts" aria-live="polite">
				{#if data.recoveryMessage}
					<p class="field-error" role="alert">{data.recoveryMessage}</p>
				{/if}
				{#if data.unavailable}
					<p class="field-error" role="alert">
						Account details are unavailable right now. Try again.
					</p>
				{/if}
				{#if form?.error}
					<p class="field-error" role="alert">{form.error}</p>
				{/if}
				{#if form?.success}
					<p class="profile-success" role="status">Account saved.</p>
				{/if}
				{#if signOutFailed}
					<p class="field-error" role="alert">Sign out is unavailable. Try again.</p>
				{/if}
			</div>
		{/if}

		{#if data.view.kind === 'guest'}{:else if data.club?.kind === 'needs_club_details' || data.club?.kind === 'needs_required_form' || data.view.kind === 'incomplete'}
			<div class="profile-enrollment">
				<section class="profile-form" aria-labelledby="club-registration-title">
					<div class="profile-section-head">
						<h2 id="club-registration-title">Join the Programming Club</h2>
						<p>Set up your member profile, then tell us what you want to make.</p>
					</div>
					<form method="POST" action="?/finishOnboarding" enctype="multipart/form-data">
						<div class="onboarding-tabs" role="tablist" aria-label="Signup steps">
							<button
								type="button"
								role="tab"
								aria-selected={profileTab === 'information'}
								on:click={() => (profileTab = 'information')}>Information</button
							>
							<button
								type="button"
								role="tab"
								aria-selected={profileTab === 'interests'}
								on:click={() => (profileTab = 'interests')}>Interests and experience</button
							>
							<button
								type="button"
								role="tab"
								aria-selected={profileTab === 'schedule'}
								on:click={() => (profileTab = 'schedule')}>Schedule</button
							>
							<button
								type="button"
								role="tab"
								aria-selected={profileTab === 'member-form'}
								on:click={() => (profileTab = 'member-form')}>Member form</button
							>
						</div>
						<div
							data-signup-tab="information"
							class="onboarding-panel"
							role="tabpanel"
							aria-label="Information"
							hidden={profileTab !== 'information'}
						>
							<div class="profile-field-grid">
								<label
									><span>Username</span><input
										name="username"
										bind:value={username}
										minlength="3"
										maxlength="24"
										pattern="[A-Za-z0-9_]+"
										autocomplete="username"
										required
									/></label
								>
								<label
									><span>First name</span><input
										name="firstName"
										bind:value={firstName}
										maxlength="80"
										autocomplete="given-name"
										required
									/></label
								>
								<label
									><span>Last name</span><input
										name="lastName"
										bind:value={lastName}
										maxlength="80"
										autocomplete="family-name"
										required
									/></label
								>
								<label>
									<span>Student number</span>
									<input
										name="studentId"
										bind:value={studentId}
										inputmode="numeric"
										autocomplete="off"
										minlength="5"
										maxlength="8"
										required={data.club?.kind !== 'needs_required_form'}
										placeholder={data.club?.kind === 'needs_required_form' ? 'Already saved' : ''}
									/>
								</label>
								<label>
									<span>Program</span>
									<select name="program" bind:value={program} required>
										<option value="">Choose your program</option>
										{#each programOptions as program (program)}<option value={program}
												>{program}</option
											>{/each}
									</select>
								</label>
								<label>
									<span>Current year</span>
									<select name="yearLevel" bind:value={yearLevel} required>
										<option value="">Choose one</option>
										{#each validYearLevels as year (year)}<option value={year}
												>{yearLabels[year]}</option
											>{/each}
									</select>
								</label>
								<div class="profile-field--wide">
									<label class="profile-field-label" for="profile-image"
										>Profile picture <small>Optional</small></label
									>
									<label class="profile-upload" for="profile-image">
										<span class="profile-upload__action">Choose image</span>
										<span
											class:profile-upload__name--selected={profileImageName}
											class="profile-upload__name">{profileImageName || 'No image selected'}</span
										>
										<input
											id="profile-image"
											class="profile-upload__input"
											name="profileImage"
											type="file"
											accept="image/png,image/jpeg,image/webp,image/gif"
											on:change={chooseProfileImage}
										/>
									</label>
									<small>Shown on your account and forum posts. Maximum 512 KB.</small>
								</div>
							</div>
							<div class="profile-form-action profile-form-action--split">
								<button
									type="button"
									class="dark-button"
									on:click={() => (profileTab = 'interests')}>Continue</button
								>
							</div>
						</div>

						<div
							data-signup-tab="interests"
							class="onboarding-panel"
							role="tabpanel"
							aria-label="Interests and experience"
							hidden={profileTab !== 'interests'}
						>
							<label class="profile-field--wide">
								<span>Programming experience</span>
								<select name="experienceLevel" bind:value={experienceLevel} required>
									<option value="">Choose one</option>
									<option value="new">I am just starting</option>
									<option value="learning">I know the basics</option>
									<option value="comfortable">I build projects</option>
									<option value="advanced">I can mentor others</option>
								</select>
							</label>
							<fieldset class="profile-interests">
								<legend>What do you want to build or learn?</legend>
								<div>
									{#each interestOptions as interest (interest)}<label
											><input
												type="checkbox"
												name="interests"
												value={interest}
												bind:group={interests}
												on:change={() => (interestError = false)}
											/>
											{interest.replace('-', ' ')}</label
										>{/each}
								</div>
								{#if interestError}<p class="field-error" role="alert">
										Choose at least one interest.
									</p>{/if}
							</fieldset>
							<label class="profile-field--wide profile-club-goals">
								<span>What should the club do this year? <small>Optional</small></span>
								<textarea
									name="clubGoals"
									bind:value={clubGoals}
									maxlength="1000"
									rows="5"
									placeholder="Workshops, projects, events, or anything you want us to try."
								></textarea>
							</label>
							<div class="profile-form-action profile-form-action--split">
								<button
									type="button"
									class="quiet-button"
									on:click={() => (profileTab = 'information')}>Back</button
								>
								<button type="button" class="dark-button" on:click={() => (profileTab = 'schedule')}
									>Continue</button
								>
							</div>
						</div>

						<section
							data-signup-tab="schedule"
							class="onboarding-panel"
							aria-labelledby="schedule-title"
							hidden={profileTab !== 'schedule'}
						>
							<div class="schedule-onboarding-head">
								<h2 id="schedule-title">Add your schedule</h2>
								<p>
									Optional. Your class times help staff find meeting times that work for more
									members.
								</p>
							</div>
							<div class="schedule-onboarding-workspace">
								<div class="schedule-onboarding-input">
									<label class="profile-field--wide"
										><span>Omnivox course list</span><textarea
											name="paste"
											bind:value={schedulePaste}
											rows="8"
											spellcheck="false"
											placeholder="Paste the numbered course list here."
										></textarea></label
									>
									<button
										type="button"
										class="quiet-button schedule-tutorial-button"
										on:click={() => (scheduleTutorialOpen = true)}>Show import tutorial</button
									>
									{#if scheduleResult && !scheduleResult.ok}
										<p class="field-error schedule-onboarding-error" role="alert">
											Could not read this schedule
										</p>
									{/if}
								</div>
								<div class="schedule-onboarding-preview">
									<ScheduleCalendar grid={scheduleGrid} weekdayOnly={true} />
								</div>
							</div>
							<div class="profile-form-action profile-form-action--split">
								<button
									type="button"
									class="quiet-button"
									on:click={() => (profileTab = 'interests')}>Back</button
								>
								<button
									type="button"
									class="dark-button"
									on:click={() => (profileTab = 'member-form')}>Continue</button
								>
							</div>
						</section>

						<section
							data-signup-tab="member-form"
							class="onboarding-panel"
							aria-labelledby="required-form-title"
							hidden={profileTab !== 'member-form'}
						>
							<div class="member-form-intro">
								<div>
									<h2 id="required-form-title" aria-label="Complete the member form">
										Complete your membership
									</h2>
									<p>Open the Marianopolis member form in a new tab, then return here to join.</p>
									<div class="member-form-club-note" role="note" aria-label="Club name">
										<span>Choose</span>
										<strong>The Programming Club</strong>
										<small>listed under T</small>
									</div>
								</div>
								<a
									class="primary-button"
									href={data.requiredFormUrl}
									target="_blank"
									rel="external noopener noreferrer"
									on:click={() => (memberFormOpened = true)}>Open required form</a
								>
							</div>
							{#if signupBlockedMessage}<p
									id="signup-blocked-message"
									class="signup-blocked-message"
									role="status"
								>
									{signupBlockedMessage}
								</p>{/if}
							<div class="profile-form-action profile-form-action--split">
								<button
									type="button"
									class="quiet-button"
									on:click={() => (profileTab = 'schedule')}>Back</button
								>
								<button
									type="button"
									class="dark-button"
									disabled={!signupIsReady}
									aria-describedby={signupBlockedMessage ? 'signup-blocked-message' : undefined}
									on:click={submitSignup}>Join the club</button
								>
							</div>
						</section>
					</form>
				</section>
			</div>
		{:else}
			<div class="community-profile-content">
				<section class="community-activity" aria-labelledby="recent-posts-title">
					<header class="community-section-heading">
						<h2 id="recent-posts-title">Recent posts</h2>
					</header>
					{#if data.recentPosts?.length}
						<div class="community-post-list">
							{#each data.recentPosts as post (post.id)}
								<a
									class="community-post"
									href={resolve('/tools/forum/[threadId]', { threadId: post.id })}
								>
									<div>
										<h3>{post.title}</h3>
										<p>{post.body}</p>
									</div>
									<span>{post.courseCode ?? categoryLabel(post.category)}</span>
									<time datetime={String(post.createdAt ?? '')}>{shortDate(post.createdAt)}</time>
								</a>
							{/each}
						</div>
					{:else}
						<p class="community-empty">No posts yet.</p>
					{/if}
				</section>

				<section class="community-outlines" aria-labelledby="course-outlines-title">
					<header class="community-section-heading">
						<h2 id="course-outlines-title">Course outlines</h2>
					</header>
					{#if data.courseOutlines?.length}
						<ol class="community-outline-list">
							{#each data.courseOutlines as outline (outline.sha256)}
								<li>
									<div>
										<span>{outlineCode(outline)}</span>
										<strong>{outlineTitle(outline)}</strong>
									</div>
									<time datetime={String(outline.createdAt ?? '')}
										>{shortDate(outline.createdAt)}</time
									>
								</li>
							{/each}
						</ol>
					{:else}
						<p class="community-empty">No course outlines yet.</p>
					{/if}
				</section>
			</div>
		{/if}
	</section>
	<OmnivoxTutorialOverlay
		open={scheduleTutorialOpen}
		onFinish={closeScheduleTutorial}
		onSkip={closeScheduleTutorial}
	/>
</div>

<style>
	:global(.mt-preview) .profile-page {
		min-height: calc(100vh - var(--header-h) - var(--preview-h));
		padding: 0;
		background: var(--paper);
		color: var(--ink);
	}

	:global(.mt-preview) .profile-page--guest {
		background: var(--ink);
	}

	.profile-page ::selection {
		background: var(--blue);
		color: white;
	}

	.profile-hero {
		display: grid;
		min-height: 19rem;
		border-bottom: 1px solid var(--ink);
		animation: profile-reveal 460ms var(--ease) both;
	}

	.profile-hero--guest {
		min-height: clamp(30rem, 68vh, 42rem);
		background: var(--ink);
		color: white;
	}

	.profile-hero__copy {
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: min(100%, 58rem);
		padding: clamp(3rem, 8vw, 7rem) clamp(1.5rem, 7vw, 7rem);
	}

	.profile-hero h1 {
		max-width: 12ch;
		margin: 0;
		color: inherit;
		font-family: var(--font-display);
		font-size: clamp(3rem, 7vw, 6rem);
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 0.93;
	}

	.profile-hero__copy > p {
		max-width: 58ch;
		margin: 1.5rem 0 0;
		color: #cbd7e6;
		font-size: clamp(1rem, 1.5vw, 1.2rem);
		line-height: 1.55;
	}

	.profile-hero__copy > .profile-time {
		margin-top: 0.75rem;
		color: white;
		font-size: 0.85rem;
		font-weight: 650;
	}

	.profile-hero--member {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		min-height: 15rem;
		padding: clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 4.5rem) 2.25rem;
		background: white;
	}

	.profile-identity {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: end;
		gap: clamp(1rem, 2vw, 1.75rem);
	}

	.profile-avatar {
		display: grid;
		width: clamp(4.5rem, 8vw, 6.5rem);
		aspect-ratio: 1;
		background: var(--ink);
		color: white;
		font-family: var(--font-display);
		font-size: clamp(1.15rem, 2vw, 1.65rem);
		font-weight: 700;
		place-items: center;
	}

	.profile-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.profile-identity h1 {
		max-width: none;
		font-size: clamp(2.5rem, 5vw, 4.75rem);
	}

	.profile-identity strong {
		display: block;
		margin-top: 0.85rem;
		font-size: 1rem;
	}

	.profile-identity p {
		margin: 0.2rem 0 0;
		color: var(--steel);
	}

	.profile-session {
		display: flex;
		align-items: center;
		padding-bottom: 0.15rem;
		gap: 1rem;
	}

	.profile-alerts {
		display: grid;
		gap: 0.5rem;
		padding: 1rem clamp(1.5rem, 5vw, 4.5rem) 0;
	}

	.profile-alerts p {
		margin: 0;
	}

	.profile-success {
		padding: 0.75rem 1rem;
		border: 1px solid var(--green);
		background: var(--green-pale);
		color: var(--green);
	}

	.community-profile-hero {
		display: flex;
		min-height: 13.5rem;
		align-items: flex-end;
		justify-content: space-between;
		padding: clamp(2.25rem, 5vw, 4.75rem) clamp(1.5rem, 5vw, 4.5rem) 2.5rem;
		border-bottom: 1px solid var(--ink);
		background: white;
		gap: 2rem;
	}

	.community-profile-identity {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: end;
		gap: clamp(1.25rem, 2.5vw, 2.25rem);
	}

	.community-avatar {
		display: grid;
		width: clamp(6.5rem, 11vw, 9rem);
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: white;
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 3vw, 2.25rem);
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.community-avatar img,
	.community-avatar__image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.community-profile-identity h1 {
		max-width: 16ch;
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.75rem, 4vw, 4rem);
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 0.9;
		overflow-wrap: break-word;
	}

	.community-full-name {
		margin: 1rem 0 0;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
		font-weight: 650;
	}

	.community-membership {
		margin: 0.65rem 0 0;
		color: var(--steel);
		font-size: 0.76rem;
		font-variant-numeric: tabular-nums;
	}

	.community-profile-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.community-profile-actions > button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 3.25rem;
	}

	.community-profile-actions svg {
		width: 1rem;
		height: 1rem;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.6;
	}

	.community-profile-actions > .primary-button {
		min-width: 10.25rem;
	}

	.community-profile-actions > .quiet-button {
		min-width: 8rem;
	}

	.community-profile-edit {
		display: grid;
		grid-template-columns: auto minmax(20rem, 1fr) auto;
		width: 100%;
		align-items: end;
		gap: clamp(1.25rem, 2.5vw, 2.25rem);
	}

	.community-avatar--editable {
		position: relative;
		display: grid;
		align-content: start;
		overflow: visible;
		background: white;
		color: var(--ink);
		cursor: pointer;
	}

	.community-avatar__image {
		display: grid;
		width: 100%;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		background: var(--ink);
		color: white;
	}

	.community-avatar__action {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		padding: 0.55rem;
		background: rgb(5 26 51 / 88%);
		color: white;
		font-family: var(--font-sans);
		font-size: 0.7rem;
		font-weight: 650;
		text-align: center;
	}

	.community-avatar--editable input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
	}

	.community-avatar--editable small {
		position: absolute;
		top: calc(100% + 0.45rem);
		left: 0;
		width: 100%;
		overflow: hidden;
		color: var(--steel);
		font-family: var(--font-sans);
		font-size: 0.68rem;
		font-weight: 500;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.community-avatar--editable:focus-within {
		outline: 3px solid rgb(20 87 217 / 18%);
		outline-offset: 3px;
	}

	.community-edit-fields,
	.community-edit-fields > div {
		display: grid;
		gap: 0.75rem;
	}

	.community-edit-fields > div {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.community-edit-fields label {
		display: grid;
		gap: 0.35rem;
		color: var(--steel);
		font-size: 0.7rem;
		font-weight: 650;
	}

	.community-edit-fields input {
		width: 100%;
		height: 2.7rem;
		padding: 0 0.75rem;
		border: 1px solid var(--line-dark);
		border-radius: 0;
		background: white;
		color: var(--ink);
		font: inherit;
		font-size: 0.85rem;
	}

	.community-edit-fields input:focus {
		border-color: var(--blue);
		outline: 3px solid rgb(20 87 217 / 16%);
		outline-offset: 1px;
	}

	.community-profile-content {
		display: grid;
		flex: 1 1 auto;
		grid-template-columns: minmax(0, 1.4fr) minmax(19rem, 1fr);
		min-height: 28rem;
		background: white;
	}

	.community-profile-content > section {
		min-width: 0;
		padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1.5rem, 4vw, 3.5rem) 4rem;
	}

	.community-profile-content > section + section {
		border-left: 1px solid var(--line-dark);
	}

	.community-section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		padding-bottom: 1.1rem;
		border-bottom: 1px solid var(--ink);
		gap: 1rem;
	}

	.community-section-heading h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.6rem, 2vw, 2rem);
		letter-spacing: -0.035em;
		line-height: 1;
	}

	.community-post {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 7rem 4rem;
		align-items: center;
		min-height: 6rem;
		padding: 1rem 0;
		border-bottom: 1px solid var(--line);
		color: inherit;
		column-gap: 1rem;
		text-decoration: none;
	}

	.community-post:hover {
		background: var(--paper-blue);
	}

	.community-post > div {
		min-width: 0;
	}

	.community-post h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.05rem;
		letter-spacing: -0.015em;
	}

	.community-post p {
		display: -webkit-box;
		margin: 0.35rem 0 0;
		overflow: hidden;
		color: var(--steel);
		font-size: 0.72rem;
		line-height: 1.45;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.community-post > span,
	.community-post time,
	.community-outline-list time {
		color: var(--steel);
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
	}

	.community-post time,
	.community-outline-list time {
		text-align: right;
	}

	.community-outline-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.community-outline-list li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		min-height: 5rem;
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--line);
		gap: 1rem;
	}

	.community-outline-list li > div {
		display: grid;
		min-width: 0;
		gap: 0.25rem;
	}

	.community-outline-list li span {
		color: var(--blue);
		font-size: 0.67rem;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.community-outline-list li strong {
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 0.92rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.community-empty {
		margin: 0;
		padding: 1.25rem 0;
		border-bottom: 1px solid var(--line);
		color: var(--steel);
		font-size: 0.78rem;
	}

	.profile-section-head h2,
	.onboarding-panel h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 2.5vw, 2.15rem);
		font-weight: 680;
		letter-spacing: -0.025em;
		line-height: 1.05;
	}

	.profile-section-head p,
	.onboarding-panel p {
		max-width: 68ch;
		margin: 0.85rem 0 0;
		color: var(--steel);
		line-height: 1.6;
	}

	.profile-google {
		min-width: 15rem;
		margin-top: 2.25rem;
	}

	.profile-enrollment {
		background: white;
	}

	.profile-enrollment {
		display: block;
	}

	.profile-form {
		max-width: 64rem;
		padding: clamp(2rem, 5vw, 4.5rem);
	}

	.onboarding-tabs {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		max-width: 64rem;
		margin: 0 0 2.5rem;
		border-bottom: 1px solid var(--line-dark);
	}

	.onboarding-tabs button {
		min-height: 3.5rem;
		padding: 0.7rem 0.4rem;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--steel);
		font: inherit;
		font-size: 0.76rem;
		font-weight: 650;
		cursor: pointer;
	}

	.onboarding-tabs button[aria-selected='true'] {
		border-bottom-color: var(--blue);
		color: var(--ink);
	}

	.onboarding-tabs button:focus-visible {
		outline: 3px solid rgb(20 87 217 / 18%);
		outline-offset: 2px;
	}

	.onboarding-tabs button:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.profile-form > form > .onboarding-panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.member-form-intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: 2rem;
	}

	.member-form-club-note {
		display: flex;
		align-items: baseline;
		width: fit-content;
		margin-top: 1rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--line-dark);
		background: var(--paper-blue);
		gap: 0.45rem;
		color: var(--steel);
		font-size: 0.78rem;
	}

	.member-form-club-note strong {
		color: var(--ink);
		font-size: 0.86rem;
	}

	.member-form-club-note small {
		font-size: inherit;
	}

	.schedule-onboarding-head {
		margin-bottom: 1.5rem;
	}

	.schedule-onboarding-head p {
		margin-top: 0.65rem;
	}

	.schedule-onboarding-workspace {
		display: grid;
		grid-template-columns: minmax(15rem, 0.72fr) minmax(0, 1.28fr);
		align-items: start;
		gap: clamp(1.25rem, 3vw, 2.5rem);
	}

	.schedule-onboarding-input {
		display: grid;
		align-content: start;
		gap: 0.85rem;
	}

	.schedule-tutorial-button {
		justify-self: start;
	}

	.schedule-onboarding-preview {
		border: 1px solid var(--line-dark);
		overflow: visible;
		background: white;
	}

	.schedule-onboarding-preview :global(.schedule-calendar) {
		grid-template-columns: 3rem repeat(5, minmax(0, 1fr));
		grid-template-rows: 2.5rem calc(var(--hour-h) * 10);
		width: 100%;
		min-width: 0;
		overflow: visible;
	}

	.schedule-onboarding-preview :global(.schedule-calendar .time-rail span:first-child) {
		top: 0;
	}

	.schedule-onboarding-preview :global(.schedule-calendar .time-rail span:last-child) {
		top: auto;
		bottom: 0;
	}

	.schedule-onboarding-preview :global(.schedule-calendar .calendar-corner) {
		padding-bottom: 0.55rem;
	}

	.schedule-onboarding-preview :global(.schedule-calendar .day-head) {
		min-width: 0;
		padding-inline: 0.15rem;
	}

	.schedule-onboarding-preview :global(.schedule-calendar .day-head span) {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.schedule-onboarding-error {
		margin: 0.75rem 0 0;
	}

	.profile-section-head {
		margin-bottom: 2rem;
	}

	.profile-field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem 1.25rem;
	}

	.profile-field-grid label {
		display: grid;
		gap: 0.45rem;
	}

	.profile-field-grid label > span {
		color: var(--steel);
		font-size: 0.72rem;
		font-weight: 600;
	}

	.profile-field-grid input,
	.profile-field-grid select {
		width: 100%;
		height: 2.8rem;
		padding: 0 0.8rem;
		border: 1px solid var(--line-dark);
		border-radius: 0;
		background: white;
		color: var(--ink);
		font: inherit;
	}

	.profile-field-grid input:focus,
	.profile-field-grid select:focus {
		border-color: var(--blue);
		outline: 3px solid rgb(20 87 217 / 16%);
		outline-offset: 1px;
	}

	.profile-field--wide {
		display: grid;
		grid-column: 1 / -1;
		gap: 0.45rem;
	}

	.profile-field--wide > span {
		color: var(--steel);
		font-size: 0.72rem;
		font-weight: 600;
	}

	.profile-field--wide > span small {
		font: inherit;
		font-weight: 450;
	}

	.profile-club-goals {
		margin-top: 1.5rem;
	}

	.profile-field-label {
		color: var(--steel);
		font-size: 0.72rem;
		font-weight: 600;
	}

	.profile-field-label small {
		font: inherit;
		font-weight: 450;
	}

	.profile-upload {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		min-height: 3.25rem;
		border: 1px solid var(--line-dark);
		background: white;
		cursor: pointer;
		transition:
			border-color 140ms ease,
			background 140ms ease;
	}

	.profile-upload:hover {
		border-color: var(--ink);
		background: var(--paper);
	}

	.profile-upload:focus-within {
		border-color: var(--blue);
		outline: 3px solid rgb(20 87 217 / 16%);
		outline-offset: 1px;
	}

	.profile-upload__action {
		align-self: stretch;
		display: grid;
		min-width: 8.5rem;
		padding: 0.75rem 1rem;
		background: var(--ink);
		color: white;
		font-size: 0.78rem;
		font-weight: 650;
		place-items: center;
	}

	.profile-upload__name {
		min-width: 0;
		padding: 0.75rem 1rem;
		overflow: hidden;
		color: var(--steel);
		font-size: 0.8rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-upload__name--selected {
		color: var(--ink);
		font-weight: 600;
	}

	.profile-upload__input {
		position: absolute;
		width: 1px !important;
		height: 1px !important;
		padding: 0 !important;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.profile-field--wide > small {
		color: var(--steel);
		font-size: 0.72rem;
		line-height: 1.45;
	}

	.profile-field--wide textarea {
		width: 100%;
		padding: 0.8rem;
		resize: vertical;
		border: 1px solid var(--line-dark);
		border-radius: 0;
		background: white;
		color: var(--ink);
		font: inherit;
		line-height: 1.5;
	}

	.profile-field--wide textarea:focus {
		border-color: var(--blue);
		outline: 3px solid rgb(20 87 217 / 16%);
		outline-offset: 1px;
	}

	.profile-interests {
		margin: 2rem 0 0;
		padding: 0;
		border: 0;
	}

	.profile-interests legend {
		margin-bottom: 0.75rem;
		font-weight: 650;
	}

	.profile-interests > div {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		border-top: 1px solid var(--ink);
		border-left: 1px solid var(--line);
	}

	.profile-interests label {
		display: flex;
		align-items: center;
		min-height: 2.9rem;
		padding: 0.65rem;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		gap: 0.6rem;
		text-transform: capitalize;
	}

	.profile-interests input {
		accent-color: var(--blue);
	}

	.profile-form-action {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 2rem;
		gap: 1rem;
	}

	.profile-form-action > :last-child {
		margin-left: auto;
	}

	.profile-form-action--split {
		width: 100%;
	}

	.profile-form-action button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.signup-blocked-message {
		max-width: 34rem;
		margin: auto 0 -1.35rem auto;
		color: var(--steel);
		font-size: 0.76rem;
		line-height: 1.45;
		text-align: right;
	}

	@keyframes profile-reveal {
		from {
			clip-path: inset(0 0 8% 0);
			filter: blur(2px);
		}
		to {
			clip-path: inset(0);
			filter: blur(0);
		}
	}

	@media (max-width: 62rem) {
		.profile-form {
			border-bottom: 1px solid var(--line-dark);
		}

		.community-profile-content {
			grid-template-columns: 1fr;
		}

		.community-profile-content > section + section {
			border-top: 1px solid var(--line-dark);
			border-left: 0;
		}

		.community-profile-edit {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.community-profile-edit .community-profile-actions {
			grid-column: 2;
			justify-content: flex-start;
		}
	}

	@media (max-width: 42rem) {
		.onboarding-tabs {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 44rem) {
		.community-profile-hero {
			min-height: 0;
			align-items: flex-start;
			flex-direction: column;
			padding-block: 2rem;
		}

		.community-profile-identity {
			align-items: center;
		}

		.community-avatar {
			width: 5.25rem;
		}

		.community-profile-identity h1 {
			font-size: clamp(2rem, 9.5vw, 2.6rem);
			line-height: 0.95;
		}

		.community-profile-actions {
			justify-content: flex-start;
		}

		.community-profile-edit {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.community-profile-edit .community-profile-actions {
			grid-column: auto;
		}

		.community-edit-fields > div {
			grid-template-columns: 1fr;
		}

		.community-profile-content > section {
			padding: 2rem 1.25rem 3rem;
		}

		.community-post {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.community-post > span {
			display: none;
		}

		.profile-hero--member {
			grid-template-columns: 1fr;
			align-items: start;
			gap: 1.75rem;
		}

		.profile-form > form > .onboarding-panel {
			min-height: 0;
		}

		.member-form-intro {
			grid-template-columns: 1fr;
		}

		.schedule-onboarding-head {
			margin-bottom: 1.25rem;
		}

		.schedule-onboarding-workspace {
			grid-template-columns: 1fr;
		}

		.member-form-intro > .primary-button {
			width: 100%;
		}

		.profile-field-grid,
		.profile-interests > div {
			grid-template-columns: 1fr;
		}

		.profile-identity {
			align-items: center;
		}

		.profile-identity h1 {
			font-size: clamp(2.3rem, 12vw, 3.7rem);
		}

		.profile-session {
			align-items: flex-start;
			flex-direction: column;
		}

		.profile-form-action {
			align-items: center;
			flex-direction: row;
		}

		.signup-blocked-message {
			align-self: stretch;
			text-align: left;
		}

		.profile-field--wide {
			grid-column: auto;
		}

		.profile-form-action .dark-button,
		.profile-google {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.profile-hero {
			animation: none;
		}
	}
</style>
