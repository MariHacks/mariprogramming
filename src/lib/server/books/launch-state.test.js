// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { readBookDeliveryLaunchState, requireLiveBookDelivery } from './launch-state';

describe('Book Delivery launch state', () => {
	it.each([
		[undefined, 'coming-soon'],
		['', 'coming-soon'],
		['coming-soon', 'coming-soon'],
		['LIVE', 'coming-soon'],
		['invalid', 'coming-soon'],
		['live', 'live']
	])('resolves %j to %s', (value, expected) => {
		expect(readBookDeliveryLaunchState({ BOOK_DELIVERY_LAUNCH_STATE: value })).toBe(expected);
	});

	it('fails closed when the environment source is unavailable', () => {
		expect(readBookDeliveryLaunchState(null)).toBe('coming-soon');
	});

	it('returns live without invoking the closed handler', () => {
		const onClosed = vi.fn();
		expect(
			requireLiveBookDelivery({ source: { BOOK_DELIVERY_LAUNCH_STATE: 'live' }, onClosed })
		).toBe('live');
		expect(onClosed).not.toHaveBeenCalled();
	});

	it('invokes the closed handler for every state except exact live', () => {
		const onClosed = vi.fn(() => 'closed');
		expect(requireLiveBookDelivery({ source: {}, onClosed })).toBe('closed');
		expect(onClosed).toHaveBeenCalledOnce();
	});
});
