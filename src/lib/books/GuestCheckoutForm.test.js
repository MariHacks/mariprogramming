import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GuestCheckoutForm from './GuestCheckoutForm.svelte';

afterEach(cleanup);

describe('GuestCheckoutForm', () => {
	it('keeps the native guest fields and secure handoff in a clear keyboard order', async () => {
		const { container } = render(GuestCheckoutForm);
		const user = userEvent.setup();
		const form = screen.getByRole('form', { name: 'Guest details' });
		const name = screen.getByRole('textbox', { name: 'Name for pickup' });
		const email = screen.getByRole('textbox', { name: 'Email for receipt' });
		const submit = screen.getByRole('button', { name: 'Continue to secure payment' });

		expect(name).toHaveAttribute('type', 'text');
		expect(name).toBeRequired();
		expect(email).toHaveAttribute('type', 'email');
		expect(email).toBeRequired();
		expect(submit).toHaveAttribute('type', 'submit');
		expect([...form.querySelectorAll('input, button')]).toEqual([name, email, submit]);
		expect(form).toHaveTextContent('Payment details are entered on the next secure page.');
		expect(container.querySelectorAll('input')).toHaveLength(2);
		expect(container).not.toHaveTextContent(/e-transfer|wayne's|marianopolis|map|fee|tax/i);

		await user.tab();
		expect(document.activeElement).toBe(name);
		await user.tab();
		expect(document.activeElement).toBe(email);
		await user.tab();
		expect(document.activeElement).toBe(submit);
	});

	it('announces empty-field feedback and keeps the first invalid field understandable', async () => {
		const view = render(GuestCheckoutForm);
		const handleSubmit = vi.fn();
		view.component.$on('submit', handleSubmit);
		const name = screen.getByRole('textbox', { name: 'Name for pickup' });
		const email = screen.getByRole('textbox', { name: 'Email for receipt' });

		await fireEvent.submit(screen.getByRole('form', { name: 'Guest details' }));

		const status = screen.getByRole('status');
		expect(status).toHaveAttribute('aria-live', 'polite');
		expect(status).toHaveTextContent('Enter the name for pickup.');
		expect(status).toHaveTextContent('Enter an email for your receipt.');
		expect(name).toHaveAttribute('aria-invalid', 'true');
		expect(email).toHaveAttribute('aria-invalid', 'true');
		expect(document.activeElement).toBe(name);
		expect(handleSubmit).not.toHaveBeenCalled();
	});

	it('blocks a malformed receipt email without pretending to verify the inbox', async () => {
		const view = render(GuestCheckoutForm);
		const handleSubmit = vi.fn();
		view.component.$on('submit', handleSubmit);
		const name = screen.getByRole('textbox', { name: 'Name for pickup' });
		const email = screen.getByRole('textbox', { name: 'Email for receipt' });

		await fireEvent.input(name, { target: { value: 'Maya Chen' } });
		await fireEvent.input(email, { target: { value: 'maya-at-school' } });
		await fireEvent.submit(screen.getByRole('form', { name: 'Guest details' }));

		expect(screen.getByRole('status')).toHaveTextContent(
			'Enter an email in the usual name@example.com format.'
		);
		expect(email).toHaveAttribute('aria-invalid', 'true');
		expect(document.activeElement).toBe(email);
		expect(handleSubmit).not.toHaveBeenCalled();
	});

	it('dispatches one whitespace-normalized guest contact payload after valid submission', async () => {
		const view = render(GuestCheckoutForm);
		const handleSubmit = vi.fn();
		view.component.$on('submit', handleSubmit);

		await fireEvent.input(screen.getByRole('textbox', { name: 'Name for pickup' }), {
			target: { value: '  Maya   Chen  ' }
		});
		await fireEvent.input(screen.getByRole('textbox', { name: 'Email for receipt' }), {
			target: { value: '  MAYA.CHEN@MARIANOPOLIS.EDU  ' }
		});
		await fireEvent.submit(screen.getByRole('form', { name: 'Guest details' }));

		expect(handleSubmit).toHaveBeenCalledOnce();
		expect(handleSubmit.mock.calls[0][0].detail).toEqual({
			name: 'Maya Chen',
			email: 'maya.chen@marianopolis.edu'
		});
	});

	it('reflects the parent-owned loading and error states without allowing a repeat handoff', async () => {
		const view = render(GuestCheckoutForm, {
			props: {
				submitting: true,
				errorMessage: 'Secure payment could not start. Try again.'
			}
		});
		const handleSubmit = vi.fn();
		view.component.$on('submit', handleSubmit);
		const form = screen.getByRole('form', { name: 'Guest details' });
		const submit = screen.getByRole('button', { name: 'Preparing secure payment' });

		expect(form).toHaveAttribute('aria-busy', 'true');
		expect(submit).toBeDisabled();
		expect(screen.getByRole('status')).toHaveTextContent(
			'Secure payment could not start. Try again.'
		);

		await fireEvent.submit(form);

		expect(handleSubmit).not.toHaveBeenCalled();
	});

	it('locks a valid handoff until the parent loading state completes', async () => {
		const view = render(GuestCheckoutForm);
		const handleSubmit = vi.fn();
		view.component.$on('submit', handleSubmit);
		const form = screen.getByRole('form', { name: 'Guest details' });

		await fireEvent.input(screen.getByRole('textbox', { name: 'Name for pickup' }), {
			target: { value: 'Maya Chen' }
		});
		await fireEvent.input(screen.getByRole('textbox', { name: 'Email for receipt' }), {
			target: { value: 'maya.chen@marianopolis.edu' }
		});
		await fireEvent.submit(form);

		expect(handleSubmit).toHaveBeenCalledOnce();
		expect(form).toHaveAttribute('aria-busy', 'true');
		expect(screen.getByRole('button', { name: 'Preparing secure payment' })).toBeDisabled();

		await fireEvent.submit(form);
		expect(handleSubmit).toHaveBeenCalledOnce();

		await view.rerender({ submitting: true, errorMessage: '' });
		await view.rerender({
			submitting: false,
			errorMessage: 'Secure payment could not start. Try again.'
		});

		expect(screen.getByRole('button', { name: 'Continue to secure payment' })).toBeEnabled();
		await fireEvent.submit(form);
		expect(handleSubmit).toHaveBeenCalledTimes(2);
	});
});
