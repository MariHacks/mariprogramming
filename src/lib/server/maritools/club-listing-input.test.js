// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { clubListingInput } from './club-listing-input.js';

/**
 * @param {{ name?: string, submitterRole?: string, category?: string, description?: string, contacts?: Array<{ type: string, label?: string, value: string }> }} overrides
 */
function input(overrides = {}) {
	const data = new FormData();
	data.set('name', overrides.name ?? 'Chess Club');
	data.set('submitterRole', overrides.submitterRole ?? 'officer');
	data.set('category', overrides.category ?? 'Games and recreation');
	data.set('description', overrides.description ?? 'Weekly games');
	for (const row of overrides.contacts ?? []) {
		data.append('contactType', row.type);
		data.append('contactLabel', row.label ?? '');
		data.append('contactValue', row.value ?? '');
	}
	return data;
}

describe('club listing input', () => {
	it('parses a complete listing with several contact methods', () => {
		expect(
			clubListingInput(
				input({
					contacts: [
						{ type: 'email', value: 'chess@example.com' },
						{ type: 'discord', value: 'discord.gg/chess' },
						{ type: 'custom', label: 'Linktree', value: 'https://linktr.ee/chess' }
					]
				})
			)
		).toMatchObject({
			payload: {
				name: 'Chess Club',
				slug: 'chess-club',
				links: [
					{ type: 'email', label: 'Email', url: 'mailto:chess@example.com' },
					{ type: 'discord', label: 'Discord', url: 'https://discord.gg/chess' },
					{ type: 'custom', label: 'Linktree', url: 'https://linktr.ee/chess' }
				]
			}
		});
	});

	it('rejects missing required fields and malformed contacts at the boundary', () => {
		expect(clubListingInput(input({ name: '' })).error).toMatch(/club name/i);
		expect(clubListingInput(input({ submitterRole: 'unknown' })).error).toMatch(/role/i);
		expect(clubListingInput(input({ category: 'Made up' })).error).toMatch(/category/i);
		expect(
			clubListingInput(input({ contacts: [{ type: 'email', value: 'not-email' }] })).error
		).toMatch(/email/i);
		expect(
			clubListingInput(input({ contacts: [{ type: 'website', value: 'not a url' }] })).error
		).toMatch(/web links/i);
	});
});
