import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import StaffPblDetailPage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('staff PBL team detail page', () => {
	it('shows unlocked progress, per-step sources, and submissions', () => {
		render(StaffPblDetailPage, {
			data: {
				unavailable: false,
				room: {
					code: 'AB23JK',
					pblId: 'science',
					teamName: 'Lab table 3',
					unlockedStep: 1,
					memberCount: 2,
					driverMemberId: 'a'.repeat(32),
					updatedAt: '2026-09-09T18:00:00.000Z',
					source: 'print("fallback")',
					stepSources: { '0': 'print(0)', '1': 'print(1)' },
					members: [
						{ memberId: 'a'.repeat(32), email: 'ada@marihacks.com', userId: 'u1' },
						{ memberId: 'b'.repeat(32), email: null, userId: null }
					],
					submissions: [
						{
							id: 'sub-1',
							step: 0,
							passed: true,
							message: 'ok',
							source: 'print(0)',
							createdAt: '2026-09-09T18:01:00.000Z'
						}
					]
				}
			}
		});
		expect(screen.getByRole('heading', { level: 1, name: 'Lab table 3' })).toBeInTheDocument();
		expect(screen.getByText('Leader')).toBeInTheDocument();
		expect(screen.getByText('Per-step source')).toBeInTheDocument();
		expect(screen.getAllByText('print(0)').length).toBeGreaterThan(0);
		expect(screen.getByText('Past submissions')).toBeInTheDocument();
		expect(screen.getByText('Passed')).toBeInTheDocument();
		expect(screen.queryByText('Disband team')).not.toBeInTheDocument();
		expect(screen.queryByText('Eject')).not.toBeInTheDocument();
	});
});
