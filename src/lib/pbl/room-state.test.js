import { describe, expect, it } from 'vitest';
import {
	MAX_SOURCE_CHARS,
	MAX_TEAM_NAME_CHARS,
	MAX_TEAM_SIZE,
	canAcceptMember,
	isNewerLastCheck,
	MAX_RUN_OUTPUT_CHARS,
	mergeRoomPreferringNewerLastCheck,
	normalizeLastRun,
	normalizeOpenedHints,
	normalizeStepSources,
	normalizeStepYjs,
	normalizeTeamName,
	publicRoomView
} from './room-state.js';

describe('PBL room state', () => {
	it('caps a team at 10 people', () => {
		expect(MAX_TEAM_SIZE).toBe(10);
		expect(canAcceptMember(9)).toBe(true);
		expect(canAcceptMember(10)).toBe(false);
		expect(canAcceptMember(0)).toBe(true);
		expect(canAcceptMember(-1)).toBe(false);
		expect(canAcceptMember(1.5)).toBe(false);
	});

	it('trims and bounds a team name', () => {
		expect(normalizeTeamName('  Lab table 3  ')).toBe('Lab table 3');
		expect(normalizeTeamName('')).toBeNull();
		expect(normalizeTeamName('   ')).toBeNull();
		expect(normalizeTeamName(12)).toBeNull();
		expect(normalizeTeamName('bad\u0001name')).toBeNull();
		expect(normalizeTeamName('x'.repeat(MAX_TEAM_NAME_CHARS + 1))).toBeNull();
		expect(normalizeTeamName('x'.repeat(MAX_TEAM_NAME_CHARS))).toBe(
			'x'.repeat(MAX_TEAM_NAME_CHARS)
		);
	});

	it('stores the highest hint opened on each step', () => {
		expect(normalizeOpenedHints(undefined)).toEqual({});
		expect(normalizeOpenedHints({ 3: 2, 4: 1 })).toEqual({ '3': 2, '4': 1 });
		expect(normalizeOpenedHints({ 3: 0, 4: 3, bad: 2 })).toEqual({ '4': 3 });
		expect(normalizeOpenedHints(null)).toEqual({});
		expect(normalizeOpenedHints(['1'])).toEqual({});
	});

	it('normalizes per-step sources and yjs snapshots', () => {
		expect(normalizeStepSources(undefined)).toEqual({});
		expect(normalizeStepSources({ '0': 'print(1)', '1': 'print(2)', bad: 'x' })).toEqual({
			'0': 'print(1)',
			'1': 'print(2)'
		});
		expect(normalizeStepSources({ '0': 'x'.repeat(MAX_SOURCE_CHARS + 1) })).toEqual({});
		expect(normalizeStepSources(['nope'])).toEqual({});
		expect(normalizeStepYjs(null)).toEqual({});
		expect(normalizeStepYjs({ '0': 'abc=', '1': '%%%', bad: 'x' })).toEqual({ '0': 'abc=' });
		expect(normalizeStepYjs({ '0': 'a'.repeat(200001) })).toEqual({});
	});

	it('exposes the fields a second device and a facilitator need', () => {
		const now = new Date('2026-09-08T15:00:00.000Z');
		const view = publicRoomView({
			code: 'AB23JK',
			pblId: 'science',
			teamName: 'Lab table 3',
			source: 'print("ok")',
			currentStep: 0,
			unlockedStep: 2,
			lastCheck: { step: 1, passed: true, message: 'Bounds work.', at: now.toISOString() },
			openedHints: { '1': 2 },
			stepEnteredAt: now.toISOString(),
			memberCount: 3,
			version: 4,
			driverMemberId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
			stepSources: { '0': 'print(0)', '1': 'print(1)' }
		});

		expect(view).toMatchObject({
			code: 'AB23JK',
			pblId: 'science',
			teamName: 'Lab table 3',
			source: 'print("ok")',
			currentStep: 2,
			unlockedStep: 2,
			memberCount: 3,
			version: 4,
			joinable: true,
			isDriver: false,
			yjsState: '',
			awarenessState: '',
			stepSources: { '0': 'print(0)', '1': 'print(1)' }
		});
		expect(
			publicRoomView(
				{
					code: 'AB23JK',
					pblId: 'science',
					teamName: 'Lab table 3',
					source: 'print("ok")',
					currentStep: 2,
					unlockedStep: 2,
					lastCheck: null,
					openedHints: {},
					stepEnteredAt: now.toISOString(),
					memberCount: 1,
					version: 1,
					driverMemberId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
				},
				'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
			).isDriver
		).toBe(true);
		expect(view.source.length).toBeLessThanOrEqual(MAX_SOURCE_CHARS);
		expect(view.lastCheck?.passed).toBe(true);
		expect(view.openedHints).toEqual({ '1': 2 });
	});

	it('keeps a newer local lastCheck when merging server room state', () => {
		expect(isNewerLastCheck(null, { at: '2026-09-08T15:00:00.000Z' })).toBe(false);
		expect(isNewerLastCheck({ at: '2026-09-08T15:01:00.000Z' }, null)).toBe(true);
		expect(
			isNewerLastCheck(
				{ at: '2026-09-08T15:01:00.000Z' },
				{ at: '2026-09-08T15:00:00.000Z' }
			)
		).toBe(true);
		expect(
			isNewerLastCheck(
				{ at: '2026-09-08T15:00:00.000Z' },
				{ at: '2026-09-08T15:01:00.000Z' }
			)
		).toBe(false);
		const merged = mergeRoomPreferringNewerLastCheck(
			{
				source: 'from-server',
				version: 4,
				unlockedStep: 0,
				lastCheck: {
					step: 0,
					passed: false,
					message: 'old fail',
					at: '2026-09-08T15:00:00.000Z'
				}
			},
			{
				unlockedStep: 1,
				lastCheck: {
					step: 0,
					passed: true,
					message: 'Printed a custom message. Starter text is gone.',
					at: '2026-09-08T15:01:00.000Z'
				}
			}
		);
		expect(merged.source).toBe('from-server');
		expect(merged.version).toBe(4);
		expect(merged.unlockedStep).toBe(1);
		expect(merged.lastCheck).toMatchObject({ passed: true, at: '2026-09-08T15:01:00.000Z' });
	});


	it('normalizes shared lastRun terminal snapshots', () => {
		expect(normalizeLastRun(null)).toBeNull();
		expect(normalizeLastRun({ output: 'hi', error: '', step: 0, at: 'nope', running: false })).toBeNull();
		expect(
			normalizeLastRun({
				output: 'ok\n',
				error: '',
				step: 1,
				at: '2026-09-08T15:00:00.000Z',
				running: true
			})
		).toEqual({
			output: 'ok\n',
			error: '',
			step: 1,
			at: '2026-09-08T15:00:00.000Z',
			running: true
		});
		const huge = 'x'.repeat(MAX_RUN_OUTPUT_CHARS + 10);
		expect(normalizeLastRun({
			output: huge,
			error: 'boom',
			step: 0,
			at: '2026-09-08T15:00:00.000Z',
			running: false
		})?.output).toHaveLength(MAX_RUN_OUTPUT_CHARS);
	});

	it('keeps a newer local lastRun when merging server room state', () => {
		const merged = mergeRoomPreferringNewerLastCheck(
			{
				source: 'from-server',
				version: 4,
				lastRun: {
					output: 'old',
					error: '',
					step: 0,
					at: '2026-09-08T15:00:00.000Z',
					running: false
				}
			},
			{
				lastRun: {
					output: 'fresh\n',
					error: '',
					step: 0,
					at: '2026-09-08T15:01:00.000Z',
					running: false
				}
			}
		);
		expect(merged.lastRun).toMatchObject({ output: 'fresh\n', at: '2026-09-08T15:01:00.000Z' });
		expect(
			publicRoomView({
				code: 'AB23JK',
				pblId: 'science',
				teamName: 'Lab',
				source: '',
				currentStep: 0,
				unlockedStep: 0,
				lastCheck: null,
				lastRun: {
					output: 'hi',
					error: '',
					step: 0,
					at: '2026-09-08T15:00:00.000Z',
					running: false
				},
				openedHints: {},
				stepEnteredAt: '2026-09-08T15:00:00.000Z',
				memberCount: 1,
				version: 1
			}).lastRun
		).toMatchObject({ output: 'hi', running: false });
	});

});
