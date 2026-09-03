import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountPage from './+page.svelte';

const accountPageSource = readFileSync('src/routes/tools/account/+page.svelte', 'utf8');

/** @param {string} selector */
function cssRulesFor(selector) {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return accountPageSource.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

vi.mock('$lib/auth/staff-sign-out.js', () => ({
	endStaffSession: vi.fn(async () => true)
}));

afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const base = {
	callbackURL: 'https://club.example.com/tools/account',
	recoveryMessage: null,
	googleSignInConfigured: true,
	requiredFormUrl: 'https://forms.cloud.microsoft/pages/responsepage.aspx?id=form&route=shorturl'
};

async function completeRequiredSignupFields() {
	await fireEvent.input(screen.getByLabelText('Username'), {
		target: { value: 'ada_codes' }
	});
	await fireEvent.input(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
	await fireEvent.input(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
	await fireEvent.input(screen.getByLabelText('Student number'), {
		target: { value: '2530622' }
	});
	await fireEvent.change(screen.getByLabelText('Program'), {
		target: { value: 'Science, Pure and Applied Science' }
	});
	await fireEvent.change(screen.getByLabelText('Current year'), {
		target: { value: 'second' }
	});
	await fireEvent.click(screen.getByRole('tab', { name: 'Interests and experience' }));
	await fireEvent.change(screen.getByLabelText('Programming experience'), {
		target: { value: 'learning' }
	});
	await fireEvent.click(screen.getByLabelText('web'));
}

/** @param {string} primaryName @param {boolean} [hasBack] */
function expectActionRail(primaryName, hasBack = true) {
	const primary = screen.getByRole('button', { name: primaryName });
	const rail = primary.closest('.profile-form-action');
	expect(rail).not.toBeNull();
	expect(rail).toHaveClass('profile-form-action--split');
	expect(rail?.lastElementChild).toBe(primary);
	if (hasBack) {
		expect(rail?.firstElementChild).toBe(screen.getByRole('button', { name: 'Back' }));
	} else {
		expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
	}
}

describe('account page', () => {
	it('offers Google sign-in to a guest', () => {
		render(AccountPage, {
			props: { data: { ...base, googleSignInConfigured: true, view: { kind: 'guest' } } }
		});
		expect(
			screen.getByRole('heading', { name: 'Sign in to the Programming Club' })
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
		expect(
			screen.queryByText('Your account details stay private outside the club team.')
		).not.toBeInTheDocument();
		expect(screen.getByText('Plan for about 5 minutes.')).toBeInTheDocument();
		expect(screen.queryByText('One sign-in, then you are set')).not.toBeInTheDocument();
		expect(screen.queryByText('Club membership')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Student number')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
	});

	it('tells a guest when Google OAuth is not configured on loopback', () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					callbackURL: 'http://127.0.0.1:5174/tools/account',
					googleSignInConfigured: false,
					view: { kind: 'guest' }
				}
			}
		});
		expect(
			screen.getByText(
				'Google sign-in is not configured for local development. Check the server OAuth settings, then restart the dev server.'
			)
		).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
	});

	it('tells a guest when Google OAuth is not configured on a public origin', () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					googleSignInConfigured: false,
					view: { kind: 'guest' }
				}
			}
		});
		expect(screen.getByText('Google sign-in is not configured on this site.')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
	});

	it('keeps every signup tab available and submits only from the final step', async () => {
		render(AccountPage, {
			props: { data: { ...base, view: { kind: 'incomplete', email: 'ada@gmail.com' } } }
		});
		expect(screen.getByText('ada@gmail.com')).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Information' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		expect(screen.getByLabelText('Username')).toBeInTheDocument();
		expect(screen.getByLabelText('First name')).toBeInTheDocument();
		expect(screen.getByLabelText('Last name')).toBeInTheDocument();
		expect(screen.getByLabelText('Student number')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Choose image' })).toBeInTheDocument();
		expect(screen.getByText('No image selected')).toBeInTheDocument();
		expect(screen.getByLabelText('Choose profile picture file')).toHaveAttribute(
			'accept',
			'image/jpeg,image/png,image/webp'
		);
		expect(screen.getByRole('option', { name: 'Arts and Sciences' })).toBeInTheDocument();
		expect(
			screen.getByRole('option', { name: 'Science, Pure and Applied Science' })
		).toBeInTheDocument();
		expect(screen.getByLabelText('Current year')).toHaveTextContent('First year');
		expect(screen.queryByText(/NVIDIA outline analysis/i)).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Join the Programming Club' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Finish your club profile' })).toBeInTheDocument();
		expect(screen.queryByText(/club staff can view my Google email/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/student numbers are encrypted/i)).not.toBeInTheDocument();
		const interestsTab = screen.getByRole('tab', { name: 'Interests and experience' });
		const memberFormTab = screen.getByRole('tab', { name: 'Member form' });
		expect(interestsTab).not.toBeDisabled();
		expect(memberFormTab).not.toBeDisabled();

		await fireEvent.click(interestsTab);
		expect(screen.getByLabelText('Programming experience')).toBeInTheDocument();
		expect(
			screen.getByRole('group', { name: 'What do you want to build or learn?' })
		).toBeInTheDocument();
		expect(screen.getByLabelText(/^What should the club do this year\?/)).not.toBeRequired();
		expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('type', 'button');
		expect(screen.queryByRole('button', { name: 'Join the club' })).not.toBeInTheDocument();

		await fireEvent.click(memberFormTab);
		expect(
			screen.getByRole('heading', { name: 'Fill out the Microsoft form later' })
		).toBeInTheDocument();
		expect(screen.getByText('This does not block your signup.')).toBeInTheDocument();
		expect(screen.getByRole('note', { name: 'Club name' })).toHaveTextContent(
			'The Programming Club'
		);
		expect(screen.getByRole('note', { name: 'Club name' })).toHaveTextContent('listed under T');
		expect(screen.getByRole('link', { name: 'Open required form' }).getAttribute('href')).toContain(
			base.requiredFormUrl
		);
		expect(screen.queryByLabelText('I submitted the Microsoft form')).not.toBeInTheDocument();
		const joinButton = screen.getByRole('button', { name: 'Join the club' });
		expect(joinButton).toHaveAttribute('type', 'button');
		expect(joinButton.closest('form')).toHaveAttribute('action', '?/finishOnboarding');
		expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
		expect(screen.queryByText('Signed in')).not.toBeInTheDocument();
		expect(screen.queryByText('2530622')).not.toBeInTheDocument();
	});

	it('keeps schedule import out of signup and clearly labels optional fields', async () => {
		render(AccountPage, {
			props: { data: { ...base, view: { kind: 'incomplete', email: 'ada@gmail.com' } } }
		});

		expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual([
			'Information',
			'Interests and experience',
			'Member form'
		]);
		expect(screen.queryByRole('tab', { name: 'Schedule' })).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Omnivox course list')).not.toBeInTheDocument();
		expect(screen.getByText('Profile picture', { exact: false })).toHaveTextContent('Optional');

		await fireEvent.click(screen.getByRole('tab', { name: 'Interests and experience' }));
		expect(
			screen.getByText('What should the club do this year?', { exact: false })
		).toHaveTextContent('Optional');
	});

	it('enables final submission when required signup fields are valid without opening the member form', async () => {
		render(AccountPage, {
			props: { data: { ...base, view: { kind: 'incomplete', email: 'ada@gmail.com' } } }
		});

		await fireEvent.click(screen.getByRole('tab', { name: 'Member form' }));
		const joinButton = screen.getByRole('button', { name: 'Join the club' });
		expect(joinButton).toBeDisabled();

		await fireEvent.click(screen.getByRole('tab', { name: 'Information' }));
		await completeRequiredSignupFields();
		await fireEvent.click(screen.getByRole('tab', { name: 'Member form' }));
		await waitFor(() => expect(joinButton).toBeEnabled());
	});

	it('does not store member-form opening state in the local signup draft', async () => {
		const props = {
			data: { ...base, view: { kind: 'incomplete', email: 'ada@gmail.com' } }
		};
		render(AccountPage, { props });
		await completeRequiredSignupFields();
		await fireEvent.click(screen.getByRole('tab', { name: 'Member form' }));
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Join the club' })).toBeEnabled()
		);
		const draft = JSON.parse(
			localStorage.getItem('programming-club-signup-draft:ada@gmail.com') ?? '{}'
		);
		expect(draft).not.toHaveProperty('memberFormOpened');
	});

	it('uses one aligned action rail with Back on the left and Continue or Join on the right', async () => {
		render(AccountPage, {
			props: { data: { ...base, view: { kind: 'incomplete', email: 'ada@gmail.com' } } }
		});

		expectActionRail('Continue', false);
		expect(screen.queryByRole('button', { name: 'Join the club' })).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('tab', { name: 'Interests and experience' }));
		expectActionRail('Continue');
		expect(screen.queryByRole('button', { name: 'Join the club' })).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('tab', { name: 'Member form' }));
		expectActionRail('Join the club');

		expect(cssRulesFor('.profile-form > form > .onboarding-panel')).toContain('min-height: 0;');
		expect(cssRulesFor('.profile-form-action')).toContain('margin-top: 2rem;');
		expect(cssRulesFor('.profile-form-action')).not.toContain('margin-top: auto;');
	});

	it('restores an unfinished signup draft and its active tab', async () => {
		const props = {
			data: { ...base, view: { kind: 'incomplete', email: 'ada@gmail.com' } }
		};
		const firstRender = render(AccountPage, { props });
		await fireEvent.input(screen.getByLabelText('Username'), {
			target: { value: 'ada_codes' }
		});
		await fireEvent.input(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
		await fireEvent.input(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
		await fireEvent.input(screen.getByLabelText('Student number'), {
			target: { value: '2530622' }
		});
		await fireEvent.change(screen.getByLabelText('Program'), {
			target: { value: 'Science, Pure and Applied Science' }
		});
		await fireEvent.change(screen.getByLabelText('Current year'), {
			target: { value: 'second' }
		});

		await fireEvent.click(screen.getByRole('tab', { name: 'Interests and experience' }));
		await fireEvent.change(screen.getByLabelText('Programming experience'), {
			target: { value: 'learning' }
		});
		await fireEvent.click(screen.getByLabelText('web'));
		await fireEvent.input(screen.getByLabelText(/^What should the club do this year\?/), {
			target: { value: 'Project nights' }
		});
		await fireEvent.click(screen.getByRole('tab', { name: 'Member form' }));
		firstRender.unmount();

		render(AccountPage, { props });
		expect(screen.getByRole('tab', { name: 'Member form' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await fireEvent.click(screen.getByRole('tab', { name: 'Information' }));
		expect(screen.getByLabelText('Username')).toHaveValue('ada_codes');
		expect(screen.getByLabelText('First name')).toHaveValue('Ada');
		expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace');
		expect(screen.getByLabelText('Student number')).toHaveValue('2530622');
		expect(screen.getByLabelText('Program')).toHaveValue('Science, Pure and Applied Science');
		expect(screen.getByLabelText('Current year')).toHaveValue('second');
		await fireEvent.click(screen.getByRole('tab', { name: 'Interests and experience' }));
		expect(screen.getByLabelText('Programming experience')).toHaveValue('learning');
		expect(screen.getByLabelText('web')).toBeChecked();
		expect(screen.getByLabelText(/^What should the club do this year\?/)).toHaveValue(
			'Project nights'
		);
		cleanup();
		render(AccountPage, {
			props: {
				data: {
					...base,
					club: { kind: 'joined_without_schedule' },
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada',
						nimAccepted: true
					}
				}
			}
		});
		cleanup();
		render(AccountPage, { props });
		expect(screen.getByRole('tab', { name: 'Information' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		expect(screen.getByLabelText('Username')).toHaveValue('');
	});

	it('shows club signup to an existing MariTools profile that has not joined', async () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					club: { kind: 'needs_club_details' },
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada',
						profileImageDataUrl: 'data:image/png;base64,YQ==',
						nimAccepted: true
					}
				}
			}
		});
		await fireEvent.click(screen.getByRole('tab', { name: 'Interests and experience' }));
		expect(screen.getByLabelText(/^What should the club do this year\?/)).not.toBeRequired();
		expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Join the club' })).not.toBeInTheDocument();
		expect(screen.queryByText('NVIDIA outline analysis')).not.toBeInTheDocument();
	});

	it('keeps the final member-form step compact and uses the shared action rail position', async () => {
		render(AccountPage, {
			props: { data: { ...base, view: { kind: 'incomplete', email: 'ada@gmail.com' } } }
		});

		await fireEvent.click(screen.getByRole('tab', { name: 'Member form' }));

		expect(screen.queryByText('Required before you can use MariTools.')).not.toBeInTheDocument();
		expect(
			screen.queryByText('We’ll fill in the information you entered here.')
		).not.toBeInTheDocument();
		expect(
			screen.queryByText('Microsoft will ask you to sign in with your Marianopolis account.')
		).not.toBeInTheDocument();
		const joinButton = screen.getByRole('button', { name: 'Join the club' });
		const actionRail = joinButton.closest('.profile-form-action');
		expect(actionRail?.parentElement).toHaveAttribute('data-signup-tab', 'member-form');
		expect(actionRail?.lastElementChild).toBe(joinButton);
	});

	it('keeps the non-owner Microsoft member form at its fixed base URL', async () => {
		const requiredFormUrl =
			'https://forms.cloud.microsoft/pages/responsepage.aspx?id=gM4FyXMGa02pnxlDYrX7rr5-iZTtVRdEtoDBmsFVUSFUQlc3REk4VE1aRkg0RjJMMEU0RDZPWFZaUy4u&route=shorturl';
		render(AccountPage, {
			props: {
				data: {
					...base,
					requiredFormUrl,
					view: { kind: 'incomplete', email: 'ada@gmail.com' }
				}
			}
		});

		await completeRequiredSignupFields();
		await fireEvent.click(screen.getByRole('tab', { name: 'Member form' }));
		expect(screen.getByRole('link', { name: 'Open required form' })).toHaveAttribute(
			'href',
			requiredFormUrl
		);
	});

	it('does not copy edited member information into the Microsoft Form URL', async () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					requiredFormUrl:
						'https://forms.cloud.microsoft/pages/responsepage.aspx?id=gM4FyXMGa02pnxlDYrX7rr5-iZTtVRdEtoDBmsFVUSFUQlc3REk4VE1aRkg0RjJMMEU0RDZPWFZaUy4u&route=shorturl',
					onboardingDraft: {
						firstName: 'Grace',
						studentId: '2530999'
					},
					view: { kind: 'incomplete', email: 'ada@gmail.com' }
				}
			}
		});

		await fireEvent.input(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
		await fireEvent.input(screen.getByLabelText('Student number'), {
			target: { value: '2530622' }
		});
		await fireEvent.click(screen.getByRole('tab', { name: 'Member form' }));
		expect(screen.getByRole('link', { name: 'Open required form' })).toHaveAttribute(
			'href',
			'https://forms.cloud.microsoft/pages/responsepage.aspx?id=gM4FyXMGa02pnxlDYrX7rr5-iZTtVRdEtoDBmsFVUSFUQlc3REk4VE1aRkg0RjJMMEU0RDZPWFZaUy4u&route=shorturl'
		);
	});

	it('shows a completed member as a community profile', () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					club: { kind: 'joined_without_schedule' },
					communityProfile: {
						joinedAt: '2025-09-03T12:00:00.000Z',
						role: 'member'
					},
					recentPosts: [
						{
							id: 'thread-1',
							title: 'Good first projects?',
							body: 'Looking for a small project to build this semester.',
							category: 'student-life',
							courseCode: null,
							createdAt: '2026-08-31T12:00:00.000Z'
						}
					],
					courseOutlines: [
						{
							sha256: 'outline-1',
							courseCode: '420-201',
							title: 'Data Structures',
							createdAt: '2026-08-29T12:00:00.000Z'
						}
					],
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada Lovelace',
						username: 'Ada_Codes',
						firstName: 'Ada',
						lastName: 'Lovelace',
						profileImageDataUrl: 'data:image/png;base64,YQ==',
						nimAccepted: true
					}
				}
			}
		});
		expect(screen.getByRole('heading', { name: 'Ada_Codes' })).toBeInTheDocument();
		expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
		expect(screen.getByText('Member')).toBeInTheDocument();
		expect(screen.getByText('Member since Sep 2025')).toBeInTheDocument();
		expect(
			document.querySelectorAll('.community-profile-meta svg[aria-hidden="true"]')
		).toHaveLength(2);
		expect(screen.getByRole('img', { name: 'Ada Lovelace profile picture' })).toHaveAttribute(
			'src',
			'data:image/png;base64,YQ=='
		);
		expect(screen.getByRole('heading', { name: 'Recent posts' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Good first projects/ })).toHaveAttribute(
			'href',
			'/tools/forum/thread-1'
		);
		expect(
			screen.getByText('Looking for a small project to build this semester.')
		).toBeInTheDocument();
		expect(
			screen
				.getByRole('link', { name: /Good first projects/ })
				.querySelector('.community-post__icon')
		).not.toBeNull();
		expect(screen.getByRole('heading', { name: 'Course outlines' })).toBeInTheDocument();
		expect(screen.getByText('420-201')).toBeInTheDocument();
		expect(screen.getByText('Data Structures')).toBeInTheDocument();
		expect(screen.getByText('420-201').closest('li')).toHaveClass('community-outline-entry');
		expect(
			screen.getByRole('button', { name: 'Edit profile' }).querySelector('svg[aria-hidden="true"]')
		).not.toBeNull();
		expect(
			screen.getByRole('button', { name: 'Sign out' }).querySelector('svg[aria-hidden="true"]')
		).not.toBeNull();
		expect(screen.queryByText('Account status')).not.toBeInTheDocument();
		expect(screen.queryByText('Your schedule is connected')).not.toBeInTheDocument();
		expect(screen.queryByText('NVIDIA outline analysis')).not.toBeInTheDocument();
		expect(screen.queryByText('Student data')).not.toBeInTheDocument();
		expect(screen.queryByText('Who can see what')).not.toBeInTheDocument();
		expect(screen.queryByText('2530622')).not.toBeInTheDocument();
		expect(cssRulesFor('.community-profile-hero')).toContain('min-height: 17rem;');
		expect(cssRulesFor('.community-avatar')).toContain('10.5rem');
		expect(cssRulesFor('.community-profile-actions > button')).toContain('font-size: 1rem;');
		expect(cssRulesFor('.community-profile-actions svg')).toContain('width: 1.25rem;');
	});

	it('edits identity details and uses the avatar as the image picker', async () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					club: { kind: 'joined_without_schedule' },
					communityProfile: { joinedAt: '2025-09-03T12:00:00.000Z', role: 'member' },
					recentPosts: [],
					courseOutlines: [],
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada Lovelace',
						username: 'ada_codes',
						firstName: 'Ada',
						lastName: 'Lovelace',
						profileImageDataUrl: 'data:image/png;base64,YQ==',
						nimAccepted: true
					}
				}
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
		const form = screen.getByRole('form', { name: 'Edit profile' });
		expect(form).toHaveAttribute('action', '?/updateProfile');
		expect(screen.getByLabelText('Username')).toHaveValue('ada_codes');
		expect(screen.getByLabelText('First name')).toHaveValue('Ada');
		expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace');
		expect(screen.getByRole('button', { name: 'Change profile picture' })).toHaveAttribute(
			'type',
			'button'
		);
		expect(screen.getByLabelText('Choose profile picture file')).toHaveAttribute(
			'accept',
			'image/jpeg,image/png,image/webp'
		);
		expect(screen.getByRole('button', { name: 'Save profile' })).toHaveAttribute('type', 'submit');
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByRole('form', { name: 'Edit profile' })).not.toBeInTheDocument();
	});

	it('shows quiet empty states without upload calls to action', () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					club: { kind: 'joined_without_schedule' },
					communityProfile: { joinedAt: '2025-09-03T12:00:00.000Z', role: 'member' },
					recentPosts: [],
					courseOutlines: [],
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada Lovelace',
						username: 'ada_codes',
						firstName: 'Ada',
						lastName: 'Lovelace',
						nimAccepted: true
					}
				}
			}
		});
		expect(screen.getByRole('heading', { name: 'No posts yet' })).toBeInTheDocument();
		expect(
			screen.getByText('Your forum posts will appear here after you start a discussion.')
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'No outlines yet' })).toBeInTheDocument();
		expect(
			screen.getByText('Course outlines you contribute will appear here.')
		).toBeInTheDocument();
		expect(document.querySelectorAll('.profile-empty-state')).toHaveLength(2);
		expect(document.querySelectorAll('.profile-empty-state svg[aria-hidden="true"]')).toHaveLength(
			2
		);
		expect(document.querySelector('.profile-empty-state--posts')).toBeInTheDocument();
		expect(document.querySelector('.profile-empty-state--outlines')).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /upload outline/i })).not.toBeInTheDocument();
		expect(document.querySelector('.profile-alerts')).not.toBeInTheDocument();
	});

	it('surfaces completed-profile alerts without restoring the old status dashboard', () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					recoveryMessage: 'We could not finish sign-in. Try again.',
					unavailable: true,
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: null,
						nimAccepted: false
					}
				},
				form: { error: 'Could not save your account. Try again.' }
			}
		});
		expect(screen.getByText('We could not finish sign-in. Try again.')).toBeInTheDocument();
		expect(
			screen.getByText('Account details are unavailable right now. Try again.')
		).toBeInTheDocument();
		expect(screen.getByText('Could not save your account. Try again.')).toBeInTheDocument();
		expect(screen.queryByText('Not accepted yet')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
	});

	it('confirms a saved account', () => {
		render(AccountPage, {
			props: {
				data: {
					...base,
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada',
						nimAccepted: true
					}
				},
				form: { success: true }
			}
		});
		expect(screen.getByText('Account saved.')).toBeInTheDocument();
	});

	it('signs the student out and returns to the account page', async () => {
		const { endStaffSession } = await import('$lib/auth/staff-sign-out.js');
		const assign = vi.fn();
		vi.stubGlobal('location', { assign });
		render(AccountPage, {
			props: {
				data: {
					...base,
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada',
						nimAccepted: true
					}
				}
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
		expect(endStaffSession).toHaveBeenCalled();
		expect(assign).toHaveBeenCalledWith('/tools/account');
	});

	it('keeps the student signed in when sign out fails', async () => {
		const { endStaffSession } = await import('$lib/auth/staff-sign-out.js');
		endStaffSession.mockRejectedValueOnce(new Error('Sign out is unavailable'));
		render(AccountPage, {
			props: {
				data: {
					...base,
					view: {
						kind: 'complete',
						email: 'ada@gmail.com',
						displayName: 'Ada',
						nimAccepted: true
					}
				}
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
		expect(screen.getByText('Sign out is unavailable. Try again.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
	});
});
