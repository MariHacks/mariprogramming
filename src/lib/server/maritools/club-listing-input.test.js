// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { clubListingDraft, clubListingInput } from './club-listing-input.js';

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
	it('drafts missing fields and defaults a value-only contact', () => {
		const data = new FormData();
		data.append('contactValue', 'example.com');

		expect(clubListingDraft(data)).toEqual({
			name: '',
			category: '',
			description: '',
			submitterRole: '',
			links: [{ type: 'custom', label: '', url: 'example.com' }]
		});
	});

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

	it.each([
		['an overlong description', input({ description: 'a'.repeat(4001) }), /description/i],
		[
			'mismatched contact fields',
			(() => {
				const data = input({
					contacts: [{ type: 'website', label: 'Site', value: 'example.com' }]
				});
				data.delete('contactLabel');
				return data;
			})(),
			/contact methods/i
		],
		[
			'an unsupported contact type',
			input({ contacts: [{ type: 'fax', value: '123' }] }),
			/contact methods/i
		],
		['an invalid MIO address', input({ contacts: [{ type: 'mio', value: 'not-email' }] }), /MIO/i],
		[
			'an unsupported URL protocol',
			input({ contacts: [{ type: 'website', value: 'ftp://example.com' }] }),
			/web links/i
		],
		['a name without a usable slug', input({ name: '!!!' }), /page link/i]
	])('rejects %s', (_case, data, message) => {
		expect(clubListingInput(data).error).toMatch(message);
	});

	it('skips blank web contacts', () => {
		expect(clubListingInput(input({ contacts: [{ type: 'website', value: '' }] }))).toMatchObject({
			payload: { links: [] }
		});
	});

	it('handles null legacy link fields from a form-like request', () => {
		const values = new Map([
			['name', 'Chess Club'],
			['submitterRole', 'officer'],
			['category', 'Games and recreation'],
			['description', 'Weekly games']
		]);
		const data = {
			get: (key) => values.get(key) ?? null,
			getAll: () => [],
			has: (key) => values.has(key) || key === 'linkUrl'
		};

		expect(clubListingInput(data)).toMatchObject({ payload: { links: [] } });
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
