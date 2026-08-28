import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SignInPage from './+page.svelte';

vi.mock('$lib/auth/staff-sign-in.js', () => ({
	requestStaffAuthorization: vi.fn()
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('staff sign-in route', () => {
	it('offers one accessible Google sign-in action and states the restricted identity', () => {
		render(SignInPage, {
			data: {
				staff: null,
				pathname: '/staff/sign-in',
				callbackURL: 'https://club.example.com/staff',
				recoveryMessage: null
			}
		});
		expect(screen.getByRole('heading', { level: 1, name: 'Staff access' })).toBeInTheDocument();
		expect(screen.queryByText('Book Delivery operations')).not.toBeInTheDocument();
		expect(screen.getByText(/team@marihacks.com/)).toBeInTheDocument();
		expect(screen.getByText(/Sign in with the/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Continue with Google' })).toHaveAttribute(
			'type',
			'submit'
		);
		expect(screen.getByRole('link', { name: 'Back to the club site' })).toHaveAttribute(
			'href',
			'/'
		);
	});

	it('shows the bounded server recovery message with the same retry and exit actions', () => {
		render(SignInPage, {
			data: {
				staff: null,
				pathname: '/staff/sign-in',
				callbackURL: 'https://club.example.com/staff',
				recoveryMessage: 'Your staff session is no longer active. Sign in again.'
			}
		});
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Your staff session is no longer active. Sign in again.'
		);
		expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Back to the club site' })).toHaveAttribute(
			'href',
			'/'
		);
		expect(document.body).not.toHaveTextContent(/provider-secret|database|allowlist/i);
	});

	it('disables repeat initiation and announces progress', async () => {
		const { requestStaffAuthorization } = await import('$lib/auth/staff-sign-in.js');
		vi.mocked(requestStaffAuthorization).mockReturnValue(new Promise(() => {}));
		const user = userEvent.setup();
		render(SignInPage, {
			data: {
				staff: null,
				pathname: '/staff/sign-in',
				callbackURL: 'https://club.example.com/staff',
				recoveryMessage: null
			}
		});
		const button = screen.getByRole('button', { name: 'Continue with Google' });
		await user.click(button);
		expect(button).toBeDisabled();
		expect(screen.getByRole('status')).toHaveTextContent('Opening Google sign-in');
	});

	it('shows a generic recoverable error without provider or database details', async () => {
		const { requestStaffAuthorization } = await import('$lib/auth/staff-sign-in.js');
		vi.mocked(requestStaffAuthorization).mockRejectedValue(new Error('database secret'));
		const user = userEvent.setup();
		render(SignInPage, {
			data: {
				staff: null,
				pathname: '/staff/sign-in',
				callbackURL: 'https://club.example.com/staff',
				recoveryMessage: null
			}
		});
		await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Sign-in is unavailable. Please try again.'
		);
		expect(document.body).not.toHaveTextContent('database secret');
		expect(screen.getByRole('button', { name: 'Continue with Google' })).not.toBeDisabled();
	});
});
