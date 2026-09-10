import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import StaffPblPage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('staff PBL teams page', () => {
	it('lists unlocked progress and links to team detail', async () => {
		render(StaffPblPage, {
			data: {
				unavailable: false,
				rooms: [
					{
						code: 'AB23JK',
						pblId: 'science',
						teamName: 'Lab table 3',
						unlockedStep: 2,
						memberCount: 2,
						updatedAt: '2026-09-09T18:00:00.000Z',
						lastCheck: { step: 1, passed: true, message: 'Nice work' },
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
		expect(screen.queryByText('Current step')).not.toBeInTheDocument();
		expect(screen.getByText('Unlocked step')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /View step sources/i })).toBeInTheDocument();
	});

	it('explains when no teams exist', () => {
		render(StaffPblPage, { data: { rooms: [], unavailable: false } });
		expect(screen.getByRole('status')).toHaveTextContent('No PBL teams yet');
	});
});
