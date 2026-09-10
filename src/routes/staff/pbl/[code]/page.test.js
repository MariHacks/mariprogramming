import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StaffPblDetailPage from './+page.svelte';

vi.mock('$app/forms', () => ({
	enhance: () => {}
}));

afterEach(() => {
	cleanup();
});

const ROOM = Object.freeze({
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
		{ memberId: 'b'.repeat(32), email: 'grace@marihacks.com', userId: 'u2' }
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
});

describe('staff PBL team detail page', () => {
	it('shows unlocked progress, per-step sources, and staff team actions', () => {
		render(StaffPblDetailPage, {
			data: {
				unavailable: false,
				room: ROOM
			}
		});
		expect(screen.getByRole('heading', { level: 1, name: 'Lab table 3' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Team controls' })).toBeInTheDocument();
		expect(screen.getByText('Leader')).toBeInTheDocument();
		expect(screen.getByText(/unlocked step only/i)).toBeInTheDocument();
		expect(screen.getByText(/no shared “current step” location/i)).toBeInTheDocument();
		expect(screen.queryByText(/^Current step$/i)).not.toBeInTheDocument();
		expect(screen.getByText('Per-step source')).toBeInTheDocument();
		expect(screen.getAllByText('print(0)').length).toBeGreaterThan(0);
		expect(screen.getByText('Past submissions')).toBeInTheDocument();
		expect(screen.getByText('Passed')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Disband team' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Eject' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Make leader' })).toBeInTheDocument();
		expect(screen.getByText(/Transfer leadership before ejecting/i)).toBeInTheDocument();
	});

	it('requires typing the room code before confirm disband is enabled', async () => {
		render(StaffPblDetailPage, {
			data: { unavailable: false, room: ROOM }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Disband team' }));
		const confirm = screen.getByRole('button', { name: 'Confirm disband' });
		expect(confirm).toBeDisabled();
		const input = screen.getByLabelText(/Type room code/i);
		await fireEvent.input(input, { target: { value: 'AB23JK' } });
		expect(confirm).not.toBeDisabled();
	});
});
