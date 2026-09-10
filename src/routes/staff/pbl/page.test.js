import { cleanup, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import StaffPblPage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('staff PBL teams page', () => {
	it('lists team progress, members, and expandable source', async () => {
		const user = userEvent.setup();
		render(StaffPblPage, {
			data: {
				unavailable: false,
				rooms: [
					{
						code: 'AB23JK',
						pblId: 'science',
						teamName: 'Lab table 3',
						currentStep: 1,
						unlockedStep: 2,
						memberCount: 2,
						updatedAt: '2026-09-09T18:00:00.000Z',
						lastCheck: { step: 1, passed: true, message: 'Nice work' },
						source: 'print("hello")',
						members: [
							{
								memberId: 'a'.repeat(32),
								userId: 'user-1',
								email: 'ada@marihacks.com'
							},
							{
								memberId: 'b'.repeat(32),
								userId: null,
								email: null
							}
						]
					}
				]
			}
		});
		expect(screen.getByRole('heading', { level: 1, name: 'PBL teams' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Lab table 3' })).toBeInTheDocument();
		expect(screen.getByText('AB23JK')).toBeInTheDocument();
		expect(screen.getByText('ada@marihacks.com')).toBeInTheDocument();
		expect(screen.getByText('Anonymous device')).toBeInTheDocument();
		expect(screen.getByText(/Step 2 · passed · Nice work/)).toBeInTheDocument();
		const details = screen.getByText('Team source code').closest('details');
		expect(details).toBeTruthy();
		expect(details?.open).toBe(false);
		await user.click(screen.getByText('Team source code'));
		expect(screen.getByText('print("hello")')).toBeInTheDocument();
	});

	it('explains when no teams exist', () => {
		render(StaffPblPage, { data: { rooms: [], unavailable: false } });
		expect(screen.getByRole('status')).toHaveTextContent('No PBL teams yet');
	});
});
