import { expect, test } from '@playwright/test';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { CANONICAL_OMNIVOX_SCHEDULE } from '../../../src/lib/maritools/schedule/fixture.js';

const APP_ORIGIN = process.env.LIVE_E2E_BASE_URL;
const MEMBER_ID = '70000000-0000-4000-8000-000000000001';
const ACTION_ALIGNMENT_TOLERANCE = 1;
const PROFILE_POST_ID = '80000000-0000-4000-8000-000000000001';
const PROFILE_OUTLINE_SHA = 'ab'.repeat(32);
const REVIEW_DIR = resolve('.impeccable/review');
const PROFILE_IMAGE_PATH = resolve('static/images/marihacks/organizers-working-640.webp');
const PROFILE_IMAGE_NAME = 'organizers-working-640.webp';

if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/u.test(APP_ORIGIN ?? '')) {
	throw new Error('The live browser suite requires a loopback application origin');
}

async function documentRect(locator) {
	await locator.scrollIntoViewIfNeeded();
	return locator.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return {
			top: rect.top + window.scrollY,
			left: rect.left + window.scrollX,
			right: rect.right + window.scrollX,
			height: rect.height
		};
	});
}

function expectAligned(actual, expected, properties) {
	for (const property of properties) {
		expect(Math.abs(actual[property] - expected[property])).toBeLessThanOrEqual(
			ACTION_ALIGNMENT_TOLERANCE
		);
	}
}

async function seedProfileActivity() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL is required for the live profile proof');
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		await client.query(
			`INSERT INTO mt_forum_threads (id, author_user_id, title, body, category)
			 VALUES ($1, $2, $3, $4, 'student-life')`,
			[
				PROFILE_POST_ID,
				MEMBER_ID,
				'Build night project ideas',
				'What should we make together this semester?'
			]
		);
		await client.query(
			`INSERT INTO mt_outline_documents (user_id, sha256, byte_length, extracted_text)
			 VALUES ($1, $2, 128, 'COMP 250 course outline')`,
			[MEMBER_ID, PROFILE_OUTLINE_SHA]
		);
		await client.query(
			`INSERT INTO mt_outline_extractions (document_sha256, proposals, inference_count)
			 VALUES ($1, $2::jsonb, 1)`,
			[
				PROFILE_OUTLINE_SHA,
				JSON.stringify({ courseCode: 'COMP 250', title: 'Introduction to Computer Science' })
			]
		);
	} finally {
		await client.end();
	}
}

async function captureProfileEvidence(page) {
	await mkdir(REVIEW_DIR, { recursive: true });
	for (const evidence of [
		{ width: 1586, height: 992, name: 'desktop.png' },
		{ width: 390, height: 844, name: 'mobile.png' },
		{ width: 1971, height: 1280, name: 'user-1971.png' }
	]) {
		await page.setViewportSize({ width: evidence.width, height: evidence.height });
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(350);
		if (evidence.width === 390) {
			const mobileLayout = await page.evaluate(() => {
				const profile = document.querySelector('.profile-page');
				const profileContent = document.querySelector('.community-profile-content');
				return {
					documentWidth: document.documentElement.scrollWidth,
					viewportWidth: document.documentElement.clientWidth,
					profileLeft: profile?.getBoundingClientRect().left ?? -1,
					contentLeft: profileContent?.getBoundingClientRect().left ?? -1
				};
			});
			expect(mobileLayout.profileLeft).toBeGreaterThanOrEqual(0);
			expect(mobileLayout.contentLeft).toBeGreaterThanOrEqual(0);
			expect(mobileLayout.documentWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth);
		}
		await page.screenshot({ path: resolve(REVIEW_DIR, evidence.name) });
	}
	// The approved comp describes the account surface inside the persistent
	// 256 px tools rail and the 150 px site chrome.
	await page.setViewportSize({ width: 1842, height: 1143 });
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(350);
	await page.locator('.profile-page').screenshot({
		path: resolve(REVIEW_DIR, 'hero-repro.png')
	});
}

test('joins the club with a saved draft and exposes the member to staff', async ({
	context,
	page
}) => {
	test.setTimeout(60_000);
	const proofPause = () =>
		process.env.LIVE_E2E_VIDEO === 'on' ? page.waitForTimeout(1200) : Promise.resolve();
	await context.addCookies([
		{
			name: 'mari-staff.session_token',
			value: 'live-e2e-authorized',
			url: APP_ORIGIN,
			httpOnly: true,
			sameSite: 'Lax'
		}
	]);

	await page.goto('/tools/account');
	await expect(page.getByRole('heading', { name: 'Join the Programming Club' })).toBeVisible();
	const informationTab = page.getByRole('tab', { name: 'Information' });
	const interestsTab = page.getByRole('tab', { name: 'Interests and experience' });
	const scheduleTab = page.getByRole('tab', { name: 'Schedule' });
	const memberFormTab = page.getByRole('tab', { name: 'Member form' });

	for (const tab of [informationTab, interestsTab, scheduleTab, memberFormTab]) {
		await expect(tab).toBeEnabled();
		await expect(tab).not.toHaveAttribute('aria-disabled', 'true');
	}

	await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
	const informationContinue = page.getByRole('button', { name: 'Continue' });
	await expect(informationContinue).toBeVisible();
	await expect(page.getByRole('button', { name: 'Join the club' })).toHaveCount(0);
	const informationContinueRect = await documentRect(informationContinue);

	await page.getByLabel('Student number', { exact: true }).fill('2530622');
	await page.getByLabel('Username', { exact: true }).fill('ada_member');
	await page.getByLabel('First name', { exact: true }).fill('Ada');
	await page.getByLabel('Last name', { exact: true }).fill('Member');
	const programSelect = page.getByRole('combobox', { name: 'Program', exact: true });
	const yearSelect = page.getByRole('combobox', { name: 'Current year', exact: true });
	await programSelect.selectOption({ label: 'Science, Pure and Applied Science' });
	await yearSelect.selectOption({ label: 'Second year' });
	await expect(programSelect).toHaveValue('Science, Pure and Applied Science');
	await expect(yearSelect).toHaveValue('second');
	await memberFormTab.click();
	await expect(page.getByRole('heading', { name: 'Complete the member form' })).toBeVisible();
	await expect(page.getByLabel('I submitted the Microsoft form')).toHaveCount(0);
	const joinButton = page.getByRole('button', { name: 'Join the club' });
	await expect(joinButton).toBeDisabled();

	await interestsTab.click();
	const interestsBack = page.getByRole('button', { name: 'Back' });
	const interestsContinue = page.getByRole('button', { name: 'Continue' });
	await expect(interestsContinue).toBeVisible();
	await expect(page.getByRole('button', { name: 'Join the club' })).toHaveCount(0);
	await page.locator('select[name="experienceLevel"]').selectOption('learning');
	await page.locator('input[name="interests"][value="web"]').check();
	await expect(page.getByLabel(/What should the club do this year\? Optional/u)).toBeEmpty();
	const interestsBackRect = await documentRect(interestsBack);
	const interestsContinueRect = await documentRect(interestsContinue);
	expectAligned(interestsContinueRect, informationContinueRect, ['top', 'right', 'height']);
	await proofPause();

	await memberFormTab.click();
	await expect(joinButton).toBeDisabled();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const key = Object.keys(localStorage).find((name) =>
					name.startsWith('programming-club-signup-draft:')
				);
				if (!key) return null;
				const draft = JSON.parse(localStorage.getItem(key) ?? '{}');
				return {
					username: draft.username,
					firstName: draft.firstName,
					lastName: draft.lastName,
					studentId: draft.studentId,
					program: draft.program,
					yearLevel: draft.yearLevel,
					experienceLevel: draft.experienceLevel,
					interests: draft.interests
				};
			})
		)
		.toEqual({
			username: 'ada_member',
			firstName: 'Ada',
			lastName: 'Member',
			studentId: '2530622',
			program: 'Science, Pure and Applied Science',
			yearLevel: 'second',
			experienceLevel: 'learning',
			interests: ['web']
		});
	const requiredFormLink = page.getByRole('link', { name: 'Open required form' });
	await expect(requiredFormLink).toHaveAttribute(
		'href',
		/^https:\/\/forms\.cloud\.microsoft\/pages\/responsepage\.aspx/u
	);
	await expect(
		page.getByText('Open the Marianopolis member form in a new tab, then return here to join.', {
			exact: true
		})
	).toBeVisible();
	await expect(page.getByText('Required before you can use MariTools.')).toHaveCount(0);
	await expect(page.getByText("We'll fill in the information you entered here.")).toHaveCount(0);
	await expect(
		page.getByText('Microsoft will ask you to sign in with your Marianopolis account.')
	).toHaveCount(0);
	const memberActionRail = page.locator('[data-signup-tab="member-form"] > .profile-form-action');
	await expect(memberActionRail).toHaveCount(1);
	const memberBackRect = await documentRect(memberActionRail.getByRole('button', { name: 'Back' }));
	const memberJoinRect = await documentRect(joinButton);
	expectAligned(memberBackRect, interestsBackRect, ['top', 'left', 'height']);
	expectAligned(memberJoinRect, informationContinueRect, ['top', 'right', 'height']);

	const firstRequiredFormHref = await requiredFormLink.getAttribute('href');
	expect(firstRequiredFormHref).toBe(
		'https://forms.cloud.microsoft/pages/responsepage.aspx?id=gM4FyXMGa02pnxlDYrX7rr5-iZTtVRdEtoDBmsFVUSFUQlc3REk4VE1aRkg0RjJMMEU0RDZPWFZaUy4u&route=shorturl'
	);
	await informationTab.click();
	await page.getByLabel('First name', { exact: true }).fill('Ada Grace');
	await memberFormTab.click();
	await expect(requiredFormLink).toHaveAttribute('href', firstRequiredFormHref);
	await informationTab.click();
	await page.getByLabel('First name', { exact: true }).fill('Ada');
	await memberFormTab.click();
	await expect(requiredFormLink).toHaveAttribute('href', firstRequiredFormHref);
	const requiredFormPopup = page.waitForEvent('popup');
	await requiredFormLink.click();
	await (await requiredFormPopup).close();
	await expect(joinButton).toBeEnabled();

	await scheduleTab.click();
	await expect(page.getByRole('heading', { name: 'Add your schedule' })).toBeVisible();
	const scheduleBack = page.getByRole('button', { name: 'Back' });
	const scheduleContinue = page.getByRole('button', { name: 'Continue' });
	await expect(scheduleContinue).toBeVisible();
	await expect(page.getByRole('button', { name: 'Join the club' })).toHaveCount(0);
	const scheduleBackRect = await documentRect(scheduleBack);
	const scheduleContinueRect = await documentRect(scheduleContinue);
	expectAligned(scheduleBackRect, interestsBackRect, ['top', 'left', 'height']);
	expectAligned(scheduleContinueRect, informationContinueRect, ['top', 'right', 'height']);
	await expect(page.getByText('Schedule preview', { exact: true })).toHaveCount(0);
	const scheduleCalendar = page.getByLabel('Weekly course schedule');
	await expect(scheduleCalendar).toBeVisible();
	await expect(scheduleCalendar).toHaveClass(/weekday-only/u);
	const dayHeads = scheduleCalendar.locator('.day-head');
	await expect(dayHeads).toHaveCount(5);
	expect((await dayHeads.allTextContents()).map((label) => label.trim())).toEqual([
		'Mon',
		'Tue',
		'Wed',
		'Thu',
		'Fri'
	]);
	expect(
		await page
			.locator('.schedule-onboarding-preview')
			.evaluate((preview) => preview.scrollWidth <= preview.clientWidth + 1)
	).toBe(true);
	const scheduleInput = page.locator('.schedule-onboarding-input');
	await expect(scheduleInput.locator('textarea, button.schedule-tutorial-button')).toHaveCount(2);
	expect(
		await scheduleInput
			.locator('textarea, button.schedule-tutorial-button')
			.evaluateAll((elements) => elements.map((element) => element.tagName))
	).toEqual(['TEXTAREA', 'BUTTON']);
	await page.getByRole('button', { name: 'Show import tutorial' }).click();
	const tutorial = page.getByRole('dialog', { name: 'Open Omnivox' });
	await expect(tutorial).toBeVisible();
	await tutorial.getByRole('button', { name: 'Close tutorial' }).click();
	await expect(tutorial).toHaveCount(0);

	await page.getByLabel('Omnivox course list').fill('not an Omnivox schedule');
	await expect(
		page.getByRole('alert').filter({ hasText: 'Could not read this schedule' })
	).toBeVisible();
	await expect(page.getByLabel('Weekly course schedule')).toBeVisible();
	await memberFormTab.click();
	await expect(joinButton).toBeDisabled();
	await expect(page.getByText('Fix or remove the schedule paste before joining.')).toBeVisible();

	await scheduleTab.click();
	await page.getByLabel('Omnivox course list').fill(CANONICAL_OMNIVOX_SCHEDULE);
	await expect(page.getByLabel('Weekly course schedule')).toBeVisible();
	await expect(page.getByText('Badminton and Conditioning', { exact: true })).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const key = Object.keys(localStorage).find((name) =>
					name.startsWith('programming-club-signup-draft:')
				);
				return key ? JSON.parse(localStorage.getItem(key) ?? '{}').schedulePaste : null;
			})
		)
		.toBe(CANONICAL_OMNIVOX_SCHEDULE);
	await page.reload();
	await expect(scheduleTab).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByLabel('Omnivox course list')).toHaveValue(CANONICAL_OMNIVOX_SCHEDULE);
	await informationTab.click();
	await expect(page.getByLabel('Username', { exact: true })).toHaveValue('ada_member');
	await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Ada');
	await proofPause();
	await interestsTab.click();
	await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Join the club' })).toHaveCount(0);
	await expect(page.locator('select[name="experienceLevel"]')).toHaveValue('learning');
	await expect(page.locator('input[name="interests"][value="web"]')).toBeChecked();
	await expect(page.getByLabel(/What should the club do this year\? Optional/u)).toBeEmpty();
	await proofPause();
	await scheduleTab.click();
	await expect(page.getByRole('heading', { name: 'Add your schedule' })).toBeVisible();
	await expect(page.getByLabel('Omnivox course list')).toHaveValue(CANONICAL_OMNIVOX_SCHEDULE);
	await expect(page.getByLabel('Weekly course schedule')).toBeVisible();
	await proofPause();
	await memberFormTab.click();
	await expect(page.getByRole('heading', { name: 'Complete the member form' })).toBeVisible();
	await expect(joinButton).toBeEnabled();
	await proofPause();
	await expect(page.getByLabel('I submitted the Microsoft form')).toHaveCount(0);
	await joinButton.click();
	await expect(page.getByRole('heading', { name: 'ada_member' })).toBeVisible();
	await expect(page.getByText('Ada Member', { exact: true })).toBeVisible();
	await expect(page.getByText(/^Executive since /u)).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Recent posts' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Course outlines' })).toBeVisible();
	for (const removedHeading of [
		'Your profile',
		'Account status',
		'Student data',
		'Who can see what',
		'Your schedule is connected'
	]) {
		await expect(page.getByRole('heading', { name: removedHeading })).toHaveCount(0);
	}
	await expect(page.getByText('NVIDIA outline analysis', { exact: true })).toHaveCount(0);

	const profileActions = page.locator('.community-profile-actions');
	await expect(profileActions.getByRole('button')).toHaveText(['Edit profile', 'Sign out']);

	await seedProfileActivity();
	await page.reload();
	await expect(page.getByRole('link', { name: /Build night project ideas/u })).toHaveAttribute(
		'href',
		`/tools/forum/${PROFILE_POST_ID}`
	);
	await expect(page.getByText('COMP 250', { exact: true })).toBeVisible();
	await expect(page.getByText('Introduction to Computer Science', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Edit profile' }).click();
	const editForm = page.getByRole('form', { name: 'Edit profile' });
	await expect(editForm).toBeVisible();
	await editForm.getByLabel('Username', { exact: true }).fill('ada_updated');
	await editForm.getByLabel('First name', { exact: true }).fill('Ada Grace');
	await editForm.getByLabel('Last name', { exact: true }).fill('Member');
	await editForm.getByLabel('Change profile picture').setInputFiles(PROFILE_IMAGE_PATH);
	await expect(editForm.getByText(PROFILE_IMAGE_NAME, { exact: true })).toBeVisible();
	await editForm.getByRole('button', { name: 'Save profile' }).click();

	await expect(page.getByRole('heading', { name: 'ada_updated' })).toBeVisible();
	await expect(page.getByText('Ada Grace Member', { exact: true })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Ada Grace Member profile picture' })).toHaveAttribute(
		'src',
		/^data:image\/webp;base64,/u
	);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'ada_updated' })).toBeVisible();
	await expect(page.getByText('Ada Grace Member', { exact: true })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Ada Grace Member profile picture' })).toHaveAttribute(
		'src',
		/^data:image\/webp;base64,/u
	);
	await expect(page.getByRole('link', { name: /Build night project ideas/u })).toBeVisible();
	await expect(page.getByText('COMP 250', { exact: true })).toBeVisible();
	await captureProfileEvidence(page);
	await proofPause();

	await page.goto('/tools/schedule');
	await expect(page).toHaveURL('/tools/schedule');
	await expect(page.getByText('7 classes detected')).toBeVisible();
	await expect(page.getByText('Badminton and Conditioning', { exact: true })).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Programming Club meeting planning' })
	).toHaveCount(0);
	await expect(page.getByText('Imported schedules are available to club staff.')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /share/i })).toHaveCount(0);
	await proofPause();

	await page.goto('/staff/members');
	await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
	await expect(page.getByText('1 member')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Ada Grace Member' })).toBeVisible();
	await expect(
		page.getByRole('table', { name: 'Members without class at each time' })
	).toBeVisible();
	const memberLink = page.getByRole('link', { name: 'Ada Grace Member' });
	await memberLink.scrollIntoViewIfNeeded();
	await expect(memberLink).toBeVisible();
	await proofPause();
	await memberLink.click();
	await expect(page).toHaveURL(`/staff/members/${MEMBER_ID}`);
	await expect(page.locator('dd').filter({ hasText: 'team@marihacks.com' })).toBeVisible();
	await expect(page.locator('dd').filter({ hasText: '2530622' })).toBeVisible();
	await expect(page.getByText(/Badminton and Conditioning/u)).toBeVisible();
	await proofPause();

	if (process.env.LIVE_E2E_VIDEO === 'on') {
		const video = page.video();
		await page.close();
		if (video) {
			await mkdir(REVIEW_DIR, { recursive: true });
			await copyFile(await video.path(), resolve(REVIEW_DIR, 'signup-profile-flow.webm'));
		}
	}
});
